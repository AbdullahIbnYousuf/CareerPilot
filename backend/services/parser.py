"""
CV Parser Service - CareerPilot

PDF  -> PyMuPDF text extraction + Groq Llama structuring
DOCX -> python-docx text extraction + Groq Llama structuring

Returns structured JSON with 4 sections: skills, experience, education, projects
NEVER use: pypdf, pdfplumber, pdfminer, docling, unstructured
"""

import io
import os
import json
import fitz  # PyMuPDF
from groq import Groq
from docx import Document

# Initialize Groq client
_groq = Groq(api_key=os.environ.get("GROQ_API_KEY", ""))
_MODEL = "llama-3.3-70b-versatile"

# Structured parsing prompt
_STRUCTURED_PROMPT = """You are a CV parsing assistant. Extract information from this CV and return ONLY a valid JSON object with these exact keys:

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
    Parse PDF CV using PyMuPDF text extraction + Groq structuring.
    Returns structured JSON with 4 sections.
    """
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    full_text = ""
    for page in doc:
        full_text += page.get_text()
    doc.close()

    if not full_text.strip():
        raise ValueError("PDF file appears to be empty or unreadable")

    structuring_prompt = f"{_STRUCTURED_PROMPT}\n\nHere is the CV text:\n\n{full_text}"

    response = _groq.chat.completions.create(
        model=_MODEL,
        messages=[{"role": "user", "content": structuring_prompt}],
        temperature=0.1,
        response_format={"type": "json_object"},
    )

    return _parse_structured_response(response.choices[0].message.content or "")


def parse_docx_cv(file_bytes: bytes) -> dict[str, str]:
    """
    Parse DOCX CV using python-docx + Groq structuring.
    Returns structured JSON with 4 sections.
    """
    # Extract text with python-docx
    doc = Document(io.BytesIO(file_bytes))
    full_text = "\n".join(para.text for para in doc.paragraphs if para.text.strip())
    
    if not full_text.strip():
        raise ValueError("DOCX file appears to be empty")
    
    # Use Groq to structure the extracted text
    structuring_prompt = f"{_STRUCTURED_PROMPT}\n\nHere is the CV text:\n\n{full_text}"
    
    response = _groq.chat.completions.create(
        model=_MODEL,
        messages=[{"role": "user", "content": structuring_prompt}],
        temperature=0.1,
        response_format={"type": "json_object"},
    )
    
    return _parse_structured_response(response.choices[0].message.content or "")


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
