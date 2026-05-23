# DAY 3 - Embeddings & Vector Storage (Detailed AI-Executable Guide)

**CareerPilot - Codesprint 2026 - DEV1 Backend**

> This guide assumes Day 2 is complete: CV upload parses PDF/DOCX into strict JSON with `skills`, `experience`, `education`, and `projects`.
> Day 3 turns that parsed JSON into searchable CV intelligence using Supabase pgvector and Voyage AI.

**Estimated Time:** 6-8 hours  
**Goal:** Parsed CV sections are stored as section-aware vector chunks, and hybrid search returns relevant CV evidence.

---

## Technical Baseline

- Python version: **3.11**
- Supabase client mode: **synchronous**, because `backend/db/supabase.py` currently uses `create_client`
- FastAPI route handlers may still be `async def`, but Supabase calls shown in this guide use plain `.execute()` without `await`

If the backend is later converted to Supabase's async client, update `db/supabase.py` and all Supabase calls consistently in one pass. Do not mix sync and async Supabase calls in the same codebase.

---

## Day 3 Scope (STRICT)

**What Day 3 DOES:**

- Create or verify Supabase Storage upload for original CV files
- Convert parsed CV JSON into exactly 4 section-aware chunks
- Generate Voyage AI `voyage-3` embeddings for each chunk
- Store chunks in `cv_chunks` with valid section labels
- Save `file_url` and `parsed_at` in `cvs`
- Implement a backend hybrid search service using Supabase RPC
- Add a testing endpoint for CV search

**What Day 3 DOES NOT DO:**

- No fit score algorithm changes (Day 4)
- No job search APIs (Day 4)
- No chat RAG endpoint changes unless needed for search compatibility
- No frontend UI
- No raw SQL search in backend code
- No LLM-generated fit scores

---

## Current Blockers / Manual Tasks

Some Day 3 tasks require Supabase dashboard access. If access is not available, implement the code but mark integration tests as blocked.

- [ ] Supabase migration from `supabase/migrations/20260524_init.sql` has been run
- [ ] `cv_chunks` table exists with `embedding vector(1024)`
- [ ] `hybrid_search` RPC exists
- [ ] Supabase Storage bucket `cv-files` exists
- [ ] Backend `.env` has valid `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Backend `.env` has valid `VOYAGE_API_KEY`
- [ ] You have a real Supabase Auth user UUID for testing

**Important:** Do not test DB writes with fake user IDs like `test-user-123`. The schema references `auth.users(id)`, so `user_id` must be a real UUID from Supabase Auth.

### Create a Test Auth User

Run this only after Supabase credentials are configured in `backend/.env`.

Create `backend/create_test_user.py` temporarily:

```python
from db.supabase import supabase

result = supabase.auth.admin.create_user({
    "email": "demo@careerpilot.local",
    "password": "Demo123!",
    "email_confirm": True,
})

print(result.user.id)
```

Run:

```bash
python create_test_user.py
```

Use the printed UUID for upload and search tests. Do not commit this script if it contains real demo credentials.

---

## What You'll Build Today

```text
Day 2 parsed CV JSON
    |
    v
Upload original file to Supabase Storage
    |
    v
Save CV metadata in cvs table
    |
    v
Create 4 section-aware chunks:
  skills, experience, education, projects
    |
    v
Embed each chunk with Voyage AI voyage-3
    |
    v
Store chunks + embeddings in cv_chunks
    |
    v
Search CV chunks through hybrid_search RPC
```

**Critical:** Chunk by semantic section only. Do not use 500-character or token splits for CV sections.

---

## PHASE 1 - Storage Service (1 hour)

### Step 1.1: Create Storage Service

Create `backend/services/storage.py`.

```python
"""
Supabase Storage helpers for CV files.

Uses the singleton Supabase service-role client from db.supabase.
Never initialize a new Supabase client here.
"""

import uuid
from fastapi import HTTPException, UploadFile
from db.supabase import supabase

BUCKET_NAME = "cv-files"


async def upload_cv_file(file: UploadFile, user_id: str, file_bytes: bytes) -> str:
    """
    Upload the original CV file to Supabase Storage.

    Returns:
        Storage public URL or signed/public URL depending on bucket policy.
    """
    filename = file.filename or "cv"
    extension = filename.rsplit(".", 1)[-1].lower()
    storage_path = f"{user_id}/{uuid.uuid4()}.{extension}"

    try:
        supabase.storage.from_(BUCKET_NAME).upload(
            path=storage_path,
            file=file_bytes,
            file_options={"content-type": file.content_type or "application/octet-stream"},
        )
        return supabase.storage.from_(BUCKET_NAME).get_public_url(storage_path)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"CV storage upload failed: {exc}")
```

**Note:** If the bucket is private, `get_public_url()` may not be useful for display. For the hackathon, either make the bucket public or add signed URL generation later. Keep the service isolated so this is easy to change.

### Step 1.2: Storage Test

Only run this after the `cv-files` bucket exists.

```bash
python -c "from services.storage import BUCKET_NAME; print(BUCKET_NAME)"
```

Full upload testing happens through `/api/cv/upload` after the router is updated.

---

## PHASE 2 - Section-Aware Chunking (1 hour)

### Step 2.1: Create Chunking Service

Create `backend/services/chunker.py`.

```python
"""
Section-aware CV chunking.

Day 3 rule:
One chunk per allowed section. No character splitting.
"""

from typing import TypedDict

ALLOWED_SECTIONS = ("skills", "experience", "education", "projects")


class CVChunk(TypedDict):
    user_id: str
    cv_id: str
    section: str
    content: str


def chunk_cv_sections(parsed_data: dict[str, str], cv_id: str, user_id: str) -> list[CVChunk]:
    """
    Convert parsed CV JSON into one chunk per non-empty section.
    Section labels must match the database check constraint exactly.
    """
    chunks: list[CVChunk] = []

    for section in ALLOWED_SECTIONS:
        content = str(parsed_data.get(section, "")).strip()
        if not content:
            continue

        chunks.append({
            "user_id": user_id,
            "cv_id": cv_id,
            "section": section,
            "content": content,
        })

    return chunks
```

This uses Python 3.11 type syntax. Do not downgrade the backend below Python 3.11.

### Step 2.2: Chunking Unit Test

Create `backend/test_chunker.py`.

```python
from services.chunker import chunk_cv_sections


def test_chunker():
    parsed = {
        "skills": "Python, FastAPI, PostgreSQL",
        "experience": "Backend Developer at Example Co",
        "education": "BSc in CSE",
        "projects": "",
    }

    chunks = chunk_cv_sections(parsed, "cv-id", "user-id")

    assert len(chunks) == 3
    assert {chunk["section"] for chunk in chunks} == {"skills", "experience", "education"}
    assert all(chunk["content"] for chunk in chunks)
    print("Chunker test passed")


if __name__ == "__main__":
    test_chunker()
```

Run:

```bash
python test_chunker.py
```

---

## PHASE 3 - Voyage Embeddings (1 hour)

### Step 3.1: Verify Embedder Service

`backend/services/embedder.py` should expose:

- `embed_documents(texts: list[str]) -> list[list[float]]`
- `embed_query(text: str) -> list[float]`

Rules:

- Use `voyage-3`
- Use `input_type="document"` for CV chunks
- Use `input_type="query"` for search queries
- Do not use OpenAI, HuggingFace, sentence-transformers, or Gemini embeddings

### Step 3.2: Embedding Smoke Test

Create `backend/test_embedder.py`.

```python
from services.embedder import embed_documents, embed_query


def test_embedder():
    doc_embeddings = embed_documents(["Python FastAPI backend developer"])
    query_embedding = embed_query("backend Python role")

    assert len(doc_embeddings) == 1
    assert len(doc_embeddings[0]) == 1024
    assert len(query_embedding) == 1024

    print("Voyage embedding test passed")


if __name__ == "__main__":
    test_embedder()
```

Run only when `VOYAGE_API_KEY` is configured:

```bash
python test_embedder.py
```

---

## PHASE 4 - Update CV Upload Pipeline (1.5 hours)

### Step 4.1: Update Router Flow

Update `backend/routers/cv.py` so `POST /api/cv/upload` does this:

1. Validate `user_id`
2. Validate file type and size
3. Read `file_bytes` once
4. Parse CV into structured JSON using `parse_cv(file_bytes, filename)`
5. Upload original file to Supabase Storage
6. Insert metadata into `cvs`
7. Chunk parsed JSON by section
8. Embed chunks with Voyage
9. Insert rows into `cv_chunks`
10. Return `cv_id`, `file_url`, `parsed_data`, and chunk count

Expected response:

```json
{
  "cv_id": "uuid",
  "file_name": "resume.pdf",
  "file_url": "https://...",
  "parsed_data": {
    "skills": "...",
    "experience": "...",
    "education": "...",
    "projects": "..."
  },
  "chunks_stored": 4,
  "message": "CV uploaded, parsed, embedded, and stored successfully"
}
```

### Step 4.2: Replace Existing CV Before Insert

The PRD says each user has one active CV. Before inserting the new CV:

- Delete old rows from `cvs` where `user_id` matches
- Cascading delete should remove old `cv_chunks`

Use Supabase client calls, not raw SQL:

```python
supabase.table("cvs").delete().eq("user_id", user_id).execute()
```

Do this only after parsing succeeds, so a failed upload does not delete the user's previous CV.

### Step 4.3: Insert Chunk Rows

Build rows like this:

```python
rows = []
for chunk, embedding in zip(chunks, embeddings):
    rows.append({
        "user_id": chunk["user_id"],
        "cv_id": chunk["cv_id"],
        "section": chunk["section"],
        "content": chunk["content"],
        "embedding": embedding,
    })

supabase.table("cv_chunks").insert(rows).execute()
```

**Validation:** `section` must be exactly one of:

```text
skills | experience | education | projects
```

---

## PHASE 5 - Hybrid Search Service (1 hour)

### Step 5.1: Verify Searcher Service

`backend/services/searcher.py` should call the Supabase RPC:

```python
result = supabase.rpc("hybrid_search", {
    "query_embedding": query_embedding,
    "query_text": query,
    "match_count": match_count,
    "p_user_id": user_id,
}).execute()
```

For section-specific search, include:

```python
"p_section": section
```

Rules:

- Always use `hybrid_search` RPC
- Never write raw SQL search in backend code
- Query embeddings must use Voyage `input_type="query"`

### Step 5.2: Add CV Search Endpoint

Add to `backend/routers/cv.py`:

```python
@router.get("/search")
async def search_cv(user_id: str, q: str, top_k: int = 5):
    results = hybrid_search(query=q, user_id=user_id, match_count=top_k)
    return {"results": results}
```

This assumes `services.searcher.hybrid_search()` is a synchronous helper because the current Supabase client is synchronous. If the project converts `db.supabase` to an async client later, then make both the service and endpoint use `await` consistently.

If the router prefix is `/api/cv`, the endpoint is:

```text
GET /api/cv/search?user_id=<uuid>&q=Python
```

Keep this endpoint in `routers/cv.py` for Day 3 because it is a CV testing utility. Do not create a separate router unless the project later grows multiple search domains.

Complete response format:

```json
{
  "results": [
    {
      "id": "uuid",
      "content": "Python, FastAPI, PostgreSQL...",
      "section": "skills",
      "score": 0.032
    }
  ]
}
```

---

## PHASE 6 - Integration Testing (1.5 hours)

### Step 6.1: Upload a Real CV

Requires:

- Real Supabase user UUID
- Supabase migration completed
- Storage bucket exists
- `GOOGLE_API_KEY`
- `VOYAGE_API_KEY`

```cmd
curl -X POST "http://localhost:8000/api/cv/upload?user_id=REAL_AUTH_USER_UUID" ^
  -F "file=@sample_cv.pdf"
```

Verify:

- Status 200
- Response has `cv_id`
- Response has non-null `file_url`
- `chunks_stored` is between 1 and 4
- `parsed_data` contains the 4 expected keys

### Step 6.2: Verify Supabase Rows

In Supabase dashboard:

- `cvs` has one row for the user
- `file_url` is not null
- `parsed_at` is not null
- `cv_chunks` has rows for the same `cv_id`
- Each `cv_chunks.section` is valid
- Each `embedding` is 1024 dimensions

### Step 6.3: Test Hybrid Search

```cmd
curl "http://localhost:8000/api/cv/search?user_id=REAL_AUTH_USER_UUID&q=Python FastAPI"
```

Expected:

```json
{
  "results": [
    {
      "id": "uuid",
      "content": "Python, FastAPI, PostgreSQL...",
      "section": "skills",
      "score": 0.03
    }
  ]
}
```

Success criteria:

- Returns relevant chunks
- Exact skill keywords are found
- Semantic queries also work
- Results include `content`, `section`, and `score`

---

## PHASE 7 - Error Handling (45 minutes)

Handle these cases:

- Voyage API key missing
- Voyage API failure
- Supabase Storage bucket missing
- `hybrid_search` RPC missing
- No chunks generated from parsed CV
- Invalid `section` value
- User ID is not a valid Supabase Auth UUID

Recommended status codes:

- `400`: invalid input, no chunks generated
- `422`: parsing succeeded but content unusable
- `500`: external service or database failure

Do not swallow exceptions silently in route handlers. Return clear messages during development.

Suggested exception handling:

```python
from fastapi import HTTPException
from postgrest.exceptions import APIError
import voyageai

try:
    result = supabase.table("cv_chunks").insert(rows).execute()
except APIError as exc:
    raise HTTPException(status_code=500, detail=f"Supabase insert failed: {exc.message}")
except voyageai.error.VoyageError as exc:
    raise HTTPException(status_code=500, detail=f"Voyage embedding failed: {exc}")
except Exception as exc:
    raise HTTPException(status_code=500, detail=f"Unexpected CV processing error: {exc}")
```

If the installed Voyage SDK exposes a different exception class, catch the SDK-specific base exception available in the installed version and keep the generic fallback.

---

## PHASE 7.5 - Memory Profiling (15 minutes)

Add a lightweight memory helper in the upload path during development:

```python
import os
import psutil


def memory_mb() -> float:
    return psutil.Process(os.getpid()).memory_info().rss / 1024 / 1024
```

Log memory before parsing, after parsing, after embedding, and after database insert.

Expected target:

- PDF parse + embedding should stay comfortably under Railway's memory limit
- Memory should not grow repeatedly after multiple uploads
- If memory rises above 400 MB locally, investigate before deployment

---

## PHASE 8 - Documentation & Commit (30 minutes)

### Step 8.1: Update API Docs

Create or update `backend/docs/API_DAY3.md`.

Include:

- `POST /api/cv/upload`
- `GET /api/cv/search`
- Required environment variables
- Supabase manual prerequisites
- Day 3 known limitations

### Step 8.2: Commit

```bash
git status
git add backend/services/storage.py backend/services/chunker.py backend/services/embedder.py backend/services/searcher.py backend/routers/cv.py backend/docs/API_DAY3.md
git commit -m "Day 3: add CV embeddings and hybrid search"
```

Do not commit `.env`, sample CVs, virtual environments, or generated cache files.

---

## Day 3 Checklist

### Supabase / Manual

- [ ] Migration has been run
- [ ] `cv_chunks` table exists
- [ ] `hybrid_search` RPC exists
- [ ] `cv-files` bucket exists
- [ ] Real auth user UUID available for tests

### Storage

- [ ] `services/storage.py` exists
- [ ] CV file uploads to `cv-files`
- [ ] `file_url` stored in `cvs`

### Chunking

- [ ] `services/chunker.py` exists
- [ ] Chunks are section-aware
- [ ] No 500-character chunking
- [ ] Only valid labels are used
- [ ] Empty sections are skipped

### Embeddings

- [ ] Voyage AI `voyage-3` used
- [ ] Document chunks use `input_type="document"`
- [ ] Query search uses `input_type="query"`
- [ ] Embedding length is 1024

### Database

- [ ] Upload creates one `cvs` row
- [ ] Upload creates 1-4 `cv_chunks` rows
- [ ] Old CV is replaced for the same user
- [ ] `parsed_at` is set
- [ ] `file_url` is set

### Search

- [ ] `services/searcher.py` calls `hybrid_search` RPC
- [ ] `GET /api/cv/search` works
- [ ] Search returns relevant chunks
- [ ] Section-filtered search works for fit score Day 4

### Code Quality

- [ ] No raw SQL search in backend
- [ ] No OpenAI/Anthropic/Cohere/Mistral usage
- [ ] No pypdf/pdfplumber/pdfminer/docling/unstructured
- [ ] No hardcoded user IDs
- [ ] No `.env` committed
- [ ] Type hints on public functions

---

## Troubleshooting

### Issue: Voyage returns wrong vector dimension

Verify the model is exactly:

```python
model="voyage-3"
```

Expected dimension is 1024.

### Issue: Supabase insert fails with user_id foreign key error

You are using a fake user ID. Create or find a real Supabase Auth user and use its UUID.

### Issue: `hybrid_search` RPC not found

Run the migration in `supabase/migrations/20260524_init.sql` from the Supabase SQL editor.

### Issue: Storage bucket not found

Create a Supabase Storage bucket named exactly:

```text
cv-files
```

### Issue: Search returns empty results

Check:

- `cv_chunks` rows exist
- `embedding` values are not null
- `user_id` matches the query user
- Search query is not empty
- `hybrid_search` RPC includes `p_section` default if section filtering is used

---

## Success Criteria

By end of Day 3:

- CV upload stores original file
- CV metadata is saved with `file_url`
- Parsed CV sections are stored as vector chunks
- Voyage embeddings are generated and stored
- Hybrid search returns relevant chunks
- Day 4 fit score has the retrieval foundation it needs

If Supabase access is unavailable, Day 3 is code-complete only when all local code is implemented and integration tests are documented as blocked.

---

## What's Next (Day 4)

Day 4 will implement:

1. Fit score algorithm using section weights
2. Job search APIs: JSearch, Remotive, Tavily
3. Upstash Redis job search cache
4. Job search endpoint
5. Fit score explanation using Gemini

**Critical dependency:** Day 4 fit scoring requires `search_by_section()` to work against real `cv_chunks`.

---

_Day 3 Complete - CareerPilot - Codesprint 2026_  
_Next: DAY 4 - Fit Score & Job Search_
