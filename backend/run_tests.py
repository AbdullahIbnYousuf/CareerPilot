import asyncio
import os
import sys
from dotenv import load_dotenv

# Load env variables
load_dotenv()

# Set PYTHONPATH
sys.path.append(os.path.dirname(os.path.abspath(__file__)))


async def test_voyage():
    print("Testing Voyage AI Embedding...")
    try:
        from services.embedder import embed_query
        emb = embed_query("Python Developer")
        print(f"  [SUCCESS] Voyage AI works! Vector dimensions: {len(emb)}")
        return True
    except Exception as e:
        print(f"  [ERROR] Voyage AI failed: {e}")
        return False


async def test_gemini():
    print("Testing Gemini 2.0 Flash...")
    try:
        from google import genai
        client = genai.Client(api_key=os.environ.get("GOOGLE_API_KEY", ""))
        resp = client.models.generate_content(
            model="gemini-2.0-flash",
            contents="Say 'Gemini is online!' in one word."
        )
        print(f"  [SUCCESS] Gemini works! Response: '{resp.text.strip()}'")
        return True
    except Exception as e:
        print(f"  [ERROR] Gemini failed: {e}")
        return False


async def test_redis():
    print("Testing Upstash Redis Cache...")
    try:
        from services.cache import cache_jobs, get_cached_jobs
        test_jobs = [{"title": "Software Engineer Test", "company": "Test Inc"}]
        await cache_jobs(test_jobs, "test-query", "test-loc")
        cached = await get_cached_jobs("test-query", "test-loc")
        if cached == test_jobs:
            print("  [SUCCESS] Upstash Redis cache read/write works!")
            return True
        else:
            print(f"  [ERROR] Upstash Redis data mismatch: {cached}")
            return False
    except Exception as e:
        print(f"  [ERROR] Upstash Redis failed: {e}")
        return False


async def test_groq():
    print("Testing Groq Llama 3.3...")
    try:
        from groq import Groq
        groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY", ""))
        chat_completion = groq_client.chat.completions.create(
            messages=[{"role": "user", "content": "Say hello in one word."}],
            model="llama-3.3-70b-versatile",
        )
        print(f"  [SUCCESS] Groq works! Response: '{chat_completion.choices[0].message.content.strip()}'")
        return True
    except Exception as e:
        print(f"  [ERROR] Groq failed: {e}")
        return False


async def test_jsearch():
    print("Testing JSearch (RapidAPI)...")
    try:
        from services.agent import _search_jsearch
        jobs = await _search_jsearch("Python", "Dhaka")
        print(f"  [SUCCESS] JSearch returned {len(jobs)} jobs!")
        return True
    except Exception as e:
        print(f"  [ERROR] JSearch failed: {e}")
        return False


async def test_remotive():
    print("Testing Remotive API...")
    try:
        from services.agent import _search_remotive
        jobs = await _search_remotive("Python")
        print(f"  [SUCCESS] Remotive returned {len(jobs)} jobs!")
        return True
    except Exception as e:
        print(f"  [ERROR] Remotive failed: {e}")
        return False


async def test_tavily():
    print("Testing Tavily Search...")
    try:
        from services.agent import _search_tavily
        jobs = await _search_tavily("Python Developer", "Dhaka")
        print(f"  [SUCCESS] Tavily search returned {len(jobs)} jobs!")
        return True
    except Exception as e:
        print(f"  [ERROR] Tavily failed: {e}")
        return False


async def main():
    print("=" * 60)
    print("CareerPilot Services Integration Tests")
    print("=" * 60)
    
    results = {}
    results["Voyage AI"] = await test_voyage()
    results["Gemini"] = await test_gemini()
    results["Upstash Redis"] = await test_redis()
    results["Groq"] = await test_groq()
    results["JSearch"] = await test_jsearch()
    results["Remotive"] = await test_remotive()
    results["Tavily"] = await test_tavily()
    
    print("\n" + "=" * 60)
    print("Test Summary:")
    print("=" * 60)
    all_ok = True
    for service, status in results.items():
        status_str = "PASS" if status else "FAIL"
        print(f"{service:20}: {status_str}")
        if not status:
            all_ok = False
            
    if all_ok:
        print("\nAll integration tests passed successfully!")
    else:
        print("\nSome integration tests failed. Please check the logs above.")


if __name__ == "__main__":
    asyncio.run(main())
