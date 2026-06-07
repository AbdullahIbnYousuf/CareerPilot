"""
Profile service for CV-derived editable user profiles.

The CV parser builds the first profile draft during upload. This service
normalizes, stores, and updates that editable profile record.
"""

import uuid
from datetime import datetime
from typing import Any

from db.supabase import supabase
from services.chunker import chunk_cv_sections
from services.embedder import embed_documents

PROFILE_COLUMNS = (
    "user_id, active_cv_id, full_name, headline, location, email, phone, "
    "links, summary, skills, experience, education, projects, certifications, "
    "raw_sections, generated_at, created_at, updated_at"
)

def _empty_profile() -> dict[str, Any]:
    return {
        "full_name": "",
        "headline": "",
        "location": "",
        "email": "",
        "phone": "",
        "links": [],
        "summary": "",
        "skills": [],
        "experience": [],
        "education": [],
        "projects": [],
        "certifications": [],
    }


def _as_string(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    return str(value).strip()


def _as_string_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [item.strip() for item in value if isinstance(item, str) and item.strip()]
    if isinstance(value, str):
        return [item.strip() for item in value.split(",") if item.strip()]
    return []


def _normalize_links(value: Any) -> list[dict[str, str]]:
    if not isinstance(value, list):
        return []

    links: list[dict[str, str]] = []
    for item in value:
        if isinstance(item, str) and item.strip():
            links.append({"label": item.strip(), "url": item.strip()})
        elif isinstance(item, dict):
            label = _as_string(item.get("label"))
            url = _as_string(item.get("url"))
            if label or url:
                links.append({"label": label or url, "url": url})
    return links


def _normalize_experience(value: Any) -> list[dict[str, str]]:
    if not isinstance(value, list):
        return []

    normalized: list[dict[str, str]] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        entry = {
            "title": _as_string(item.get("title")),
            "company": _as_string(item.get("company")),
            "location": _as_string(item.get("location")),
            "start_date": _as_string(item.get("start_date")),
            "end_date": _as_string(item.get("end_date")),
            "description": _as_string(item.get("description")),
        }
        if any(entry.values()):
            normalized.append(entry)
    return normalized


def _normalize_education(value: Any) -> list[dict[str, str]]:
    if not isinstance(value, list):
        return []

    normalized: list[dict[str, str]] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        entry = {
            "institution": _as_string(item.get("institution")),
            "degree": _as_string(item.get("degree")),
            "field": _as_string(item.get("field")),
            "start_year": _as_string(item.get("start_year")),
            "end_year": _as_string(item.get("end_year")),
            "details": _as_string(item.get("details")),
        }
        if any(entry.values()):
            normalized.append(entry)
    return normalized


def _normalize_projects(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []

    normalized: list[dict[str, Any]] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        entry = {
            "title": _as_string(item.get("title")),
            "description": _as_string(item.get("description")),
            "technologies": _as_string_list(item.get("technologies")),
            "url": _as_string(item.get("url")),
        }
        if entry["title"] or entry["description"] or entry["technologies"] or entry["url"]:
            normalized.append(entry)
    return normalized


def normalize_profile(profile: dict[str, Any]) -> dict[str, Any]:
    """Normalize an LLM or client profile payload into the persisted shape."""
    base = _empty_profile()
    base.update({
        "full_name": _as_string(profile.get("full_name")),
        "headline": _as_string(profile.get("headline")),
        "location": _as_string(profile.get("location")),
        "email": _as_string(profile.get("email")),
        "phone": _as_string(profile.get("phone")),
        "links": _normalize_links(profile.get("links")),
        "summary": _as_string(profile.get("summary")),
        "skills": _as_string_list(profile.get("skills")),
        "experience": _normalize_experience(profile.get("experience")),
        "education": _normalize_education(profile.get("education")),
        "projects": _normalize_projects(profile.get("projects")),
        "certifications": _as_string_list(profile.get("certifications")),
    })
    return base


def _join_lines(lines: list[str]) -> str:
    return "\n".join(line for line in lines if line.strip())


def profile_to_sections(profile_data: dict[str, Any]) -> dict[str, str]:
    """Convert normalized profile data into the four canonical CV sections."""
    profile = normalize_profile(profile_data)

    skill_lines = []
    if profile["skills"]:
        skill_lines.append("Skills: " + ", ".join(profile["skills"]))
    if profile["certifications"]:
        skill_lines.append("Certifications: " + ", ".join(profile["certifications"]))

    experience_lines = []
    if profile["summary"]:
        experience_lines.append("Summary: " + profile["summary"])
    for item in profile["experience"]:
        heading = " - ".join(
            value
            for value in [item["title"], item["company"], item["location"]]
            if value
        )
        dates = " to ".join(
            value for value in [item["start_date"], item["end_date"]] if value
        )
        parts = [heading, dates, item["description"]]
        experience_lines.append(_join_lines(parts))

    education_lines = []
    for item in profile["education"]:
        degree = " ".join(value for value in [item["degree"], item["field"]] if value)
        years = " to ".join(
            value for value in [item["start_year"], item["end_year"]] if value
        )
        parts = [item["institution"], degree, years, item["details"]]
        education_lines.append(_join_lines(parts))

    project_lines = []
    for item in profile["projects"]:
        technologies = ", ".join(item["technologies"])
        parts = [
            item["title"],
            f"Technologies: {technologies}" if technologies else "",
            item["url"],
            item["description"],
        ]
        project_lines.append(_join_lines(parts))

    return {
        "skills": _join_lines(skill_lines),
        "experience": "\n\n".join(line for line in experience_lines if line.strip()),
        "education": "\n\n".join(line for line in education_lines if line.strip()),
        "projects": "\n\n".join(line for line in project_lines if line.strip()),
    }


def has_meaningful_profile_content(profile_data: dict[str, Any]) -> bool:
    """Return true when profile data can produce useful CV intelligence."""
    profile = normalize_profile(profile_data)
    return bool(
        profile["summary"]
        or profile["skills"]
        or profile["experience"]
        or profile["education"]
        or profile["projects"]
        or profile["certifications"]
    )


def build_profile_from_sections(parsed_data: dict[str, str]) -> dict[str, Any]:
    """Build a coarse editable profile from already parsed CV sections."""
    profile = _empty_profile()
    profile["skills"] = _as_string_list(parsed_data.get("skills", ""))

    experience = _as_string(parsed_data.get("experience"))
    if experience:
        profile["experience"] = [{
            "title": "",
            "company": "",
            "location": "",
            "start_date": "",
            "end_date": "",
            "description": experience,
        }]

    education = _as_string(parsed_data.get("education"))
    if education:
        profile["education"] = [{
            "institution": "",
            "degree": "",
            "field": "",
            "start_year": "",
            "end_year": "",
            "details": education,
        }]

    projects = _as_string(parsed_data.get("projects"))
    if projects:
        profile["projects"] = [{
            "title": "",
            "description": projects,
            "technologies": [],
            "url": "",
        }]

    return profile


async def upsert_profile(
    user_id: str,
    cv_id: str,
    profile_data: dict[str, Any],
    parsed_data: dict[str, str],
) -> dict[str, Any]:
    """Create or replace the editable profile for a user's active CV."""
    normalized = normalize_profile(profile_data)
    now = datetime.utcnow().isoformat()
    row = {
        **normalized,
        "user_id": user_id,
        "active_cv_id": cv_id,
        "raw_sections": parsed_data,
        "generated_at": now,
        "updated_at": now,
    }

    result = await supabase.table("profiles").upsert(
        row,
        on_conflict="user_id",
    ).execute()
    return result.data[0] if result.data else row


async def get_profile(user_id: str) -> dict[str, Any] | None:
    """Fetch a user's editable profile."""
    result = await supabase.table("profiles") \
        .select(PROFILE_COLUMNS) \
        .eq("user_id", user_id) \
        .limit(1) \
        .execute()
    if not result.data:
        return None
    return result.data[0]


async def update_profile(user_id: str, profile_data: dict[str, Any]) -> dict[str, Any]:
    """Persist user edits to an existing profile."""
    normalized = normalize_profile(profile_data)
    row = {
        **normalized,
        "updated_at": datetime.utcnow().isoformat(),
    }

    result = await supabase.table("profiles") \
        .update(row) \
        .eq("user_id", user_id) \
        .execute()

    if result.data:
        return result.data[0]

    existing = await get_profile(user_id)
    if existing is None:
        raise ValueError("Profile not found")
    return existing


def _is_missing_provenance_columns_error(exc: Exception) -> bool:
    text = str(exc).lower()
    return "jobs" in text and (
        "scored_cv_id" in text or "fit_score_calculated_at" in text or "fit_score_version" in text
    ) and (
        "schema cache" in text
        or "pgrst204" in text
        or "42703" in text
        or "does not exist" in text
    )


async def _invalidate_job_scores(user_id: str) -> None:
    try:
        await supabase.table("jobs").update({
            "fit_score": None,
            "fit_explanation": None,
            "scored_cv_id": None,
            "fit_score_calculated_at": None,
            "fit_score_version": None,
        }).eq("user_id", user_id).execute()
    except Exception as exc:
        if not _is_missing_provenance_columns_error(exc):
            raise
        await supabase.table("jobs").update({
            "fit_score": None,
            "fit_explanation": None,
        }).eq("user_id", user_id).execute()


async def _cv_exists(user_id: str, cv_id: str) -> bool:
    result = await supabase.table("cvs").select("id") \
        .eq("id", cv_id) \
        .eq("user_id", user_id) \
        .limit(1) \
        .execute()
    return bool(result.data)


async def _create_generated_cv(user_id: str) -> str:
    cv_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    result = await supabase.table("cvs").insert({
        "id": cv_id,
        "user_id": user_id,
        "file_name": "CareerPilot Generated CV",
        "file_url": None,
        "parsed_at": now,
    }).execute()
    if not result.data:
        raise RuntimeError("Failed to create generated CV metadata")
    return cv_id


async def _resolve_profile_cv_id(user_id: str) -> str:
    existing = await get_profile(user_id)
    active_cv_id = existing.get("active_cv_id") if existing else None
    if active_cv_id and await _cv_exists(user_id, str(active_cv_id)):
        return str(active_cv_id)
    return await _create_generated_cv(user_id)


async def save_profile_as_cv_source(
    user_id: str,
    profile_data: dict[str, Any],
) -> dict[str, Any]:
    """Save profile data and refresh the CV chunks used by search and scoring."""
    if not has_meaningful_profile_content(profile_data):
        raise ValueError("Add a summary, skills, experience, education, projects, or certifications before saving.")

    normalized = normalize_profile(profile_data)
    parsed_data = profile_to_sections(normalized)
    cv_id = await _resolve_profile_cv_id(user_id)
    chunks = chunk_cv_sections(parsed_data, cv_id=cv_id, user_id=user_id)

    if not chunks:
        raise ValueError("Add resume content before saving.")

    chunk_texts = [chunk["content"] for chunk in chunks]
    embeddings = embed_documents(chunk_texts)

    await supabase.table("cv_chunks").delete().eq("user_id", user_id).execute()

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
    await supabase.table("cv_chunks").insert(rows).execute()

    profile = await upsert_profile(
        user_id=user_id,
        cv_id=cv_id,
        profile_data=normalized,
        parsed_data=parsed_data,
    )
    await _invalidate_job_scores(user_id)

    return {
        "profile": profile,
        "cv_id": cv_id,
        "chunks_stored": len(rows),
        "message": "Profile built and embedded successfully",
    }
