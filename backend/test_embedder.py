"""
Embedder smoke test - requires GOOGLE_API_KEY in backend/.env
Run: python test_embedder.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv

load_dotenv()

from services.embedder import EMBEDDING_DIMENSIONS, embed_documents, embed_query


def test_embedder():
    print("=== Gemini Embedder Test ===\n")

    print("Testing embed_documents...")
    doc_embeddings = embed_documents([
        "Python FastAPI backend developer with PostgreSQL experience",
        "React TypeScript frontend engineer",
    ])
    assert len(doc_embeddings) == 2, f"Expected 2 embeddings, got {len(doc_embeddings)}"
    assert len(doc_embeddings[0]) == EMBEDDING_DIMENSIONS, (
        f"Expected {EMBEDDING_DIMENSIONS} dims, got {len(doc_embeddings[0])}"
    )
    assert len(doc_embeddings[1]) == EMBEDDING_DIMENSIONS, (
        f"Expected {EMBEDDING_DIMENSIONS} dims, got {len(doc_embeddings[1])}"
    )
    print(f"OK embed_documents: 2 embeddings x {len(doc_embeddings[0])} dims\n")

    print("Testing embed_query...")
    query_embedding = embed_query("backend Python role")
    assert len(query_embedding) == EMBEDDING_DIMENSIONS, (
        f"Expected {EMBEDDING_DIMENSIONS} dims, got {len(query_embedding)}"
    )
    print(f"OK embed_query: {len(query_embedding)} dims\n")

    assert any(v != 0 for v in doc_embeddings[0]), "Embedding should not be all zeros"
    assert any(v != 0 for v in query_embedding), "Query embedding should not be all zeros"
    print("OK Embeddings contain non-zero values\n")

    print("=== Gemini Embedding Test PASSED ===")


if __name__ == "__main__":
    test_embedder()
