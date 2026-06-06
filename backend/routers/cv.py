"""
CV Router - CareerPilot (Pillar 2: CV Intelligence)

Day 2 scope:
  POST /api/cv/upload - validate, parse CV, save metadata to cvs table
  GET  /api/cv/list   - list all CVs for a user
  GET  /api/cv/{cv_id} - get specific CV metadata

Day 3 additions:
  POST /api/cv/upload now also: uploads to Storage, chunks, embeds, stores in cv_chunks
  GET  /api/cv/search - hybrid search over cv_chunks via RPC
"""

import uuid
from datetime import datetime
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from pydantic import BaseModel, Field
from db.supabase import supabase
from services.parser import parse_cv_with_profile
from services.storage import upload_cv_file
from services.chunker import chunk_cv_sections
from services.embedder import embed_documents
from services.searcher import hybrid_search
from services.profile import (
    build_profile_from_sections,
    get_profile as fetch_profile,
    update_profile as save_profile_edits,
    upsert_profile,
)

router = APIRouter(prefix="/api/cv", tags=["cv"])

# File size limit: 5 MB
MAX_FILE_SIZE = 5 * 1024 * 1024


# ── Response Models ──────────────────────────────────────────────────────────

class ProfileLink(BaseModel):
    label: str = ""
    url: str = ""


class ProfileExperience(BaseModel):
    title: str = ""
    company: str = ""
    location: str = ""
    start_date: str = ""
    end_date: str = ""
    description: str = ""


class ProfileEducation(BaseModel):
    institution: str = ""
    degree: str = ""
    field: str = ""
    start_year: str = ""
    end_year: str = ""
    details: str = ""


class ProfileProject(BaseModel):
    title: str = ""
    description: str = ""
    technologies: list[str] = Field(default_factory=list)
    url: str = ""


class ProfilePayload(BaseModel):
    full_name: str = ""
    headline: str = ""
    location: str = ""
    email: str = ""
    phone: str = ""
    links: list[ProfileLink] = Field(default_factory=list)
    summary: str = ""
    skills: list[str] = Field(default_factory=list)
    experience: list[ProfileExperience] = Field(default_factory=list)
    education: list[ProfileEducation] = Field(default_factory=list)
    projects: list[ProfileProject] = Field(default_factory=list)
    certifications: list[str] = Field(default_factory=list)


class UserProfile(ProfilePayload):
    user_id: str
    active_cv_id: Optional[str] = None
    raw_sections: dict[str, str] = Field(default_factory=dict)
    generated_at: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class ProfileResponse(BaseModel):
    profile: Optional[UserProfile]


class CVUploadResponse(BaseModel):
    """Response model for CV upload (Day 3: includes chunks_stored and file_url)"""
    cv_id: str
    file_name: str
    file_url: Optional[str]
    parsed_data: dict[str, str]
    profile: UserProfile
    chunks_stored: int
    parsed_at: str
    message: str


class CVMetadata(BaseModel):
    """CV metadata from database"""
    id: str
    user_id: str
    file_name: str
    file_url: Optional[str]
    parsed_at: Optional[str]
    created_at: str


# ── Upload Endpoint ──────────────────────────────────────────────────────────

@router.post("/upload", response_model=CVUploadResponse)
async def upload_cv(
    user_id: str = Query(..., description="User UUID from Supabase Auth"),
    file: UploadFile = File(..., description="CV file (.pdf or .docx, max 5 MB)")
):
    """
    Upload and parse a CV file.

    Pipeline (Day 3):
    1. Validate file type (.pdf or .docx only)
    2. Validate file size (max 5 MB)
    3. Parse CV → 4-section structured JSON
    4. Upload original file to Supabase Storage
    5. Delete old cvs row for this user (cascade removes old cv_chunks)
    6. Insert metadata into cvs table
    7. Chunk parsed JSON by section
    8. Embed each chunk with Gemini gemini-embedding-001
    9. Insert chunks + embeddings into cv_chunks
    10. Return structured response
    """
    # ── 1. Validate filename ──────────────────────────────────────────────────
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    filename = file.filename
    filename_lower = filename.lower()

    if not (filename_lower.endswith(".pdf") or filename_lower.endswith(".docx")):
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Only .pdf and .docx files are supported."
        )

    # ── 2. Read & validate size ───────────────────────────────────────────────
    try:
        file_bytes = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {str(e)}")

    file_size = len(file_bytes)

    if file_size == 0:
        raise HTTPException(status_code=400, detail="File is empty")

    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE / 1024 / 1024:.1f} MB"
        )

    # ── 3. Parse CV → structured JSON ────────────────────────────────────────
    try:
        parsed_result = parse_cv_with_profile(file_bytes, filename)
        parsed_data = parsed_result["parsed_data"]
        profile_data = parsed_result.get("profile") or build_profile_from_sections(parsed_data)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=f"CV parsing failed: {str(e)}")
    except Exception as e:
        err_str = str(e).lower()
        if "429" in err_str or "quota" in err_str or "rate limit" in err_str or "resource exhausted" in err_str:
            raise HTTPException(
                status_code=429,
                detail="The AI parser is temporarily rate-limited by Gemini API. Please wait a few seconds and try again."
            )
        raise HTTPException(status_code=500, detail=f"Unexpected error during parsing: {str(e)}")

    if not any([
        parsed_data.get("skills"),
        parsed_data.get("experience"),
        parsed_data.get("education"),
        parsed_data.get("projects"),
    ]):
        raise HTTPException(
            status_code=422,
            detail="Could not extract any information from CV. Please check the file content."
        )

    # ── 4. Upload original file to Supabase Storage ───────────────────────────
    content_type = file.content_type or (
        "application/pdf" if filename_lower.endswith(".pdf")
        else "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
    try:
        file_url = await upload_cv_file(
            file_bytes=file_bytes,
            filename=filename,
            user_id=user_id,
            content_type=content_type,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Storage upload failed: {str(e)}")

    # ── 5. Replace old CV for this user (cascade removes old cv_chunks) ───────
    try:
        await supabase.table("cvs").delete().eq("user_id", user_id).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to remove previous CV: {str(e)}")

    # ── 6. Insert metadata into cvs ───────────────────────────────────────────
    cv_id = str(uuid.uuid4())
    parsed_at = datetime.utcnow().isoformat()

    try:
        result = await supabase.table("cvs").insert({
            "id": cv_id,
            "user_id": user_id,
            "file_name": filename,
            "file_url": file_url,
            "parsed_at": parsed_at,
        }).execute()

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to save CV metadata")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error saving CV metadata: {str(e)}")

    # ── 7. Chunk parsed JSON by section ──────────────────────────────────────
    chunks = chunk_cv_sections(parsed_data, cv_id=cv_id, user_id=user_id)

    chunks_stored = 0

    if chunks:
        # ── 8. Embed each chunk with Gemini gemini-embedding-001 ─────────────
        try:
            chunk_texts = [c["content"] for c in chunks]
            embeddings = embed_documents(chunk_texts)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Embedding failed: {str(e)}")

        # ── 9. Insert chunks + embeddings into cv_chunks ──────────────────────
        rows = [
            {
                "user_id": chunk["user_id"],
                "cv_id": chunk["cv_id"],
                "section": chunk["section"],
                "content": chunk["content"],
                "embedding": embedding,
            }
            for chunk, embedding in zip(chunks, embeddings)
        ]

        try:
            await supabase.table("cv_chunks").insert(rows).execute()
            chunks_stored = len(rows)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to store CV chunks: {str(e)}")

    # ── 10. Return ────────────────────────────────────────────────────────────
    try:
        profile_data = profile_data or build_profile_from_sections(parsed_data)
        profile = await upsert_profile(
            user_id=user_id,
            cv_id=cv_id,
            profile_data=profile_data,
            parsed_data=parsed_data,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save profile: {str(e)}")

    try:
        await supabase.table("jobs").update({
            "fit_score": None,
            "fit_explanation": None,
            "scored_cv_id": None,
            "fit_score_calculated_at": None,
            "fit_score_version": None,
        }).eq("user_id", user_id).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to invalidate stale job scores: {str(e)}")

    return CVUploadResponse(
        cv_id=cv_id,
        file_name=filename,
        file_url=file_url,
        parsed_data=parsed_data,
        profile=profile,
        chunks_stored=chunks_stored,
        parsed_at=parsed_at,
        message="CV uploaded, parsed, embedded, and stored successfully"
    )


# ── List Endpoint ─────────────────────────────────────────────────────────────

@router.get("/list", response_model=list[CVMetadata])
async def list_cvs(
    user_id: str = Query(..., description="User UUID from Supabase Auth")
):
    """List all CVs for a user, newest first."""
    try:
        result = await supabase.table("cvs") \
            .select("id, user_id, file_name, file_url, parsed_at, created_at") \
            .eq("user_id", user_id) \
            .order("created_at", desc=True) \
            .execute()

        return result.data or []

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch CVs: {str(e)}")


# ── Search Endpoint ───────────────────────────────────────────────────────────

@router.get("/search")
async def search_cv(
    user_id: str = Query(..., description="User UUID from Supabase Auth"),
    q: str = Query(..., description="Search query"),
    top_k: int = Query(5, ge=1, le=20, description="Number of results to return"),
):
    """
    Hybrid search over CV chunks for a user.
    Uses Supabase hybrid_search RPC (dense + BM25 + RRF).
    """
    if not q.strip():
        raise HTTPException(status_code=400, detail="Search query cannot be empty")

    try:
        results = await hybrid_search(query=q, user_id=user_id, match_count=top_k)
        return {"results": results, "count": len(results)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


# ── Get Single CV ─────────────────────────────────────────────────────────────

@router.get("/profile", response_model=ProfileResponse)
async def get_profile(
    user_id: str = Query(..., description="User UUID from Supabase Auth"),
):
    """Get the editable profile generated from the user's active CV."""
    try:
        profile = await fetch_profile(user_id)
        return ProfileResponse(profile=profile)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch profile: {str(e)}")


@router.patch("/profile", response_model=UserProfile)
async def update_profile(
    request: ProfilePayload,
    user_id: str = Query(..., description="User UUID from Supabase Auth"),
):
    """Save user edits to the editable profile."""
    try:
        return await save_profile_edits(user_id, request.model_dump())
    except ValueError:
        raise HTTPException(status_code=404, detail="Profile not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update profile: {str(e)}")


@router.get("/{cv_id:uuid}", response_model=CVMetadata)
async def get_cv(
    cv_id: UUID,
    user_id: str = Query(..., description="User UUID from Supabase Auth"),
):
    """Get a specific CV by ID."""
    try:
        result = await supabase.table("cvs") \
            .select("id, user_id, file_name, file_url, parsed_at, created_at") \
            .eq("id", str(cv_id)) \
            .eq("user_id", user_id) \
            .single() \
            .execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="CV not found")

        return result.data

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch CV: {str(e)}")
