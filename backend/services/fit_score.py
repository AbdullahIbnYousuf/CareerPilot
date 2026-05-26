"""
Fit Score Service — CareerPilot

Algorithm (from AGENTS.md):
  Section weights: skills 40%, experience 35%, education 15%, projects 10%
  1. Embed the job description
  2. Hybrid search for top-k CV chunks per section
  3. Compute cosine similarity between JD embedding and each chunk
  4. Weighted average across sections
  5. Multiply by 100 → integer 0–100
  6. Pass score + evidence to Groq for one-sentence explanation

NEVER ask the LLM to guess a score.
"""

import os
import numpy as np
import google.generativeai as genai
from services.embedder import embed_query, embed_documents
from services.searcher import search_by_section_preembedded

_GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY", "")

def _get_gemini_client():
    genai.configure(api_key=_GOOGLE_API_KEY)
    return genai.GenerativeModel('gemini-2.0-flash-exp')

SECTION_WEIGHTS: dict[str, float] = {
    "skills":     0.40,
    "experience": 0.35,
    "education":  0.15,
    "projects":   0.10,
}


def _cosine(a: list[float], b: list[float]) -> float:
    va = np.array(a, dtype=float)
    vb = np.array(b, dtype=float)
    denom = np.linalg.norm(va) * np.linalg.norm(vb)
    if denom == 0:
        return 0.0
    return float(np.dot(va, vb) / denom)


async def compute_fit_score(
    job_description: str,
    user_id: str,
) -> dict:
    """
    Compute a programmatic fit score (0–100) for a user's CV against a job description.

    Returns:
        {
            "score": int,           # 0–100
            "explanation": str,     # one-sentence from Groq
            "section_scores": dict  # per-section cosine scores
        }
    """
    # 1. Embed job description once
    jd_embedding = embed_query(job_description)

    # 2. Fetch chunks for all sections using pre-embedded query
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

    # 3. Gather all chunk texts and batch embed them in a single Voyage call
    all_texts = []
    for section, chunks in section_chunks.items():
        for c in chunks:
            all_texts.append(c["content"])

    embeddings_map = {}
    if all_texts:
        embeddings = embed_documents(all_texts)
        embeddings_map = {text: emb for text, emb in zip(all_texts, embeddings)}

    # 4. Calculate similarities per section
    section_scores: dict[str, float] = {}
    evidence_snippets: list[str] = []

    for section in SECTION_WEIGHTS:
        chunks = section_chunks.get(section, [])
        if not chunks:
            section_scores[section] = 0.0
            continue

        chunk_texts = [c["content"] for c in chunks]
        chunk_embeddings = [embeddings_map[text] for text in chunk_texts]

        sims = [_cosine(jd_embedding, emb) for emb in chunk_embeddings]
        section_scores[section] = float(np.mean(sims))

        # Collect best snippet for explanation
        best_idx = int(np.argmax(sims))
        evidence_snippets.append(f"[{section}] {chunk_texts[best_idx][:200]}")

    # Weighted average
    weighted_score = sum(
        section_scores.get(sec, 0.0) * weight
        for sec, weight in SECTION_WEIGHTS.items()
    )
    score_int = min(100, max(0, round(weighted_score * 100)))

    # Gemini one-sentence explanation
    evidence_text = "\n".join(evidence_snippets) if evidence_snippets else "No CV data available."
    explanation_prompt = (
        f"Job description excerpt: {job_description[:500]}\n\n"
        f"Candidate CV evidence:\n{evidence_text}\n\n"
        f"The candidate's fit score is {score_int}/100. "
        "In exactly ONE sentence, explain why this score makes sense, "
        "highlighting the strongest match or biggest gap."
    )
    
    # Simple fallback in case Gemini rate limit hits
    try:
        model = _get_gemini_client()
        gemini_response = model.generate_content(explanation_prompt)
        explanation = (gemini_response.text or "").strip()
    except Exception as e:
        explanation = f"Fit score computed programmatically is {score_int}/100. (AI explanation temporarily unavailable due to rate limits)"

    return {
        "score": score_int,
        "explanation": explanation,
        "section_scores": {k: round(v * 100, 1) for k, v in section_scores.items()},
    }
