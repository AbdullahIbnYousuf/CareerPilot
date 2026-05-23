"""
Section-aware CV chunking — CareerPilot Day 3.

Rule: one chunk per non-empty allowed section.
Never do character/token splitting on CVs.
"""

from typing import TypedDict

ALLOWED_SECTIONS = ("skills", "experience", "education", "projects")


class CVChunk(TypedDict):
    user_id: str
    cv_id: str
    section: str
    content: str


def chunk_cv_sections(
    parsed_data: dict[str, str],
    cv_id: str,
    user_id: str,
) -> list[CVChunk]:
    """
    Convert a parsed CV dict into one chunk per non-empty section.

    Section labels must exactly match the database check constraint:
        skills | experience | education | projects

    Args:
        parsed_data: Dict with keys skills, experience, education, projects.
        cv_id: UUID of the cv row in the cvs table.
        user_id: UUID of the Supabase Auth user.

    Returns:
        List of CVChunk dicts (may be empty if all sections are empty).
    """
    chunks: list[CVChunk] = []

    for section in ALLOWED_SECTIONS:
        content = str(parsed_data.get(section, "")).strip()
        if not content:
            continue

        chunks.append({
            "user_id": user_id,
            "cv_id": cv_id,
            "section": section,
            "content": content,
        })

    return chunks
