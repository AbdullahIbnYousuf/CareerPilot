# Design Document

## Introduction

This document specifies the architectural design for refactoring the CareerPilot backend from its current implementation to the prescribed routers/services pattern defined in AGENTS.md. The refactor addresses critical contradictions between the existing codebase and the specification, including deprecated library usage (pypdf, langchain-google-genai), incorrect database client configuration, and missing architectural separation between HTTP concerns and business logic.

The design follows a four-phase incremental migration strategy to maintain system stability throughout the refactor process. Each phase produces a runnable system state, allowing for validation before proceeding to the next phase.

## System Architecture

### Current State Analysis

The existing backend implementation exhibits the following architectural issues:

**Incorrect Library Usage:**

- Uses `pypdf` for PDF parsing (forbidden by AGENTS.md due to poor multi-column layout handling)
- Uses `langchain-google-genai.GoogleGenerativeAIEmbeddings` instead of Voyage AI
- Uses `langchain-google-genai.ChatGoogleGenerativeAI` instead of Groq for streaming chat
- Missing Upstash Redis caching layer

**Incorrect Module Structure:**

- Database client in `app/database.py` using generic `SUPABASE_KEY` instead of `SUPABASE_SERVICE_ROLE_KEY`
- Business logic mixed with HTTP concerns in `app/main.py`
- No routers directory - all endpoints in single main.py file
- Core logic in `app/core/` and `app/agents/` instead of `services/`

**Missing Functionality:**

- No section-aware fit scoring (current implementation uses simple cosine similarity)
- No job search API fallback chain (only uses Tavily)
- No Redis caching for job search results
- No hybrid search RPC usage (uses deprecated match_resume_chunks)

### Target Architecture

```
backend/
├── main.py                          # FastAPI app initialization, router registration, CORS
├── db/
│   └── supabase.py                  # Singleton Database_Client using service role key
├── services/
│   ├── parser.py                    # CV_Parser: Gemini multimodal (PDF) + python-docx (DOCX)
│   ├── embedder.py                  # Embedding_Service: Voyage AI voyage-3
│   ├── chat.py                      # Chat_Service: Groq Llama 3.3 70B streaming
│   ├── fit_score.py                 # Fit_Score_Service: Section-weighted cosine similarity
│   ├── searcher.py                  # Job_Search_Service: JSearch → Remotive → Tavily fallback
│   └── cache.py                     # Redis helper functions for Upstash
├── routers/
│   ├── cv.py                        # POST /upload-resume
│   ├── jobs.py                      # POST /hunt-jobs, GET /jobs/{job_id}
│   ├── chat.py                      # POST /chat (streaming SSE)
│   ├── tracker.py                   # CRUD for applications table
│   └── dashboard.py                 # GET /dashboard/progress
├── requirements.txt
└── .env
```

**Key Architectural Principles:**

1. **Separation of Concerns**: Routers handle HTTP (request validation, response formatting), services handle business logic (parsing, embedding, scoring)
2. **Singleton Database Client**: Single `db/supabase.py` module exports configured client, imported by all services
3. **Async-First**: All I/O operations use `async def` and `await` for FastAPI compatibility
4. **Type Safety**: All service functions use type hints, all router endpoints use Pydantic models
5. **Incremental Migration**: Four phases ensure system remains runnable throughout refactor

## Component Design

### 1. Database Client Module (`db/supabase.py`)

**Purpose**: Provide singleton Supabase client with service role authentication for all backend operations.

**Implementation**:

```python
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL: str = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

# Normalize URL - remove trailing /rest/v1/ if present
if SUPABASE_URL.endswith("/rest/v1/"):
    SUPABASE_URL = SUPABASE_URL.replace("/rest/v1/", "")
elif SUPABASE_URL.endswith("/rest/v1"):
    SUPABASE_URL = SUPABASE_URL.replace("/rest/v1", "")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
```

**Key Changes from Current Implementation**:

- Uses `SUPABASE_SERVICE_ROLE_KEY` instead of generic `SUPABASE_KEY`
- Located in `db/` directory instead of `app/`
- Exports `supabase` client for import by services

**Usage Pattern**:

```python
from db.supabase import supabase

async def get_user_cv(user_id: str):
    result = await supabase.table("cvs").select("*").eq("user_id", user_id).execute()
    return result.data
```

### 2. CV Parser Service (`services/parser.py`)

**Purpose**: Extract text from PDF and DOCX resume files using format-appropriate parsers.

**Implementation**:

```python
import io
from typing import Literal
from docx import Document
from google import genai
from google.genai import types
import os

# Initialize Gemini client
client = genai.Client(api_key=os.environ.get("GOOGLE_API_KEY", ""))

async def parse_cv(file_bytes: bytes, filename: str) -> str:
    """
    Extract text from CV file using format-appropriate parser.

    Args:
        file_bytes: Raw file bytes
        filename: Original filename with extension

    Returns:
        Extracted text as string

    Raises:
        ValueError: If file format is not supported
    """
    if filename.lower().endswith('.pdf'):
        return await _parse_pdf_with_gemini(file_bytes)
    elif filename.lower().endswith('.docx'):
        return _parse_docx(file_bytes)
    else:
        raise ValueError(f"Unsupported file format: {filename}")

async def _parse_pdf_with_gemini(file_bytes: bytes) -> str:
    """Parse PDF using Gemini 2.0 Flash multimodal."""
    response = await client.aio.models.generate_content(
        model="gemini-2.0-flash",
        contents=[
            types.Part.from_bytes(data=file_bytes, mime_type="application/pdf"),
            "Extract all text from this resume/CV. Return only the text content, no formatting."
        ]
    )
    return response.text

def _parse_docx(file_bytes: bytes) -> str:
    """Parse DOCX using python-docx."""
    doc = Document(io.BytesIO(file_bytes))
    return "\n".join([para.text for para in doc.paragraphs])
```

**Key Changes from Current Implementation**:

- Replaces `pypdf.PdfReader` with Gemini multimodal API
- Uses `types.Part.from_bytes` for PDF parsing (handles multi-column layouts)
- Async function for Gemini API call
- Type hints on all parameters and return values

### 3. Embedding Service (`services/embedder.py`)

**Purpose**: Generate vector embeddings using Voyage AI voyage-3 model with context-appropriate input types.

**Implementation**:

```python
from typing import Literal
import voyageai
import os

# Initialize Voyage AI client
vo = voyageai.Client(api_key=os.environ.get("VOYAGE_API_KEY", ""))

async def embed_text(
    text: str,
    input_type: Literal["document", "query"]
) -> list[float]:
    """
    Generate embedding vector for text using Voyage AI voyage-3.

    Args:
        text: Text to embed
        input_type: "document" for CV chunks, "query" for search queries

    Returns:
        Embedding vector as list of floats
    """
    result = await vo.aembed(
        texts=[text],
        model="voyage-3",
        input_type=input_type
    )
    return result.embeddings[0]

async def embed_documents(texts: list[str]) -> list[list[float]]:
    """Batch embed multiple document texts."""
    result = await vo.aembed(
        texts=texts,
        model="voyage-3",
        input_type="document"
    )
    return result.embeddings

async def embed_query(text: str) -> list[float]:
    """Convenience function for embedding queries."""
    return await embed_text(text, input_type="query")
```

**Key Changes from Current Implementation**:

- Replaces `GoogleGenerativeAIEmbeddings` with Voyage AI client
- Explicit `input_type` parameter for document vs query embeddings
- Async functions for API calls
- Batch embedding support for efficiency

### 4. Chat Service (`services/chat.py`)

**Purpose**: Stream conversational responses using Groq Llama 3.3 70B with CV context retrieval.

**Implementation**:

```python
from typing import AsyncGenerator
from groq import Groq
from db.supabase import supabase
from services.embedder import embed_query
import os

# Initialize Groq client
groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY", ""))

async def stream_chat_response(
    user_id: str,
    message: str,
    history: list[dict]
) -> AsyncGenerator[str, None]:
    """
    Stream chat response with CV context.

    Args:
        user_id: User identifier for CV context retrieval
        message: User's chat message
        history: List of {"role": "user"|"assistant", "content": str}

    Yields:
        Token strings as they are generated
    """
    # Retrieve CV context using hybrid search
    cv_context = await _get_cv_context(user_id, message)

    # Build messages with system prompt
    system_prompt = f"""You are CareerPilot AI, a helpful career assistant.
Answer questions grounded in the user's CV context below.

CV Context:
{cv_context}
"""

    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(history)
    messages.append({"role": "user", "content": message})

    # Stream response from Groq
    stream = groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=messages,
        stream=True,
        temperature=0.3
    )

    for chunk in stream:
        if chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content

async def _get_cv_context(user_id: str, query: str, top_k: int = 5) -> str:
    """Retrieve relevant CV chunks using hybrid search."""
    query_embedding = await embed_query(query)

    result = await supabase.rpc("hybrid_search", {
        "query_embedding": query_embedding,
        "query_text": query,
        "match_count": top_k,
        "p_user_id": user_id
    }).execute()

    if not result.data:
        return "No resume uploaded yet."

    return "\n\n".join([chunk["content"] for chunk in result.data])
```

**Key Changes from Current Implementation**:

- Replaces `ChatGoogleGenerativeAI` with Groq client
- Uses `llama-3.3-70b-versatile` model
- Implements async generator for streaming
- Uses `hybrid_search` RPC instead of deprecated `match_resume_chunks`

### 5. Fit Score Service (`services/fit_score.py`)

**Purpose**: Calculate job-to-CV match scores using section-aware weighted cosine similarity.

**Implementation**:

```python
import numpy as np
from typing import TypedDict
from db.supabase import supabase
from services.embedder import embed_query
from google import genai
import os

# Section weights as per AGENTS.md specification
SECTION_WEIGHTS = {
    "skills": 0.40,
    "experience": 0.35,
    "education": 0.15,
    "projects": 0.10
}

class FitScoreResult(TypedDict):
    score: int  # 0-100
    explanation: str
    section_scores: dict[str, float]

async def calculate_fit_score(
    user_id: str,
    job_description: str,
    top_k_per_section: int = 3
) -> FitScoreResult:
    """
    Calculate programmatic fit score using section-weighted cosine similarity.

    Args:
        user_id: User identifier for CV retrieval
        job_description: Job description text
        top_k_per_section: Number of CV chunks to retrieve per section

    Returns:
        FitScoreResult with score (0-100), explanation, and section breakdown
    """
    # Embed job description
    jd_embedding = await embed_query(job_description)

    # Retrieve top-k chunks per section and compute section scores
    section_scores = {}
    evidence_chunks = []

    for section, weight in SECTION_WEIGHTS.items():
        chunks = await _get_section_chunks(user_id, section, jd_embedding, top_k_per_section)

        if not chunks:
            section_scores[section] = 0.0
            continue

        # Compute cosine similarity for each chunk
        similarities = [
            _cosine_similarity(jd_embedding, chunk["embedding"])
            for chunk in chunks
        ]

        # Average similarity for this section
        section_scores[section] = np.mean(similarities)
        evidence_chunks.extend([chunk["content"] for chunk in chunks[:2]])  # Top 2 for evidence

    # Weighted average across sections
    weighted_score = sum(
        section_scores.get(section, 0.0) * weight
        for section, weight in SECTION_WEIGHTS.items()
    )

    # Convert to 0-100 integer
    final_score = int(weighted_score * 100)

    # Generate explanation using Gemini
    explanation = await _generate_explanation(
        job_description,
        evidence_chunks,
        final_score,
        section_scores
    )

    return {
        "score": final_score,
        "explanation": explanation,
        "section_scores": section_scores
    }

async def _get_section_chunks(
    user_id: str,
    section: str,
    query_embedding: list[float],
    top_k: int
) -> list[dict]:
    """Retrieve top-k CV chunks for specific section using hybrid search."""
    result = await supabase.rpc("hybrid_search", {
        "query_embedding": query_embedding,
        "query_text": "",  # Embedding-only search
        "match_count": top_k,
        "p_user_id": user_id,
        "p_section": section  # Filter by section
    }).execute()

    return result.data or []

def _cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
    """Compute cosine similarity between two vectors."""
    a = np.array(vec_a)
    b = np.array(vec_b)
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))

async def _generate_explanation(
    job_description: str,
    evidence: list[str],
    score: int,
    section_scores: dict[str, float]
) -> str:
    """Generate one-sentence explanation using Gemini."""
    client = genai.Client(api_key=os.environ.get("GOOGLE_API_KEY", ""))

    prompt = f"""Given this fit score of {score}/100 for a job, write ONE sentence explaining why.

Job Description: {job_description[:500]}

CV Evidence:
{chr(10).join(evidence[:3])}

Section Scores:
- Skills: {section_scores.get('skills', 0):.2f}
- Experience: {section_scores.get('experience', 0):.2f}
- Education: {section_scores.get('education', 0):.2f}
- Projects: {section_scores.get('projects', 0):.2f}

Write a concise, specific explanation in one sentence."""

    response = await client.aio.models.generate_content(
        model="gemini-2.0-flash",
        contents=prompt
    )

    return response.text.strip()
```

**Key Changes from Current Implementation**:

- Implements section-aware scoring (skills 40%, experience 35%, education 15%, projects 10%)
- Uses hybrid search with section filtering
- Programmatic cosine similarity calculation (not LLM-based)
- Gemini generates explanation only, not the score
- Returns structured result with section breakdown

### 6. Job Search Service (`services/searcher.py`)

**Purpose**: Search jobs using fallback chain (JSearch → Remotive → Tavily) with Redis caching.

**Implementation**:

```python
import hashlib
import json
from typing import Optional
from upstash_redis import Redis
import httpx
import os

# Initialize Redis client
redis = Redis.from_env()

CACHE_TTL = 7200  # 2 hours in seconds

async def search_jobs(
    query: str,
    location: str = "",
    max_results: int = 10
) -> list[dict]:
    """
    Search for jobs using fallback chain with caching.

    Priority: JSearch → Remotive → Tavily

    Args:
        query: Job search query (e.g., "Python developer")
        location: Location filter (e.g., "Dhaka, Bangladesh")
        max_results: Maximum number of results to return

    Returns:
        List of job dictionaries with keys: title, company, location, url, description
    """
    # Check cache first
    cache_key = _generate_cache_key(query, location)
    cached = await _get_cached_results(cache_key)

    if cached:
        return cached[:max_results]

    # Try JSearch first (best for Bangladesh/Dhaka)
    jobs = await _search_jsearch(query, location, max_results)

    # Fallback to Remotive if no results
    if not jobs:
        jobs = await _search_remotive(query, max_results)

    # Fallback to Tavily if still no results
    if not jobs:
        jobs = await _search_tavily(query, location, max_results)

    # Cache results
    if jobs:
        await _cache_results(cache_key, jobs)

    return jobs

def _generate_cache_key(query: str, location: str) -> str:
    """Generate Redis cache key using MD5 hash."""
    combined = f"{query}:{location}"
    hash_digest = hashlib.md5(combined.encode()).hexdigest()
    return f"jobs:{hash_digest}"

async def _get_cached_results(cache_key: str) -> Optional[list[dict]]:
    """Retrieve cached results from Redis."""
    try:
        cached_data = redis.get(cache_key)
        if cached_data:
            return json.loads(cached_data)
    except Exception:
        pass
    return None

async def _cache_results(cache_key: str, jobs: list[dict]) -> None:
    """Store results in Redis with TTL."""
    try:
        redis.setex(cache_key, CACHE_TTL, json.dumps(jobs))
    except Exception:
        pass  # Cache failure should not break search

async def _search_jsearch(query: str, location: str, max_results: int) -> list[dict]:
    """Search using JSearch API (RapidAPI)."""
    api_key = os.environ.get("JSEARCH_API_KEY", "")
    if not api_key:
        return []

    url = "https://jsearch.p.rapidapi.com/search"
    headers = {
        "X-RapidAPI-Key": api_key,
        "X-RapidAPI-Host": "jsearch.p.rapidapi.com"
    }
    params = {
        "query": f"{query} {location}".strip(),
        "num_pages": 1
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers, params=params, timeout=10.0)
            response.raise_for_status()
            data = response.json()

            jobs = []
            for item in data.get("data", [])[:max_results]:
                jobs.append({
                    "title": item.get("job_title", ""),
                    "company": item.get("employer_name", ""),
                    "location": item.get("job_city", "") + ", " + item.get("job_country", ""),
                    "url": item.get("job_apply_link", ""),
                    "description": item.get("job_description", "")[:500]
                })

            return jobs
    except Exception:
        return []

async def _search_remotive(query: str, max_results: int) -> list[dict]:
    """Search using Remotive API (no auth required)."""
    url = "https://remotive.com/api/remote-jobs"
    params = {"search": query, "limit": max_results}

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params, timeout=10.0)
            response.raise_for_status()
            data = response.json()

            jobs = []
            for item in data.get("jobs", [])[:max_results]:
                jobs.append({
                    "title": item.get("title", ""),
                    "company": item.get("company_name", ""),
                    "location": "Remote",
                    "url": item.get("url", ""),
                    "description": item.get("description", "")[:500]
                })

            return jobs
    except Exception:
        return []

async def _search_tavily(query: str, location: str, max_results: int) -> list[dict]:
    """Search using Tavily API for local job boards."""
    api_key = os.environ.get("TAVILY_API_KEY", "")
    if not api_key:
        return []

    url = "https://api.tavily.com/search"
    headers = {"Content-Type": "application/json"}
    payload = {
        "api_key": api_key,
        "query": f"{query} jobs {location} site:bdjobs.com OR site:linkedin.com",
        "max_results": max_results
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=payload, timeout=10.0)
            response.raise_for_status()
            data = response.json()

            jobs = []
            for item in data.get("results", [])[:max_results]:
                jobs.append({
                    "title": item.get("title", ""),
                    "company": "See listing",
                    "location": location or "Bangladesh",
                    "url": item.get("url", ""),
                    "description": item.get("content", "")[:500]
                })

            return jobs
    except Exception:
        return []
```

**Key Changes from Current Implementation**:

- Implements three-tier fallback chain (JSearch → Remotive → Tavily)
- Adds Upstash Redis caching with MD5 key generation
- Uses httpx for async HTTP requests
- Structured error handling (failures don't crash, just fallback)
- Cache TTL of 7200 seconds (2 hours)

### 7. Router Modules

**Purpose**: Handle HTTP concerns (request validation, response formatting) and delegate business logic to services.

#### CV Router (`routers/cv.py`)

```python
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from services.parser import parse_cv
from services.embedder import embed_documents
from db.supabase import supabase

router = APIRouter(prefix="/cv", tags=["cv"])

class CVUploadResponse(BaseModel):
    status: str
    cv_id: str
    chunks_stored: int

@router.post("/upload", response_model=CVUploadResponse)
async def upload_cv(user_id: str, file: UploadFile = File(...)):
    """Upload and process CV file."""
    try:
        # Parse CV
        file_bytes = await file.read()
        text = await parse_cv(file_bytes, file.filename)

        # Chunk text by section (simplified - actual implementation would use NLP)
        chunks = _chunk_by_section(text)

        # Generate embeddings
        embeddings = await embed_documents([chunk["content"] for chunk in chunks])

        # Store CV metadata
        cv_result = await supabase.table("cvs").insert({
            "user_id": user_id,
            "file_name": file.filename,
            "parsed_at": "now()"
        }).execute()

        cv_id = cv_result.data[0]["id"]

        # Store chunks with embeddings
        chunk_data = [
            {
                "user_id": user_id,
                "cv_id": cv_id,
                "section": chunk["section"],
                "content": chunk["content"],
                "embedding": embedding
            }
            for chunk, embedding in zip(chunks, embeddings)
        ]

        await supabase.table("cv_chunks").insert(chunk_data).execute()

        return {
            "status": "success",
            "cv_id": cv_id,
            "chunks_stored": len(chunks)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def _chunk_by_section(text: str) -> list[dict]:
    """Chunk text by CV sections (simplified implementation)."""
    # TODO: Implement proper section detection using NLP or regex patterns
    # For now, split into fixed-size chunks and assign sections
    chunks = []
    chunk_size = 500
    sections = ["skills", "experience", "education", "projects"]

    for i in range(0, len(text), chunk_size):
        chunks.append({
            "section": sections[len(chunks) % len(sections)],
            "content": text[i:i+chunk_size]
        })

    return chunks
```

#### Jobs Router (`routers/jobs.py`)

```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.searcher import search_jobs
from services.fit_score import calculate_fit_score

router = APIRouter(prefix="/jobs", tags=["jobs"])

class JobSearchRequest(BaseModel):
    user_id: str
    query: str
    location: str = ""
    max_results: int = 10

class JobSearchResponse(BaseModel):
    jobs: list[dict]
    count: int

@router.post("/search", response_model=JobSearchResponse)
async def search_jobs_endpoint(request: JobSearchRequest):
    """Search for jobs with fit scoring."""
    try:
        # Search jobs using fallback chain
        jobs = await search_jobs(
            query=request.query,
            location=request.location,
            max_results=request.max_results
        )

        # Calculate fit scores for each job
        for job in jobs:
            fit_result = await calculate_fit_score(
                user_id=request.user_id,
                job_description=job.get("description", "")
            )
            job["fit_score"] = fit_result["score"]
            job["fit_explanation"] = fit_result["explanation"]

        # Sort by fit score descending
        jobs.sort(key=lambda x: x.get("fit_score", 0), reverse=True)

        return {
            "jobs": jobs,
            "count": len(jobs)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

#### Chat Router (`routers/chat.py`)

```python
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from services.chat import stream_chat_response

router = APIRouter(prefix="/chat", tags=["chat"])

class ChatRequest(BaseModel):
    user_id: str
    message: str
    history: list[dict] = []

@router.post("/stream")
async def chat_stream(request: ChatRequest):
    """Stream chat response with CV context."""
    try:
        async def generate():
            async for token in stream_chat_response(
                user_id=request.user_id,
                message=request.message,
                history=request.history
            ):
                yield f"data: {token}\n\n"

        return StreamingResponse(
            generate(),
            media_type="text/event-stream"
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

#### Tracker Router (`routers/tracker.py`)

```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Literal
from db.supabase import supabase

router = APIRouter(prefix="/tracker", tags=["tracker"])

ApplicationStatus = Literal["saved", "applied", "interviewing", "offer", "rejected"]

class ApplicationCreate(BaseModel):
    user_id: str
    job_id: str
    status: ApplicationStatus = "saved"

class ApplicationUpdate(BaseModel):
    status: ApplicationStatus

@router.post("/applications")
async def create_application(app: ApplicationCreate):
    """Create new job application."""
    try:
        result = await supabase.table("applications").insert({
            "user_id": app.user_id,
            "job_id": app.job_id,
            "status": app.status,
            "applied_at": "now()"
        }).execute()

        return result.data[0]

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/applications/{user_id}")
async def get_applications(user_id: str):
    """Get all applications for user."""
    try:
        result = await supabase.table("applications") \
            .select("*, jobs(*)") \
            .eq("user_id", user_id) \
            .order("applied_at", desc=True) \
            .execute()

        return result.data

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/applications/{application_id}")
async def update_application(application_id: str, update: ApplicationUpdate):
    """Update application status."""
    try:
        result = await supabase.table("applications") \
            .update({"status": update.status}) \
            .eq("id", application_id) \
            .execute()

        return result.data[0]

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

#### Dashboard Router (`routers/dashboard.py`)

```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from db.supabase import supabase

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

class ProgressStats(BaseModel):
    applications_sent: int
    interviews_scheduled: int
    offers_received: int
    streak_days: int

@router.get("/progress/{user_id}", response_model=ProgressStats)
async def get_progress(user_id: str):
    """Get user progress statistics."""
    try:
        # Count applications by status
        apps_result = await supabase.table("applications") \
            .select("status") \
            .eq("user_id", user_id) \
            .execute()

        apps = apps_result.data

        stats = {
            "applications_sent": len([a for a in apps if a["status"] in ["applied", "interviewing", "offer"]]),
            "interviews_scheduled": len([a for a in apps if a["status"] == "interviewing"]),
            "offers_received": len([a for a in apps if a["status"] == "offer"]),
            "streak_days": 0  # TODO: Calculate from activity log
        }

        return stats

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

### 8. Main Application (`main.py`)

**Purpose**: Initialize FastAPI app, register routers, configure CORS.

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import cv, jobs, chat, tracker, dashboard

app = FastAPI(
    title="CareerPilot API",
    description="Agentic career co-pilot backend",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TODO: Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(cv.router)
app.include_router(jobs.router)
app.include_router(chat.router)
app.include_router(tracker.router)
app.include_router(dashboard.router)

@app.get("/")
async def root():
    return {"message": "CareerPilot API", "status": "running"}

@app.get("/health")
async def health():
    return {"status": "healthy"}
```

**Key Changes from Current Implementation**:

- Removes all business logic (moved to services)
- Removes endpoint definitions (moved to routers)
- Only handles app initialization and router registration

## Data Flow Diagrams

### CV Upload and Processing Flow

```
1. User uploads CV file (PDF/DOCX)
   ↓
2. Router (cv.py) receives file, validates format
   ↓
3. Parser Service (parser.py) extracts text
   - PDF → Gemini multimodal API
   - DOCX → python-docx
   ↓
4. Text chunked by section (skills, experience, education, projects)
   ↓
5. Embedder Service (embedder.py) generates vectors
   - Voyage AI voyage-3 with input_type="document"
   ↓
6. Database Client stores:
   - CV metadata in cvs table
   - Chunks with embeddings in cv_chunks table
   ↓
7. Response returned to user
```

### Job Search and Fit Scoring Flow

```
1. User submits job search query
   ↓
2. Router (jobs.py) receives request
   ↓
3. Searcher Service (searcher.py) checks Redis cache
   - Cache hit → return cached results
   - Cache miss → proceed to API calls
   ↓
4. API Fallback Chain:
   - Try JSearch API (Bangladesh/Dhaka focus)
   - If empty, try Remotive API (remote jobs)
   - If empty, try Tavily API (local job boards)
   ↓
5. For each job, Fit Score Service (fit_score.py):
   a. Embed job description (Voyage AI, input_type="query")
   b. Hybrid search for CV chunks per section
   c. Compute cosine similarity per chunk
   d. Calculate weighted average (skills 40%, experience 35%, education 15%, projects 10%)
   e. Generate explanation (Gemini)
   ↓
6. Cache results in Redis (TTL 7200s)
   ↓
7. Return sorted jobs (by fit score descending)
```

### Chat Interaction Flow

```
1. User sends chat message
   ↓
2. Router (chat.py) receives request with history
   ↓
3. Chat Service (chat.py):
   a. Embed user message (Voyage AI, input_type="query")
   b. Hybrid search for relevant CV chunks
   c. Build context with system prompt + CV context
   d. Stream response from Groq (Llama 3.3 70B)
   ↓
4. Router streams tokens to client via SSE
   ↓
5. Frontend displays incremental response
```

## Migration Strategy

### Phase 1: Foundation (Database and Directory Structure)

**Objective**: Establish new module structure and database client without breaking existing functionality.

**Actions**:

1. Create `db/` directory
2. Create `db/supabase.py` with service role key configuration
3. Create `services/` directory (empty)
4. Create `routers/` directory (empty)
5. Update `.env` to include all required keys with TODO comments for missing values
6. Keep existing `app/` directory intact

**Verification**: Backend starts successfully, existing endpoints still work.

### Phase 2: Service Layer Migration (Parser and Embedder)

**Objective**: Migrate CV parsing and embedding to new service modules.

**Actions**:

1. Create `services/parser.py` with Gemini multimodal + python-docx
2. Create `services/embedder.py` with Voyage AI client
3. Update `requirements.txt`:
   - Add: `voyageai`, `google-generativeai`, `httpx`
   - Keep: `pypdf`, `langchain-google-genai` (for backward compatibility)
4. Test new services independently
5. Keep existing `app/core/` modules intact

**Verification**: New parser and embedder services work correctly with test inputs.

### Phase 3: Business Logic Migration (Chat, Fit Score, Search)

**Objective**: Migrate remaining business logic to service modules.

**Actions**:

1. Create `services/chat.py` with Groq streaming
2. Create `services/fit_score.py` with section-weighted algorithm
3. Create `services/searcher.py` with fallback chain
4. Create `services/cache.py` with Redis helpers
5. Update `requirements.txt`:
   - Add: `groq`, `upstash-redis`
   - Remove: `langchain-google-genai`, `langchain-community`, `pypdf`
6. Test each service independently
7. Keep existing `app/agents/` modules intact

**Verification**: All new services work correctly, pass unit tests.

### Phase 4: Router Layer and Cleanup

**Objective**: Create router modules, update main.py, remove legacy code.

**Actions**:

1. Create `routers/cv.py` using `services/parser.py` and `services/embedder.py`
2. Create `routers/jobs.py` using `services/searcher.py` and `services/fit_score.py`
3. Create `routers/chat.py` using `services/chat.py`
4. Create `routers/tracker.py` using `db/supabase.py`
5. Create `routers/dashboard.py` using `db/supabase.py`
6. Update `main.py` to register all routers
7. Remove legacy modules:
   - `app/database.py`
   - `app/core/parser.py`
   - `app/core/embedding.py`
   - `app/agents/graph.py`
   - `app/agents/matching.py`
8. Remove empty directories: `app/core/`, `app/agents/`
9. Update all imports in remaining files

**Verification**:

- All endpoints work via new routers
- No import errors
- Backend passes integration tests
- Legacy code completely removed

### Rollback Strategy

Each phase maintains backward compatibility until the next phase is verified:

- **Phase 1**: No code changes, only new directories → zero risk
- **Phase 2**: New services coexist with old modules → can revert by not using new services
- **Phase 3**: New services coexist with old modules → can revert by not using new services
- **Phase 4**: Only after all services verified → legacy code removed

If issues arise in Phase 4, restore legacy modules from git history and revert main.py changes.

## Error Handling Strategy

### Service Layer Error Handling

All service functions follow consistent error handling patterns:

```python
async def service_function(...) -> ReturnType:
    """Service function with error handling."""
    try:
        # Business logic
        result = await external_api_call()
        return process_result(result)

    except httpx.HTTPError as e:
        # Log HTTP errors
        logger.error(f"HTTP error in service_function: {e}")
        raise ServiceError(f"External API failed: {str(e)}")

    except Exception as e:
        # Log unexpected errors
        logger.error(f"Unexpected error in service_function: {e}")
        raise ServiceError(f"Service error: {str(e)}")
```

### Router Layer Error Handling

Routers catch service errors and return appropriate HTTP responses:

```python
@router.post("/endpoint")
async def endpoint(request: RequestModel):
    try:
        result = await service_function(request.param)
        return {"status": "success", "data": result}

    except ServiceError as e:
        raise HTTPException(status_code=500, detail=str(e))

    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))

    except Exception as e:
        logger.error(f"Unexpected error in endpoint: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
```

### Fallback Behavior

**Job Search Fallback**: If all APIs fail, return empty list with warning message instead of error.

**Cache Failures**: Cache read/write failures should not break requests - log and continue.

**CV Context Retrieval**: If hybrid search fails, return "No resume uploaded" message instead of error.

## Environment Configuration

### Required Environment Variables

**Backend `.env` file**:

```bash
# LLM APIs
GROQ_API_KEY=# TODO: Add Groq API key for Llama 3.3 70B streaming
GOOGLE_API_KEY=# TODO: Add Google API key for Gemini 2.0 Flash

# Embedding API
VOYAGE_API_KEY=# TODO: Add Voyage AI API key for voyage-3 embeddings

# Database
SUPABASE_URL=# TODO: Add Supabase project URL
SUPABASE_SERVICE_ROLE_KEY=# TODO: Add Supabase service role key (not anon key)

# Caching
UPSTASH_REDIS_REST_URL=# TODO: Add Upstash Redis REST URL
UPSTASH_REDIS_REST_TOKEN=# TODO: Add Upstash Redis REST token

# Job Search APIs
JSEARCH_API_KEY=# TODO: Add JSearch RapidAPI key
TAVILY_API_KEY=# TODO: Add Tavily API key
```

### Configuration Validation

Add startup validation in `main.py`:

```python
import os
from fastapi import FastAPI

REQUIRED_ENV_VARS = [
    "GROQ_API_KEY",
    "GOOGLE_API_KEY",
    "VOYAGE_API_KEY",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "JSEARCH_API_KEY",
    "TAVILY_API_KEY"
]

@app.on_event("startup")
async def validate_environment():
    """Validate required environment variables on startup."""
    missing = [var for var in REQUIRED_ENV_VARS if not os.environ.get(var)]

    if missing:
        print(f"WARNING: Missing environment variables: {', '.join(missing)}")
        print("Some features may not work correctly.")
```

## Dependency Management

### Updated `requirements.txt`

**Remove**:

- `pypdf` (replaced by Gemini multimodal)
- `langchain-google-genai` (replaced by direct google-generativeai)
- `langchain-community` (replaced by direct API clients)

**Add**:

- `voyageai` (for embeddings)
- `groq` (for streaming chat)
- `upstash-redis` (for caching)
- `httpx` (for async HTTP requests)

**Retain**:

- `python-docx` (for DOCX parsing)
- `fastapi`, `uvicorn` (web framework)
- `supabase` (database client)
- `pydantic` (data validation)
- `python-dotenv` (environment variables)
- `google-genai` (already present, used for Gemini)

### Installation Commands

```bash
# Remove deprecated packages
pip uninstall -y pypdf langchain-google-genai langchain-community

# Install new packages
pip install voyageai groq upstash-redis httpx

# Regenerate requirements.txt
pip freeze > requirements.txt
```

## Testing Strategy

### Unit Tests

Each service module should have corresponding unit tests:

**`tests/test_parser.py`**:

- Test PDF parsing with sample PDF bytes
- Test DOCX parsing with sample DOCX bytes
- Test unsupported format error handling

**`tests/test_embedder.py`**:

- Test document embedding with input_type="document"
- Test query embedding with input_type="query"
- Test batch embedding

**`tests/test_fit_score.py`**:

- Test section weight application (40/35/15/10)
- Test cosine similarity calculation
- Test score range (0-100)
- Test explanation generation

**`tests/test_searcher.py`**:

- Test cache hit behavior (no API calls)
- Test cache miss behavior (API calls made)
- Test fallback chain (JSearch → Remotive → Tavily)
- Test cache key generation (MD5 hash)

**`tests/test_chat.py`**:

- Test streaming response generation
- Test CV context retrieval
- Test message history handling

### Integration Tests

**`tests/integration/test_cv_upload.py`**:

- Test complete CV upload flow (upload → parse → embed → store)
- Verify database records created correctly

**`tests/integration/test_job_search.py`**:

- Test complete job search flow (search → score → cache)
- Verify fit scores calculated correctly

**`tests/integration/test_chat_flow.py`**:

- Test complete chat flow (message → context → stream)
- Verify streaming response format

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

### Property 1: Parser Return Type Consistency

_For any_ valid PDF or DOCX file bytes, the CV_Parser SHALL return extracted text as a string type.

**Validates: Requirements 2.6**

### Property 2: Embedding Input Type Correctness

_For any_ text embedding operation, the Embedding_Service SHALL set input_type parameter to "document" when embedding CV chunks and "query" when embedding search queries.

**Validates: Requirements 3.3, 3.4**

### Property 3: Embedding Return Type Consistency

_For any_ valid text input, the Embedding_Service SHALL return embedding vectors as a list of float values.

**Validates: Requirements 3.8**

### Property 4: Chat Streaming Behavior

_For any_ chat message input, the Chat_Service SHALL yield response tokens incrementally using async generator pattern rather than returning a complete response.

**Validates: Requirements 4.4, 4.8**

### Property 5: Fit Score Weight Application

_For any_ CV and job description pair, the Fit_Score_Service SHALL apply section weights of exactly 40% skills, 35% experience, 15% education, and 10% projects when calculating the weighted average.

**Validates: Requirements 5.2**

### Property 6: Fit Score Section Search Independence

_For any_ job description, the Fit_Score_Service SHALL perform hybrid_search exactly 4 times, once for each section (skills, experience, education, projects).

**Validates: Requirements 5.3**

### Property 7: Fit Score Cosine Similarity Computation

_For any_ two embedding vectors, the Fit_Score_Service SHALL compute cosine similarity using the formula: (A · B) / (||A|| × ||B||).

**Validates: Requirements 5.4**

### Property 8: Fit Score Weighted Average Calculation

_For any_ set of section scores, the Fit_Score_Service SHALL calculate the final score as the weighted sum of section scores multiplied by their respective weights.

**Validates: Requirements 5.5**

### Property 9: Fit Score Range Constraint

_For any_ valid CV and job description inputs, the Fit_Score_Service SHALL produce an integer score in the range [0, 100] inclusive.

**Validates: Requirements 5.6**

### Property 10: Fit Score Explanation Generation

_For any_ calculated fit score, the Fit_Score_Service SHALL pass the score and evidence to Gemini to generate a one-sentence explanation.

**Validates: Requirements 5.7**

### Property 11: Job Search Fallback Chain Ordering

_For any_ job search query, the Job_Search_Service SHALL attempt APIs in the order: JSearch first, then Remotive if JSearch returns empty, then Tavily if Remotive returns empty.

**Validates: Requirements 6.2, 6.3, 6.4**

### Property 12: Job Search Cache Storage

_For any_ job search query, the Job_Search_Service SHALL cache results in Redis with key pattern "jobs:{md5(query+location)}" and TTL of 7200 seconds.

**Validates: Requirements 6.5, 6.6**

### Property 13: Job Search Cache Hit Behavior

_For any_ job search query with existing cached results, the Job_Search_Service SHALL return cached data without making external API calls.

**Validates: Requirements 6.7**

## Performance Considerations

### Embedding Batch Operations

**Optimization**: Use `embed_documents()` for batch embedding instead of individual calls.

```python
# ❌ Inefficient - multiple API calls
embeddings = [await embed_text(chunk, "document") for chunk in chunks]

# ✅ Efficient - single batch API call
embeddings = await embed_documents(chunks)
```

**Impact**: Reduces API latency from O(n) to O(1) for n chunks.

### Redis Caching Strategy

**Cache Key Design**: MD5 hash of query+location ensures consistent keys while avoiding length limits.

**TTL Selection**: 7200 seconds (2 hours) balances freshness with API cost reduction.

**Cache Miss Handling**: Fallback chain ensures results even when cache is cold.

### Hybrid Search Performance

**Index Requirements**: Ensure Supabase has indexes on:

- `cv_chunks.user_id`
- `cv_chunks.section`
- `cv_chunks.embedding` (pgvector index)

**Query Optimization**: Use section filtering in hybrid_search to reduce search space.

### Streaming Response Optimization

**Chunk Size**: Groq streams tokens individually - no buffering needed.

**Backpressure**: FastAPI StreamingResponse handles backpressure automatically.

### Async I/O Patterns

All I/O operations use `async/await` to prevent blocking:

- Database queries: `await supabase.table(...).execute()`
- API calls: `await client.get(...)` with httpx.AsyncClient
- Streaming: `async for token in stream_chat_response(...)`

## Security Considerations

### API Key Management

**Environment Variables**: All API keys stored in `.env` file, never hardcoded.

**Service Role Key**: Backend uses `SUPABASE_SERVICE_ROLE_KEY` for full database access. Frontend uses `SUPABASE_ANON_KEY` with RLS.

**Key Rotation**: Support key rotation by reading from environment on each request (no global caching).

### Input Validation

**File Upload**: Validate file extensions and MIME types before parsing.

**Query Parameters**: Use Pydantic models for automatic validation and type coercion.

**SQL Injection**: Supabase client uses parameterized queries - no raw SQL in application code.

### Rate Limiting

**External APIs**: Implement exponential backoff for API failures.

**Redis Cache**: Reduces API calls, indirectly provides rate limiting protection.

### CORS Configuration

**Development**: Allow all origins (`allow_origins=["*"]`)

**Production**: Restrict to frontend domain only:

```python
allow_origins=["https://careerpilot.vercel.app"]
```

### Error Message Sanitization

**Service Errors**: Log full error details, return sanitized messages to client.

**API Key Leakage**: Never include API keys or tokens in error responses.

## Deployment Considerations

### Render Deployment

**Memory Constraints**: Render free tier provides 512MB RAM.

**Library Choices**:

- ✅ Gemini multimodal (API-based, no local memory)
- ✅ Voyage AI (API-based, no local memory)
- ✅ Groq (API-based, no local memory)
- ❌ docling (requires 1.5-2GB RAM, will OOM)
- ❌ pypdf (poor multi-column handling)

**Environment Variables**: Set in Render dashboard, not in code.

**Health Check**: `/health` endpoint for Render monitoring.

### Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Startup Time Optimization

**Lazy Loading**: Initialize API clients on first use, not at module import.

**Connection Pooling**: Supabase client reuses connections automatically.

**Precompiled Dependencies**: Use wheel packages where available.

## Monitoring and Logging

### Logging Strategy

**Log Levels**:

- `INFO`: Successful operations (CV uploaded, job search completed)
- `WARNING`: Fallback behavior (cache miss, API fallback)
- `ERROR`: Failures (API errors, parsing errors)

**Structured Logging**:

```python
import logging

logger = logging.getLogger(__name__)

logger.info("CV parsed successfully", extra={
    "user_id": user_id,
    "filename": filename,
    "chunks": len(chunks)
})

logger.error("API call failed", extra={
    "service": "jsearch",
    "error": str(e),
    "query": query
})
```

### Metrics to Track

**API Usage**:

- Groq API calls per hour
- Voyage AI embedding requests per hour
- Gemini API calls per hour
- JSearch/Remotive/Tavily API calls per hour

**Cache Performance**:

- Redis cache hit rate
- Average cache lookup time

**Service Performance**:

- CV parsing time (PDF vs DOCX)
- Fit score calculation time
- Job search response time

**Error Rates**:

- API failure rate per service
- Parser failure rate per file type
- Database query failure rate

## Future Enhancements

### Phase 5+ Improvements (Post-Refactor)

**Advanced CV Parsing**:

- NLP-based section detection (replace regex with spaCy or similar)
- Multi-language CV support
- Skills extraction and normalization

**Enhanced Fit Scoring**:

- Machine learning model for fit prediction
- Historical application success data integration
- Industry-specific weight adjustments

**Job Search Optimization**:

- Personalized search ranking based on user preferences
- Duplicate job detection across APIs
- Salary range filtering and normalization

**Caching Improvements**:

- Distributed caching with Redis Cluster
- Cache warming for popular queries
- Intelligent cache invalidation

**Observability**:

- OpenTelemetry integration for distributed tracing
- Prometheus metrics export
- Grafana dashboards for monitoring

**Testing**:

- Property-based testing with Hypothesis
- Load testing with Locust
- Contract testing for API integrations

## Appendix: Code Examples

### Example: Complete CV Upload Flow

```python
# Client request
POST /cv/upload
Content-Type: multipart/form-data

user_id: "user_123"
file: resume.pdf (binary)

# Router handling (routers/cv.py)
@router.post("/upload")
async def upload_cv(user_id: str, file: UploadFile = File(...)):
    file_bytes = await file.read()

    # Parse CV
    text = await parse_cv(file_bytes, file.filename)

    # Chunk by section
    chunks = _chunk_by_section(text)

    # Generate embeddings
    embeddings = await embed_documents([c["content"] for c in chunks])

    # Store in database
    cv_result = await supabase.table("cvs").insert({
        "user_id": user_id,
        "file_name": file.filename,
        "parsed_at": "now()"
    }).execute()

    cv_id = cv_result.data[0]["id"]

    chunk_data = [
        {
            "user_id": user_id,
            "cv_id": cv_id,
            "section": chunk["section"],
            "content": chunk["content"],
            "embedding": embedding
        }
        for chunk, embedding in zip(chunks, embeddings)
    ]

    await supabase.table("cv_chunks").insert(chunk_data).execute()

    return {"status": "success", "cv_id": cv_id, "chunks_stored": len(chunks)}
```

### Example: Complete Job Search with Fit Scoring

```python
# Client request
POST /jobs/search
Content-Type: application/json

{
  "user_id": "user_123",
  "query": "Python developer",
  "location": "Dhaka, Bangladesh",
  "max_results": 10
}

# Router handling (routers/jobs.py)
@router.post("/search")
async def search_jobs_endpoint(request: JobSearchRequest):
    # Search with caching and fallback
    jobs = await search_jobs(
        query=request.query,
        location=request.location,
        max_results=request.max_results
    )

    # Calculate fit scores
    for job in jobs:
        fit_result = await calculate_fit_score(
            user_id=request.user_id,
            job_description=job["description"]
        )
        job["fit_score"] = fit_result["score"]
        job["fit_explanation"] = fit_result["explanation"]

    # Sort by fit score
    jobs.sort(key=lambda x: x["fit_score"], reverse=True)

    return {"jobs": jobs, "count": len(jobs)}

# Response
{
  "jobs": [
    {
      "title": "Senior Python Developer",
      "company": "Tech Corp",
      "location": "Dhaka, Bangladesh",
      "url": "https://...",
      "description": "...",
      "fit_score": 87,
      "fit_explanation": "Strong match with 5 years Python experience and Django expertise matching job requirements."
    },
    ...
  ],
  "count": 10
}
```

### Example: Streaming Chat Response

```python
# Client request
POST /chat/stream
Content-Type: application/json

{
  "user_id": "user_123",
  "message": "What are my key skills?",
  "history": [
    {"role": "user", "content": "Hello"},
    {"role": "assistant", "content": "Hi! How can I help you today?"}
  ]
}

# Router handling (routers/chat.py)
@router.post("/stream")
async def chat_stream(request: ChatRequest):
    async def generate():
        async for token in stream_chat_response(
            user_id=request.user_id,
            message=request.message,
            history=request.history
        ):
            yield f"data: {token}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")

# Response (Server-Sent Events)
data: Based
data:  on
data:  your
data:  CV
data: ,
data:  your
data:  key
data:  skills
data:  include
data:  Python
data: ,
data:  Django
data: ,
data:  PostgreSQL
data: ,
data:  and
data:  REST
data:  APIs
data: .
```

## Conclusion

This design document specifies a complete architectural refactor of the CareerPilot backend to align with AGENTS.md requirements. The four-phase migration strategy ensures system stability throughout the refactor process while addressing all identified contradictions between current implementation and specification.

Key improvements include:

- Correct library usage (Gemini multimodal, Voyage AI, Groq)
- Proper architectural separation (routers/services pattern)
- Section-aware fit scoring algorithm
- Job search fallback chain with Redis caching
- Type-safe async patterns throughout

The design maintains backward compatibility during migration and provides clear rollback strategies for each phase.
