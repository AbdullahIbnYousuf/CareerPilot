"""
Embedder Service - CareerPilot

Uses Gemini text embeddings for all CV chunks, search queries, and job
descriptions. The public interface stays provider-agnostic so search and fit
score services do not need to know which embedding provider is active.
"""

import os
from typing import Any, Literal

import google.generativeai as genai

EMBEDDING_MODEL = "models/embedding-001"
EMBEDDING_DIMENSIONS = 768

InputType = Literal["document", "query"]


def _configure_gemini() -> None:
    genai.configure(api_key=os.environ.get("GOOGLE_API_KEY", ""))


def _validate_embedding(embedding: list[float]) -> list[float]:
    if len(embedding) != EMBEDDING_DIMENSIONS:
        raise ValueError(
            f"Gemini embedding returned {len(embedding)} dimensions; "
            f"expected {EMBEDDING_DIMENSIONS}."
        )
    return embedding


def _extract_embeddings(response: dict[str, Any], expected_count: int) -> list[list[float]]:
    embeddings = response.get("embedding")
    if expected_count == 1 and embeddings and isinstance(embeddings[0], (float, int)):
        embeddings = [embeddings]

    if not isinstance(embeddings, list) or len(embeddings) != expected_count:
        raise ValueError(f"Expected {expected_count} Gemini embeddings, got {type(embeddings).__name__}.")

    return [_validate_embedding([float(value) for value in embedding]) for embedding in embeddings]


def _embed(texts: list[str], input_type: InputType) -> list[list[float]]:
    cleaned = [text.strip() for text in texts if text and text.strip()]
    if not cleaned:
        return []

    task_type = "retrieval_document" if input_type == "document" else "retrieval_query"
    _configure_gemini()
    response = genai.embed_content(
        model=EMBEDDING_MODEL,
        content=cleaned,
        task_type=task_type,
        output_dimensionality=EMBEDDING_DIMENSIONS,
    )
    return _extract_embeddings(response, expected_count=len(cleaned))


def embed_documents(texts: list[str]) -> list[list[float]]:
    """Embed CV chunk texts using Gemini retrieval-document embeddings."""
    return _embed(texts, input_type="document")


def embed_query(text: str) -> list[float]:
    """Embed a search query or job description using Gemini retrieval-query embeddings."""
    embeddings = _embed([text], input_type="query")
    if not embeddings:
        raise ValueError("Cannot embed an empty query.")
    return embeddings[0]
