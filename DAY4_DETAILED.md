# DAY 4 - Fit Score & Job Search (Detailed AI-Executable Guide)

**CareerPilot - Codesprint 2026 - DEV1 Backend**

> This guide assumes Day 3 code is ready: parsed CV sections can be chunked, embedded with Voyage AI, stored in `cv_chunks`, and searched through the `hybrid_search` RPC.
> If Supabase access is still blocked, implement code and mark live integration tests as blocked.

**Estimated Time:** 8-10 hours  
**Goal:** Job search returns structured job cards with programmatic fit scores and Gemini explanations.

---

## Day 4 Scope (STRICT)

**What Day 4 DOES:**

- Implement fit score algorithm in `backend/services/fit_score.py`
- Retrieve CV evidence per section using `hybrid_search`
- Compute numeric score programmatically using cosine similarity
- Generate one-sentence explanation with Gemini using real evidence
- Implement job search fallbacks: JSearch -> Remotive -> Tavily
- Add Upstash Redis caching for job searches
- Add backend job search endpoint
- Return structured job cards sorted by fit score

**What Day 4 DOES NOT DO:**

- No frontend job cards UI
- No chat assistant changes
- No LangGraph agent graph yet unless already scaffolded
- No fake fit scores
- No LLM guessing scores
- No raw SQL search in backend
- No paid APIs or forbidden providers

---

## Current Blockers / Manual Tasks

If Supabase access is unavailable, complete service code and unit-level checks only.

- [ ] A real Supabase Auth user UUID exists
- [ ] User has uploaded a CV
- [ ] `cv_chunks` rows exist for that user
- [ ] `hybrid_search` RPC works
- [ ] `VOYAGE_API_KEY` is valid
- [ ] `GOOGLE_API_KEY` is valid
- [ ] `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are valid
- [ ] `JSEARCH_API_KEY` is valid
- [ ] `TAVILY_API_KEY` is valid

**Important:** Fit score live tests require real `cv_chunks`. If those do not exist yet, do not fake PASS results.

---

## Technical Baseline

- Python version: **3.11**
- FastAPI route handlers: `async def`
- Supabase client currently uses sync `create_client`; Supabase calls should be sync unless the whole project converts to async
- Voyage model: `voyage-3`
- Gemini model: `gemini-2.0-flash`
- Groq is not needed for Day 4 unless you already expose agent behavior

---

## What You'll Build Today

```text
User searches: "ML engineer Dhaka"
    |
    v
Check Upstash Redis cache
    |
    v
JSearch first
    |
    v
Fallback to Remotive if empty/fails
    |
    v
Fallback to Tavily if empty/fails
    |
    v
For each job:
  embed job description
  retrieve CV chunks by section
  compute cosine similarity
  weighted average
  Gemini explanation grounded in evidence
    |
    v
Return sorted job cards
```

---

## PHASE 1 - Fit Score Service (2 hours)

### Step 1.1: Verify Section Weights

`backend/services/fit_score.py` must use exactly:

```python
SECTION_WEIGHTS = {
    "skills": 0.40,
    "experience": 0.35,
    "education": 0.15,
    "projects": 0.10,
}
```

Do not add labels like `certifications`, `summary`, or `other`. Certifications belong in `education` or `projects` depending on parser output.

### Step 1.2: Algorithm Requirements

`compute_fit_score(job_description: str, user_id: str) -> dict` must:

1. Embed the job description once with `embed_query()`
2. Search CV chunks per section with `search_by_section_preembedded()`
3. Compute cosine similarity between JD embedding and chunk embeddings
4. Average similarities per section
5. Apply weights
6. Convert to integer 0-100
7. Ask Gemini for one sentence using score + evidence

Expected response:

```json
{
  "score": 83,
  "explanation": "Strong match because the CV shows Python, FastAPI, and PostgreSQL experience aligned with the backend role.",
  "section_scores": {
    "skills": 91.2,
    "experience": 78.4,
    "education": 65.0,
    "projects": 82.1
  }
}
```

### Step 1.3: Avoid Extra Voyage Calls

The job description embedding should be reused for each section search.

Good:

```python
jd_embedding = embed_query(job_description)
chunks = await search_by_section_preembedded(
    query=job_description,
    query_embedding=jd_embedding,
    user_id=user_id,
    section=section,
    match_count=3,
)
```

Avoid embedding the same job description four times.

### Step 1.4: Local Cosine Test

Create `backend/test_fit_score_math.py`.

```python
from services.fit_score import _cosine


def test_cosine():
    assert round(_cosine([1, 0], [1, 0]), 4) == 1.0
    assert round(_cosine([1, 0], [0, 1]), 4) == 0.0
    assert round(_cosine([0, 0], [1, 0]), 4) == 0.0
    print("Cosine math test passed")


if __name__ == "__main__":
    test_cosine()
```

Run:

```bash
python test_fit_score_math.py
```

This test does not require Supabase.

---

## PHASE 2 - Job Search Service (2 hours)

### Step 2.1: Create or Verify `services/job_search.py`

Preferred structure:

```python
async def search_jsearch(query: str, location: str) -> list[dict]: ...
async def search_remotive(query: str) -> list[dict]: ...
async def search_tavily(query: str, location: str) -> list[dict]: ...
async def search_jobs(query: str, location: str) -> list[dict]: ...
```

If the current repo has this logic in `services/agent.py`, either:

- leave it there for now and document it as temporary, or
- move pure search functions to `services/job_search.py` and keep agent orchestration separate for Day 5

For clean architecture, Day 4 should prefer `services/job_search.py`.

### Step 2.2: Job Normalization Format

Every provider must return this normalized shape:

```json
{
  "external_id": "provider-id-or-url",
  "title": "Backend Engineer",
  "company": "Example Ltd",
  "location": "Dhaka",
  "salary_range": "Not specified",
  "deadline": "Not specified",
  "description": "Job description text...",
  "source": "JSearch",
  "apply_url": "https://..."
}
```

Provider mapping:

- JSearch source: `"JSearch"`
- Remotive source: `"Remotive"`
- Tavily source: `"Tavily"`

Do not return provider-specific raw fields to the frontend.

### Step 2.3: Fallback Logic

Search priority is locked:

```text
JSearch -> Remotive -> Tavily
```

Rules:

- Always try JSearch first
- If JSearch fails or returns zero jobs, try Remotive
- If Remotive fails or returns zero jobs, try Tavily
- Return maximum 10 jobs
- Never use Firecrawl, Adzuna, SerpAPI, or ScraperAPI

### Step 2.4: Network Error Handling

Catch provider errors separately:

```python
try:
    jobs = await search_jsearch(query, location)
except httpx.HTTPStatusError as exc:
    logger.warning("JSearch HTTP error: %s", exc.response.status_code)
    jobs = []
except httpx.RequestError as exc:
    logger.warning("JSearch request error: %s", exc)
    jobs = []
```

Use `logging`, not `print`, in production services.

---

## PHASE 3 - Redis Cache (1 hour)

### Step 3.1: Verify Cache Service

`backend/services/cache.py` should expose:

```python
async def get_cached_jobs(query: str, location: str = "") -> list[dict] | None
async def cache_jobs(jobs: list[dict], query: str, location: str = "") -> None
```

Cache key pattern:

```text
jobs:{md5(query+location)}
```

TTL:

```text
7200 seconds
```

### Step 3.2: Cache Integration

`search_jobs_with_scores()` or equivalent orchestration should:

1. Check cache first
2. Return cached jobs if present
3. Search providers on cache miss
4. Score jobs
5. Cache scored job cards

Do not cache unscored provider results unless you intentionally score after cache retrieval.

### Step 3.3: Cache Smoke Test

Run only if Upstash credentials are configured:

```bash
python -c "import asyncio; from services.cache import cache_jobs, get_cached_jobs; async def main(): await cache_jobs([{'title':'Test'}], 'python', 'dhaka'); print(await get_cached_jobs('python', 'dhaka')); asyncio.run(main())"
```

If this one-liner is awkward on Windows, use `backend/run_tests.py` or create `backend/test_cache.py`.

---

## PHASE 4 - Score Jobs (1.5 hours)

### Step 4.1: Create Orchestration Function

Create either `services/job_ranker.py` or add to `services/job_search.py`:

```python
async def search_jobs_with_scores(query: str, location: str, user_id: str) -> list[dict]:
    cached = await get_cached_jobs(query, location)
    if cached is not None:
        return cached

    jobs = await search_jobs(query, location)
    scored_jobs = []

    for job in jobs[:10]:
        fit = await compute_fit_score(job["description"] or job["title"], user_id)
        scored_jobs.append({
            **job,
            "fit_score": fit["score"],
            "fit_explanation": fit["explanation"],
            "fit_breakdown": fit["section_scores"],
        })

    scored_jobs.sort(key=lambda item: item["fit_score"], reverse=True)
    await cache_jobs(scored_jobs, query, location)
    return scored_jobs
```

### Step 4.2: Save Jobs to Database

If Supabase is available, save scored jobs to `jobs`.

Columns:

```text
user_id, external_id, title, company, location, salary_range,
deadline, description, source, fit_score, fit_explanation
```

Use specific columns. Do not use `select("*")`.

If Supabase is blocked, skip DB persistence and return the scored jobs from memory.

---

## PHASE 5 - Jobs Router (1 hour)

### Step 5.1: Endpoint Shape

Add or update `backend/routers/jobs.py`.

Recommended endpoint:

```text
POST /api/jobs/search
```

Request body:

```json
{
  "user_id": "real-supabase-auth-uuid",
  "query": "ML engineer",
  "location": "Dhaka"
}
```

Response body:

```json
{
  "jobs": [
    {
      "external_id": "abc123",
      "title": "Machine Learning Engineer",
      "company": "Example AI",
      "location": "Dhaka",
      "salary_range": "Not specified",
      "deadline": "Not specified",
      "description": "Short description...",
      "source": "JSearch",
      "apply_url": "https://...",
      "fit_score": 84,
      "fit_explanation": "Strong match because...",
      "fit_breakdown": {
        "skills": 91.2,
        "experience": 78.4,
        "education": 65.0,
        "projects": 82.1
      }
    }
  ],
  "count": 1
}
```

### Step 5.2: Route Prefix

Keep route prefixes consistent with Day 2/3:

```python
router = APIRouter(prefix="/api/jobs", tags=["jobs"])
```

Then include it in `app/main.py` with:

```python
app.include_router(jobs.router)
```

---

## PHASE 6 - Integration Tests (1.5 hours)

### Step 6.1: Provider Tests

Run only with API keys configured:

```bash
python run_tests.py
```

Expected:

- JSearch returns jobs for `"Python", "Dhaka"`
- Remotive returns remote jobs for `"Python"`
- Tavily returns search results for `"Python Developer", "Dhaka"`

If a provider fails because credentials are missing, mark blocked. Do not fake success.

### Step 6.2: Fit Score Live Test

Requires real user with CV chunks.

Create `backend/test_fit_score_live.py`:

```python
import asyncio
from services.fit_score import compute_fit_score

USER_ID = "REAL_AUTH_USER_UUID"


async def main():
    result = await compute_fit_score(
        "Python FastAPI backend engineer with PostgreSQL and REST API experience",
        USER_ID,
    )
    print(result)


if __name__ == "__main__":
    asyncio.run(main())
```

Expected:

- `score` is integer 0-100
- `explanation` is non-empty
- `section_scores` has section keys

### Step 6.3: Jobs Endpoint Test

```cmd
curl -X POST "http://localhost:8000/api/jobs/search" ^
  -H "Content-Type: application/json" ^
  -d "{\"user_id\":\"REAL_AUTH_USER_UUID\",\"query\":\"Python developer\",\"location\":\"Dhaka\"}"
```

Expected:

- Status 200
- Returns 3-10 jobs if APIs have results
- Jobs sorted by `fit_score` descending
- Each job has `fit_explanation`

---

## PHASE 7 - Evaluation Seed Cases (45 minutes)

Create `backend/test_fit_score_cases.py` after live CV chunks are available.

Minimum cases:

1. Exact skill match should score high
2. Senior role vs junior CV should score low
3. Partial frontend/backend overlap should score medium
4. No skill overlap should score low
5. Education-heavy role should show education contribution

Expected ranges can be rough during Day 4, but document actual outputs honestly.

---

## PHASE 8 - Documentation & Commit (30 minutes)

### Step 8.1: Create API Docs

Create or update `backend/docs/API_DAY4.md`.

Include:

- `POST /api/jobs/search`
- request/response JSON
- cache behavior
- provider fallback order
- fit score algorithm summary
- blocked live tests if Supabase/API keys are unavailable

### Step 8.2: Commit

```bash
git status
git add backend/services/fit_score.py backend/services/job_search.py backend/services/cache.py backend/routers/jobs.py backend/docs/API_DAY4.md
git commit -m "Day 4: add fit scoring and job search"
```

Do not commit:

- `.env`
- API keys
- generated cache files
- fake evaluation PASS results

---

## Day 4 Checklist

### Fit Score

- [ ] Section weights match the plan exactly
- [ ] Score is computed programmatically
- [ ] Gemini only writes explanation
- [ ] No LLM score guessing
- [ ] Job description is embedded once
- [ ] Section-specific retrieval works
- [ ] Score is integer 0-100

### Job Search

- [ ] JSearch tried first
- [ ] Remotive fallback works
- [ ] Tavily fallback works
- [ ] Results normalized to shared schema
- [ ] Returns max 10 jobs
- [ ] No forbidden job APIs

### Cache

- [ ] Upstash Redis used
- [ ] Cache key pattern is `jobs:{md5(query+location)}`
- [ ] TTL is 7200 seconds
- [ ] Cached results include fit scores

### API

- [ ] Endpoint is `POST /api/jobs/search`
- [ ] Request body includes `user_id`, `query`, `location`
- [ ] Response includes `jobs` and `count`
- [ ] Jobs sorted by fit score
- [ ] Errors are clear

### Blocked If No Supabase

- [ ] Fit score live test
- [ ] Jobs scored against real CV
- [ ] Jobs saved to `jobs` table
- [ ] End-to-end job ranking

---

## Troubleshooting

### Issue: Fit score is always 0

Check:

- User has `cv_chunks`
- `hybrid_search` returns results
- Embeddings are present
- `user_id` matches the uploaded CV user

### Issue: JSearch returns 401 or 403

Check:

- `JSEARCH_API_KEY` is set
- RapidAPI subscription is active
- Header name is `x-rapidapi-key`
- Host is `jsearch.p.rapidapi.com`

### Issue: Tavily returns low-quality results

Use Tavily only as fallback. Keep query focused:

```text
<role> jobs <location> site:bdjobs.com OR linkedin.com
```

### Issue: Redis cache returns stale data

During development, change query text or manually clear the key in Upstash dashboard.

### Issue: Gemini explanation references unsupported claims

Tighten the prompt:

```text
Use only the CV evidence shown below. If evidence is weak, say the fit is limited.
```

---

## Success Criteria

By end of Day 4:

- Job search returns normalized job cards
- Each job has a programmatic fit score
- Jobs are sorted by score
- Explanations reference actual CV evidence
- Redis caching reduces repeat searches
- Day 7 frontend job cards have a reliable backend API to call

If Supabase is unavailable, Day 4 is code-complete only when provider search, cache helpers, score math, and API shape are implemented, with live scoring tests documented as blocked.

---

## What's Next (Day 5)

Day 5 will implement:

1. LangGraph job hunter agent
2. Tool integration around job search and fit score
3. Chat memory service
4. Groq streaming assistant endpoint
5. RAG-grounded career Q&A

**Critical dependency:** The agent should call Day 4 services. Do not duplicate job search or fit score logic inside the agent.

---

_Day 4 Complete - CareerPilot - Codesprint 2026_  
_Next: DAY 5 - LangGraph Agent & Chat Memory_
