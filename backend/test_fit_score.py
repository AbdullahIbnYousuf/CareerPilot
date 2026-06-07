import asyncio
import os
import sys
from unittest.mock import AsyncMock, patch

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.fit_score import FitScoreEvidenceError, compute_fit_score

async def test_fit_score_mismatch():
    print("=== Test Fit Score: Mismatch ===")
    
    mock_chunks = {
        "skills": [{"content": "Customer service, typing, data entry"}],
        "experience": [{"content": "Cashier at retail store, managed register"}],
        "education": [{"content": "High school diploma"}],
        "projects": []
    }
    
    async def mock_search(query, query_embedding, user_id, section, match_count=3):
        return mock_chunks.get(section, [])
        
    def mock_embed_query(text):
        return [1.0] * 768
        
    async def mock_attach_stored_embeddings(chunks):
        return [{**chunk, "embedding": [0.0] * 768} for chunk in chunks]
        
    with patch("services.fit_score.search_by_section_preembedded", side_effect=mock_search), \
         patch("services.fit_score.embed_query", side_effect=mock_embed_query), \
         patch("services.fit_score._attach_stored_embeddings", side_effect=mock_attach_stored_embeddings), \
         patch("services.fit_score.get_active_cv_id", new=AsyncMock(return_value="cv-1")):
         
        result = await compute_fit_score(
            job_description="Senior Machine Learning Engineer. Python, PyTorch, Kubernetes, LLMs.",
            user_id="test-user-id",
            include_explanation=False,
        )
        print("Result:", result)
        assert result["score"] < 50
        print("[OK] Mismatch test passed!")

async def test_fit_score_match():
    print("=== Test Fit Score: Match ===")
    
    mock_chunks = {
        "skills": [{"content": "Python, PyTorch, TensorFlow, LLMs, Kubernetes, Docker, SQL, FastAPI"}],
        "experience": [{"content": "Senior ML Engineer at TechCorp. Built production LLM pipelines, deployed on Kubernetes."}],
        "education": [{"content": "PhD in Computer Science, Machine Learning specialization, Stanford University"}],
        "projects": [{"content": "Open-source RAG framework with PyTorch and Gemini embeddings. 2k GitHub stars."}]
    }
    
    async def mock_search(query, query_embedding, user_id, section, match_count=3):
        return mock_chunks.get(section, [])
        
    def mock_embed_query(text):
        return [1.0] * 768
        
    async def mock_attach_stored_embeddings(chunks):
        return [{**chunk, "embedding": [1.0] * 768} for chunk in chunks]
        
    with patch("services.fit_score.search_by_section_preembedded", side_effect=mock_search), \
         patch("services.fit_score.embed_query", side_effect=mock_embed_query), \
         patch("services.fit_score._attach_stored_embeddings", side_effect=mock_attach_stored_embeddings), \
         patch("services.fit_score.get_active_cv_id", new=AsyncMock(return_value="cv-1")):
         
        result = await compute_fit_score(
            job_description="Senior Machine Learning Engineer. Python, PyTorch, Kubernetes, LLMs.",
            user_id="test-user-id",
            include_explanation=False,
        )
        print("Result:", result)
        assert result["score"] > 70
        print("[OK] Match test passed!")


async def test_fit_score_no_evidence():
    print("=== Test Fit Score: No Evidence ===")

    async def mock_search(query, query_embedding, user_id, section, match_count=3):
        return []

    def mock_embed_query(text):
        return [1.0] * 768

    with patch("services.fit_score.search_by_section_preembedded", side_effect=mock_search), \
         patch("services.fit_score.embed_query", side_effect=mock_embed_query), \
         patch("services.fit_score.get_active_cv_id", new=AsyncMock(return_value="cv-1")):
        try:
            await compute_fit_score(
                job_description="Python backend engineer role.",
                user_id="test-user-id",
                include_explanation=False,
            )
        except FitScoreEvidenceError:
            print("[OK] No evidence test passed!")
            return

    raise AssertionError("Expected FitScoreEvidenceError for missing CV evidence")

async def main():
    try:
        await test_fit_score_mismatch()
        print()
        await test_fit_score_match()
        print()
        await test_fit_score_no_evidence()
        print("\nAll fit score mock tests passed successfully!")
    except Exception as e:
        print("\nTest failed:", e)

if __name__ == "__main__":
    asyncio.run(main())
