# CareerPilot API — Day 2 & Day 3 Documentation

## CV Endpoints

Base prefix: `/api/cv`

---

### POST /api/cv/upload

Upload and parse a CV file. Stores the file in Supabase Storage, saves metadata to `cvs`, chunks by section, generates Voyage AI embeddings, and stores chunks in `cv_chunks`.

**Request:**

- Method: `POST`
- Query Parameters:
  - `user_id` (required): Real Supabase Auth UUID
- Body: `multipart/form-data`
  - `file` (required): CV file (`.pdf` or `.docx`, max 5 MB)

**Response (200 OK):**

```json
{
  "cv_id": "123e4567-e89b-12d3-a456-426614174000",
  "file_name": "my_cv.pdf",
  "file_url": "https://...supabase.co/storage/v1/object/public/cv-files/...",
  "parsed_data": {
    "skills": "Python, FastAPI, PostgreSQL, ...",
    "experience": "Software Engineer at TechCorp ...",
    "education": "B.Sc. in Computer Science ...",
    "projects": "E-commerce Platform ..."
  },
  "chunks_stored": 4,
  "parsed_at": "2026-05-24T10:30:00.123456",
  "message": "CV uploaded, parsed, embedded, and stored successfully"
}
```

**Error Responses:**

| Status | Reason |
|--------|--------|
| 400 | Invalid file type, file too large, empty file |
| 422 | Parsing failed or no content extracted |
| 500 | Database, storage, or embedding failure |

---

### GET /api/cv/list

List all CVs for a user (newest first).

**Request:**

- Query Parameters:
  - `user_id` (required): Supabase Auth UUID

**Response (200 OK):**

```json
[
  {
    "id": "123e4567-...",
    "user_id": "abc-...",
    "file_name": "my_cv.pdf",
    "file_url": "https://...",
    "parsed_at": "2026-05-24T10:30:00.123456",
    "created_at": "2026-05-24T10:30:00.123456"
  }
]
```

---

### GET /api/cv/search

Hybrid search (dense vector + BM25 + RRF) over a user's CV chunks.

**Request:**

- Query Parameters:
  - `user_id` (required): Supabase Auth UUID
  - `q` (required): Search query string
  - `top_k` (optional, default=5): Number of results (1–20)

**Response (200 OK):**

```json
{
  "results": [
    {
      "id": "uuid",
      "content": "Python, FastAPI, PostgreSQL...",
      "section": "skills",
      "score": 0.032
    }
  ],
  "count": 1
}
```

---

### GET /api/cv/{cv_id}

Get a specific CV by ID.

**Request:**

- Path: `cv_id` (UUID)
- Query: `user_id` (required)

**Response (200 OK):** Same shape as list item above.

**Error:** `404` if CV not found.

---

## Environment Variables Required

```
GOOGLE_API_KEY=          # For Gemini 2.0 Flash (PDF + DOCX parsing)
VOYAGE_API_KEY=          # For voyage-3 embeddings
SUPABASE_URL=            # e.g. https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=  # From Supabase Dashboard > Settings > API
```

## Manual Prerequisites (Supabase Dashboard)

- [ ] Run `supabase/migrations/20260524_init.sql` in SQL Editor
- [ ] Create Storage bucket named exactly `cv-files` (private)
- [ ] Add upload policy for authenticated users on `cv-files`
- [ ] Enable Realtime on `applications` and `nudges` tables
- [ ] Use a real Supabase Auth user UUID for `user_id` (not a fake string)

## Known Limitations

- `user_id` is a query parameter — real JWT auth added Day 6
- Only one CV per user (old CV is replaced on upload)
- File is stored privately — signed URLs may be needed for display
- Voyage AI free tier: 50M tokens/month

## Day 4 Will Add

- Fit score algorithm (weighted cosine similarity per section)
- Job search APIs (JSearch, Remotive, Tavily)
- Redis caching for job results
- `/api/jobs/search` endpoint
