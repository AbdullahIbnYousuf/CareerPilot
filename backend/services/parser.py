"""
CV Parser Service - CareerPilot

PDF  -> Gemini 2.0 Flash multimodal (types.Part.from_bytes)
DOCX -> python-docx text extraction -> Gemini 2.0 Flash structuring

Returns structured JSON with 4 sections: skills, experience, education, projects
NEVER use: pypdf, pdfplumber, pdfminer, docling, unstructured, PyMuPDF
"""

import io
import os
import json
import logging
from docx import Document
import google.generativeai as genai
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception, before_sleep_log

logger = logging.getLogger(__name__)

# Initialize Gemini client
_GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY", "")

def _get_gemini_client(model_name: str = 'gemini-2.0-flash'):
    genai.configure(api_key=_GOOGLE_API_KEY)
    return genai.GenerativeModel(model_name)


def _is_rate_limit(exception):
    err_str = str(exception).lower()
    return "429" in err_str or "quota" in err_str or "rate limit" in err_str or "resource exhausted" in err_str


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception(_is_rate_limit),
    before_sleep=before_sleep_log(logger, logging.WARNING),
    reraise=True
)
def _generate_content_with_retry(model, contents, generation_config=None):
    if generation_config:
        return model.generate_content(contents, generation_config=generation_config)
    return model.generate_content(contents)


def generate_content_with_fallback(contents, generation_config=None):
    models = ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-flash-latest']
    last_exception = None
    
    for model_name in models:
        try:
            model = _get_gemini_client(model_name)
            return _generate_content_with_retry(model, contents, generation_config)
        except Exception as e:
            err_str = str(e).lower()
            if "429" in err_str or "quota" in err_str or "rate limit" in err_str or "resource exhausted" in err_str:
                logger.warning(f"Gemini model '{model_name}' failed with rate limit/quota error. Trying fallback model...")
                last_exception = e
                continue
            elif "not found" in err_str or "404" in err_str:
                logger.warning(f"Gemini model '{model_name}' not found. Trying fallback model...")
                last_exception = e
                continue
            else:
                raise e
    
    if last_exception:
        raise last_exception
    raise RuntimeError("All Gemini fallback models failed to execute.")


# Structured parsing prompt
_STRUCTURED_PROMPT = """Extract information from this CV and return ONLY a valid JSON object with these exact keys:

{
  "skills": "comma-separated list of technical skills, tools, programming languages, frameworks",
  "experience": "all work experience entries with company, role, duration, responsibilities",
  "education": "all education entries with institution, degree, year, GPA if present",
  "projects": "all projects with title, description, technologies used"
}

Rules:
- Return ONLY valid JSON, no markdown code blocks, no explanation
- If a section is missing or empty, use empty string ""
- Preserve all details, do not summarize
- For skills: extract from skills section AND from experience/projects
- For experience: include internships and part-time work
- For education: include certifications and online courses
- For projects: include academic, personal, and professional projects"""

_REQUIRED_KEYS = ("skills", "experience", "education", "projects")


def _clean_json_response(text: str) -> str:
    """Remove markdown code blocks and clean JSON response."""
    text = text.strip()
    
    # Remove markdown code blocks
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    
    if text.endswith("```"):
        text = text[:-3]
    
    return text.strip()


def _parse_structured_response(response_text: str) -> dict[str, str]:
    """Parse and normalize LLM JSON into the four required CV sections."""
    cleaned = _clean_json_response(response_text)

    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError as e:
        raise ValueError(f"Failed to parse LLM response as JSON: {e}") from e

    if not isinstance(parsed, dict):
        raise ValueError("LLM response must be a JSON object")

    normalized: dict[str, str] = {}
    for key in _REQUIRED_KEYS:
        value = parsed.get(key, "")
        if value is None:
            normalized[key] = ""
        elif isinstance(value, str):
            normalized[key] = value.strip()
        else:
            normalized[key] = json.dumps(value, ensure_ascii=False)

    return normalized


def parse_pdf_cv(file_bytes: bytes) -> dict[str, str]:
    """
    Parse PDF CV using Gemini 2.0 Flash multimodal.
    Raw bytes are passed as types.Part.from_bytes.
    Returns structured JSON with 4 sections.
    """
    # Build multimodal prompt with PDF bytes
    response = generate_content_with_fallback(
        [
            _STRUCTURED_PROMPT,
            {"mime_type": "application/pdf", "data": file_bytes}
        ],
        generation_config=genai.GenerationConfig(
            response_mime_type="application/json",
            temperature=0.1,
        )
    )
    
    response_text = response.text or ""
    if not response_text.strip():
        raise ValueError("PDF file appears to be empty or unreadable")
    
    return _parse_structured_response(response_text)


def parse_docx_cv(file_bytes: bytes) -> dict[str, str]:
    """
    Parse DOCX CV using python-docx + Gemini 2.0/2.5/1.5 Flash structuring.
    Returns structured JSON with 4 sections.
    """
    # Extract text with python-docx
    doc = Document(io.BytesIO(file_bytes))
    full_text = "\n".join(para.text for para in doc.paragraphs if para.text.strip())
    
    if not full_text.strip():
        raise ValueError("DOCX file appears to be empty")
    
    prompt = f"{_STRUCTURED_PROMPT}\n\nHere is the CV text:\n\n{full_text}"
    
    response = generate_content_with_fallback(
        prompt,
        generation_config=genai.GenerationConfig(
            response_mime_type="application/json",
            temperature=0.1,
        )
    )
    
    return _parse_structured_response(response.text or "")


def parse_cv(file_bytes: bytes, filename: str) -> dict[str, str]:
    """
    Route to correct parser based on file extension.
    Returns structured JSON with 4 sections: skills, experience, education, projects.
    """
    lower = filename.lower()
    
    if lower.endswith(".pdf"):
        return parse_pdf_cv(file_bytes)
    elif lower.endswith(".docx"):
        return parse_docx_cv(file_bytes)
    else:
        raise ValueError(f"Unsupported file format. Only .pdf and .docx are supported.")
