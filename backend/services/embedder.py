"""
Embedder Service — CareerPilot

Always use: Voyage AI voyage-3
NEVER use: Google Embeddings, OpenAI Embeddings, HuggingFace, sentence-transformers
"""

import os
import voyageai
from typing import Literal

_vo = voyageai.Client(api_key=os.environ.get("VOYAGE_API_KEY", ""))

InputType = Literal["document", "query"]


def embed_documents(texts: list[str]) -> list[list[float]]:
    """Embed a list of document strings (CV chunks) using voyage-3."""
    result = _vo.embed(texts, model="voyage-3", input_type="document")
    return result.embeddings


def embed_query(text: str) -> list[float]:
    """Embed a single query string using voyage-3."""
    result = _vo.embed([text], model="voyage-3", input_type="query")
    return result.embeddings[0]
