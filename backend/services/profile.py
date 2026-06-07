"""
Profile service for CV-derived editable user profiles.

The CV parser builds the first profile draft during upload. This service
normalizes, stores, and updates that editable profile record.
"""

from datetime import datetime
from typing import Any

from db.supabase import supabase

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
