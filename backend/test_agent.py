import asyncio
import os
import sys
from unittest.mock import patch, AsyncMock
from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
load_dotenv()

from services.agent import graph, hunt_jobs

# Mock search results for tests
mock_jobs_first_try = []
mock_jobs_retry = [
    {"title": "Software Developer", "company": "DevCorp", "location": "Dhaka", "description": "Python developer"},
    {"title": "Data Engineer", "company": "DataCorp", "location": "Dhaka", "description": "Data pipelines"},
    {"title": "Senior ML Engineer", "company": "AI Labs", "location": "Dhaka", "description": "Machine learning"}
]

async def mock_jsearch(query, location=""):
    # If it's a broad query (from retry), return jobs
    if "Specialist" in query:
        return []  # Initial failed search to trigger retry
    return mock_jobs_retry

async def mock_remotive(query):
    return []

async def mock_tavily(query, location=""):
    return []

async def mock_fit_score(job_description, user_id):
    # Determine score based on job description contents
    if "machine learning" in job_description.lower() or "ml" in job_description.lower():
        return {"score": 90, "explanation": "Strong ML match."}
    elif "data" in job_description.lower():
        return {"score": 60, "explanation": "Moderate data match."}
    return {"score": 40, "explanation": "Basic developer match."}

async def test_agent_retry_and_scoring():
    print("=== Testing LangGraph Agent Workflow (with mock retries & scoring) ===")
    
    with patch("services.agent._search_jsearch", side_effect=mock_jsearch), \
         patch("services.agent._search_remotive", side_effect=mock_remotive), \
         patch("services.agent._search_tavily", side_effect=mock_tavily), \
         patch("services.agent.compute_fit_score", side_effect=mock_fit_score), \
         patch("services.agent.get_cached_jobs", return_value=None), \
         patch("services.agent.cache_jobs", return_value=None):
         
        # Run hunt_jobs with a specific query that will fail initially ("Senior Deep Learning Specialist")
        # to verify query simplification and retry logic!
        results = await hunt_jobs(
            query="Senior Deep Learning Specialist",
            location="Dhaka",
            user_id="test-user-id"
        )
        
        print(f"Workflow completed! Returned {len(results)} jobs.")
        for idx, job in enumerate(results):
            print(f"Job {idx+1}: {job['title']} at {job['company']} - Score: {job['fit_score']} - Expl: {job['fit_explanation']}")
            
        assert len(results) == 3
        # Assert sort order: ML Engineer (score 90) -> Data Engineer (score 60) -> Software Developer (score 40)
        assert results[0]["fit_score"] == 90
        assert results[1]["fit_score"] == 60
        assert results[2]["fit_score"] == 40
        print("[OK] LangGraph retry, scoring, and sorting verified perfectly!")

async def main():
    try:
        await test_agent_retry_and_scoring()
        print("\nAll LangGraph agent tests passed successfully!")
    except Exception as e:
        print("\nTest failed:", e)

if __name__ == "__main__":
    asyncio.run(main())
