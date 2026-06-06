"""
Fit Score Service - CareerPilot

The numeric score is computed programmatically from Gemini embeddings and stored
CV chunk vectors. Gemini generation is used only for one-sentence explanations.
"""

import json
import re

import google.generativeai as genai
import numpy as np

from db.supabase import supabase
from services.embedder import embed_query
from services.parser import generate_content_with_fallback
from services.searcher import search_by_section_preembedded

SECTION_WEIGHTS: dict[str, float] = {
    "skills": 0.40,
    "experience": 0.35,
    "education": 0.15,
    "projects": 0.10,
}

FIT_SCORE_VERSION = "fit-v2"

_ROLE_STOPWORDS = {
    "a",
    "an",
    "and",
    "at",
    "for",
    "in",
    "job",
    "jobs",
    "me",
    "of",
    "remote",
    "role",
    "roles",
    "show",
    "the",
    "to",
    "with",
}

_ROLE_ALIASES: dict[str, set[str]] = {
    "ai": {"ai", "artificial", "intelligence", "machine", "learning", "ml", "llm", "llms", "generative"},
    "artificial": {"ai", "artificial", "intelligence", "machine", "learning", "ml", "llm", "llms", "generative"},
    "intelligence": {"ai", "artificial", "intelligence", "machine", "learning", "ml", "llm", "llms", "generative"},
    "llm": {"ai", "artificial", "intelligence", "machine", "learning", "ml", "llm", "llms", "generative"},
    "machine": {"ai", "artificial", "intelligence", "machine", "learning", "ml", "llm", "llms", "generative"},
    "learning": {"ai", "artificial", "intelligence", "machine", "learning", "ml", "llm", "llms", "generative"},
    "ml": {"ai", "artificial", "intelligence", "machine", "learning", "ml", "llm", "llms", "generative"},
    "developer": {"engineer", "engineering", "developer", "software", "programmer"},
    "engineer": {"engineer", "engineering", "developer", "software", "programmer"},
    "software": {"engineer", "engineering", "developer", "software", "programmer"},
    "teacher": {"teacher", "teaching", "educator", "instructor", "trainer", "faculty"},
}


class FitScoreEvidenceError(ValueError):
    """Raised when a user's CV has no usable chunks/embeddings for scoring."""


async def get_active_cv_id(user_id: str) -> str:
    """Resolve and validate the CV that should be used for scoring."""
    active_cv_id = None

    profile_result = await supabase.table("profiles").select(
        "active_cv_id"
    ).eq("user_id", user_id).limit(1).execute()
    if profile_result.data:
        active_cv_id = profile_result.data[0].get("active_cv_id")

    if not active_cv_id:
        cv_result = await supabase.table("cvs").select(
            "id"
        ).eq("user_id", user_id).order("created_at", desc=True).limit(1).execute()
        if cv_result.data:
            active_cv_id = cv_result.data[0].get("id")

    if not active_cv_id:
        raise FitScoreEvidenceError("No active CV found. Upload or re-upload a CV before scoring jobs.")

    chunk_result = await supabase.table("cv_chunks").select(
        "id"
    ).eq("user_id", user_id).eq("cv_id", active_cv_id).limit(1).execute()
    if not chunk_result.data:
        raise FitScoreEvidenceError("No CV chunks with stored embeddings found. Upload or re-upload a CV before scoring jobs.")

    return str(active_cv_id)


def _cosine(a: list[float], b: list[float]) -> float:
    va = np.array(a, dtype=float)
    vb = np.array(b, dtype=float)
    denom = np.linalg.norm(va) * np.linalg.norm(vb)
    if denom == 0:
        return 0.0
    return float(np.dot(va, vb) / denom)


def _parse_embedding(value: object) -> list[float]:
    if isinstance(value, list):
        return [float(v) for v in value]

    if isinstance(value, str):
        cleaned = value.strip()
        if cleaned.startswith("[") and cleaned.endswith("]"):
            return [float(v.strip()) for v in cleaned[1:-1].split(",") if v.strip()]

    return []


async def _attach_stored_embeddings(chunks: list[dict]) -> list[dict]:
    ids = [chunk.get("id") for chunk in chunks if chunk.get("id")]
    if not ids:
        return []

    result = await supabase.table("cv_chunks").select("id, embedding").in_("id", ids).execute()
    embeddings_by_id = {
        row["id"]: _parse_embedding(row.get("embedding"))
        for row in (result.data or [])
    }

    enriched = []
    for chunk in chunks:
        embedding = embeddings_by_id.get(chunk.get("id"), [])
        if embedding:
            enriched.append({**chunk, "embedding": embedding})
    return enriched


def _fallback_explanation(score: int) -> str:
    if score >= 70:
        return f"Strong match at {score}/100 based on weighted CV similarity across skills, experience, education, and projects."
    if score >= 40:
        return f"Partial match at {score}/100 based on weighted CV similarity, with some relevant evidence and some likely gaps."
    return f"Low match at {score}/100 based on weighted CV similarity, suggesting this role has notable gaps against the current CV."


def _build_explanation_prompt(job_description: str, score: int, evidence_snippets: list[str]) -> str:
    evidence_text = "\n".join(evidence_snippets) if evidence_snippets else "No CV data available."
    return (
        f"Job description excerpt: {job_description[:500]}\n\n"
        f"Candidate CV evidence:\n{evidence_text}\n\n"
        f"The candidate's fit score is {score}/100. "
        "In exactly ONE sentence, explain why this score makes sense, "
        "highlighting the strongest match or biggest gap."
    )


def _role_terms(text: str) -> set[str]:
    terms = {
        term
        for term in re.findall(r"[a-z0-9]+", text.lower())
        if len(term) > 1 and term not in _ROLE_STOPWORDS
    }
    return terms


def _term_matches(term: str, target_terms: set[str]) -> bool:
    aliases = _ROLE_ALIASES.get(term, {term})
    return bool(aliases & target_terms)


def _role_relevance_multiplier(search_query: str | None, job_text: str) -> float:
    if not search_query or not search_query.strip():
        return 1.0

    query_terms = _role_terms(search_query)
    target_terms = _role_terms(job_text)
    if not query_terms or not target_terms:
        return 1.0

    matched = sum(1 for term in query_terms if _term_matches(term, target_terms))
    coverage = matched / len(query_terms)
    if coverage >= 0.80:
        return 1.0
    if coverage >= 0.50:
        return 0.80
    if coverage >= 0.25:
        return 0.60
    return 0.45


def generate_fit_explanations(items: list[dict]) -> list[str]:
    """
    Generate explanations for already-computed scores in one Gemini call.
    Falls back deterministically if generation quota is unavailable.
    """
    if not items:
        return []

    prompt_items = []
    for idx, item in enumerate(items, start=1):
        evidence = "\n".join(item.get("evidence_snippets", [])) or "No CV data available."
        prompt_items.append(
            {
                "index": idx,
                "title": item.get("title", ""),
                "score": item.get("score", 0),
                "job_description_excerpt": (item.get("job_description", "") or "")[:400],
                "cv_evidence": evidence,
            }
        )

    prompt = (
        "You are writing concise fit-score explanations for CareerPilot job cards.\n"
        "The scores below were computed programmatically. Do not change, reinterpret, or invent scores.\n"
        "Return ONLY a valid JSON array of strings, in the same order as the input. "
        "Each string must be exactly one sentence and reference the strongest match or biggest gap.\n\n"
        f"Input:\n{json.dumps(prompt_items, ensure_ascii=False)}"
    )

    try:
        response = generate_content_with_fallback(
            prompt,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                temperature=0.2,
            ),
        )
        parsed = json.loads((response.text or "").strip())
        if isinstance(parsed, list) and len(parsed) == len(items):
            return [
                str(value).strip() or _fallback_explanation(int(items[idx].get("score", 0)))
                for idx, value in enumerate(parsed)
            ]
    except Exception:
        pass

    return [_fallback_explanation(int(item.get("score", 0))) for item in items]


async def compute_fit_score(
    job_description: str,
    user_id: str,
    include_explanation: bool = True,
    search_query: str | None = None,
    active_cv_id: str | None = None,
) -> dict:
    """
    Compute a programmatic fit score (0-100) for a user's CV against a job description.
    """
    resolved_cv_id = active_cv_id or await get_active_cv_id(user_id)
    jd_embedding = embed_query(job_description)

    section_chunks = {}
    for section in SECTION_WEIGHTS:
        chunks = await search_by_section_preembedded(
            query=job_description,
            query_embedding=jd_embedding,
            user_id=user_id,
            section=section,
            match_count=3,
        )
        section_chunks[section] = chunks

    section_scores: dict[str, float] = {}
    evidence_snippets: list[str] = []
    usable_evidence_count = 0

    for section in SECTION_WEIGHTS:
        chunks = await _attach_stored_embeddings(section_chunks.get(section, []))
        if not chunks:
            section_scores[section] = 0.0
            continue

        usable_evidence_count += len(chunks)
        chunk_texts = [chunk["content"] for chunk in chunks]
        sims = [_cosine(jd_embedding, chunk["embedding"]) for chunk in chunks]
        section_scores[section] = float(np.mean(sims))

        best_idx = int(np.argmax(sims))
        evidence_snippets.append(f"[{section}] {chunk_texts[best_idx][:200]}")

    if usable_evidence_count == 0:
        raise FitScoreEvidenceError("No CV chunks with stored embeddings found. Upload or re-upload a CV before scoring jobs.")

    weighted_score = sum(
        section_scores.get(section, 0.0) * weight
        for section, weight in SECTION_WEIGHTS.items()
    )
    role_multiplier = _role_relevance_multiplier(search_query, job_description)
    score_int = min(100, max(0, round(weighted_score * role_multiplier * 100)))

    explanation = _fallback_explanation(score_int)
    if include_explanation:
        try:
            response = generate_content_with_fallback(
                _build_explanation_prompt(job_description, score_int, evidence_snippets)
            )
            explanation = (response.text or "").strip() or explanation
        except Exception:
            explanation = _fallback_explanation(score_int)

    return {
        "score": score_int,
        "explanation": explanation,
        "section_scores": {k: round(v * 100, 1) for k, v in section_scores.items()},
        "evidence_snippets": evidence_snippets,
        "active_cv_id": resolved_cv_id,
        "fit_score_version": FIT_SCORE_VERSION,
        "role_relevance_multiplier": role_multiplier,
    }
