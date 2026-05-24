import asyncio
import os
import sys
from unittest.mock import patch, AsyncMock
from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
load_dotenv()

from services.fit_score import compute_fit_score

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
        return [1.0] * 1024
        
    def mock_embed_documents(texts):
        return [[0.0] * 1024 for _ in texts]
        
    with patch("services.fit_score.search_by_section_preembedded", side_effect=mock_search), \
         patch("services.fit_score.embed_query", side_effect=mock_embed_query), \
         patch("services.fit_score.embed_documents", side_effect=mock_embed_documents):
         
        result = await compute_fit_score(
            job_description="Senior Machine Learning Engineer. Python, PyTorch, Kubernetes, LLMs.",
            user_id="test-user-id"
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
        "projects": [{"content": "Open-source RAG framework with PyTorch and Voyage embeddings. 2k GitHub stars."}]
    }
    
    async def mock_search(query, query_embedding, user_id, section, match_count=3):
        return mock_chunks.get(section, [])
        
    def mock_embed_query(text):
        return [1.0] * 1024
        
    def mock_embed_documents(texts):
        return [[1.0] * 1024 for _ in texts]
        
    with patch("services.fit_score.search_by_section_preembedded", side_effect=mock_search), \
         patch("services.fit_score.embed_query", side_effect=mock_embed_query), \
         patch("services.fit_score.embed_documents", side_effect=mock_embed_documents):
         
        result = await compute_fit_score(
            job_description="Senior Machine Learning Engineer. Python, PyTorch, Kubernetes, LLMs.",
            user_id="test-user-id"
        )
        print("Result:", result)
        assert result["score"] > 70
        print("[OK] Match test passed!")

async def main():
    try:
        await test_fit_score_mismatch()
        print()
        await test_fit_score_match()
        print("\nAll fit score mock tests passed successfully!")
    except Exception as e:
        print("\nTest failed:", e)

if __name__ == "__main__":
    asyncio.run(main())
