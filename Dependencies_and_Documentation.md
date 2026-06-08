# CareerPilot

## Dependencies & Project Documentation

**Project:** CareerPilot - Your Agentic Career Co-pilot  
**Event:** Codesprint 2026  
**Team:** .sadcats  
**Repository:** github.com/AbdullahIbnYousuf/CareerPilot  
**Date:** June 2026  

---

## 1. Project Overview

CareerPilot is an agentic career platform built around the user's own CV/profile as the source of truth. It supports:

1. Job Hunter Agent
2. Profile and Resume Intelligence
3. Personal AI Assistant
4. Productivity and Progress Tracker

The current implementation grounds job recommendations, fit scores, cover-letter drafts, roadmap suggestions, and assistant responses in the user's stored CV/profile and tracker data.

---

## 2. Current Repository Structure

The repo is a monorepo with frontend, backend, and Supabase migrations.

```text
careerpilot/
├── frontend/                 # Next.js App Router frontend
│   ├── app/
│   │   ├── (auth)/
│   │   └── (dashboard)/
│   │       ├── jobs/
│   │       ├── chat/
│   │       ├── tracker/
│   │       ├── journey/      # compatibility route
│   │       ├── ai/           # compatibility route
│   │       └── cv/
│   ├── components/
│   ├── lib/
│   ├── types/
│   └── package.json
├── backend/                  # FastAPI backend
│   ├── app/main.py
│   ├── routers/
│   ├── services/
│   ├── db/supabase.py
│   └── requirements.txt
├── supabase/
│   └── migrations/
├── README.md
├── AGENTS.md
├── PRD.md
└── render.yaml
```

Note: the repo does not currently include a `docker-compose.yml` file.

---

## 3. Current Dependencies

### 3.1 Frontend Dependencies

Source of truth: `frontend/package.json`

| Package | Current version | Purpose |
| --- | --- | --- |
| `next` | `16.2.6` | App Router, SSR, route handlers |
| `react` | `19.2.4` | UI runtime |
| `react-dom` | `19.2.4` | DOM rendering |
| `typescript` | `^5` | Static typing |
| `tailwindcss` | `^4` | Utility-first styling |
| `@tailwindcss/postcss` | `^4` | Tailwind PostCSS integration |
| `@supabase/ssr` | `^0.10.3` | Server/client auth session handling |
| `@supabase/supabase-js` | `^2.106.1` | Supabase client |
| `@tanstack/react-query` | `^5.100.14` | Client-side data fetching |
| `ai` | `^6.0.191` | Streaming/chat-related utilities |
| `@dnd-kit/core` | `^6.3.1` | Drag and drop |
| `@dnd-kit/sortable` | `^10.0.0` | Sortable DnD |
| `recharts` | `^3.8.1` | Charts |
| `lucide-react` | `^1.16.0` | Icons |
| `date-fns` | `^4.3.0` | Date utilities |
| `react-day-picker` | `^10.0.1` | Calendar UI |
| `class-variance-authority` | `^0.7.1` | Variant helpers |
| `clsx` | `^2.1.1` | Class name composition |
| `tailwind-merge` | `^3.6.0` | Tailwind class merging |
| `tw-animate-css` | `^1.4.0` | Animation helpers |
| `shadcn` | `^4.8.0` | UI scaffolding helper |
| `@base-ui/react` | `^1.5.0` | Base UI primitives |

### 3.2 Backend Dependencies

Source of truth: `backend/requirements.txt`

| Package | Current version | Purpose |
| --- | --- | --- |
| `fastapi` | `0.136.1` | API framework |
| `uvicorn` | `0.47.0` | ASGI server |
| `pydantic` | `2.13.4` | Data validation |
| `pydantic-settings` | `2.14.1` | Settings management |
| `python-multipart` | `0.0.20` | File upload handling |
| `groq` | `0.29.0` | Streaming chat inference |
| `google-generativeai` | `0.8.3` | Gemini parsing, embeddings, explanations |
| `langgraph` | `0.2.28` | Job Hunter agent graph |
| `langchain-core` | `0.3.15` | Shared LLM utilities |
| `supabase` | `2.30.0` | Supabase Python client |
| `pgvector` | `0.4.2` | Vector support |
| `upstash-redis` | `1.3.0` | Job cache |
| `tavily-python` | `0.7.24` | Tavily fallback search |
| `python-docx` | `1.2.0` | DOCX CV parsing |
| `httpx` | `0.28.1` | HTTP calls |
| `PyJWT` | `2.13.0` | JWT support if needed |
| `numpy` | `2.4.6` | Fit score math |
| `tenacity` | `9.1.4` | Retry handling |
| `python-dotenv` | `1.2.2` | Local env loading |

The current backend does not use the older dependency set from the draft document (`langchain`, `langchain-groq`, `sentence-transformers`, `vecs`, `pypdf`, `duckduckgo-search`, `redis`, etc.).

---

## 4. Current Stack Decisions

### Frontend

- Next.js App Router only.
- Tailwind CSS only for styling.
- DnD implemented with `dnd-kit`.
- Charts implemented with `recharts`.
- Supabase auth handled through `@supabase/ssr`.
- Chat streaming is proxied through a Next.js route handler.

### Backend

- FastAPI with async route handlers.
- Groq for streaming assistant chat.
- Gemini for CV parsing, profile extraction, embeddings, and fit explanations.
- LangGraph for the Job Hunter Agent.
- Supabase for auth-linked data, vector search, and storage.
- Upstash Redis for job search cache.

### AI and Retrieval

- Job search uses `JSearch -> Remotive -> Tavily`.
- CV/profile embeddings use Gemini `models/gemini-embedding-001`.
- Vector search uses the Supabase `hybrid_search` RPC.
- Fit scores are computed programmatically, not guessed by the LLM.

---

## 5. Environment Variables

### Backend (`backend/.env`)

Current example file: `backend/.env.example`

```env
GROQ_API_KEY=
GOOGLE_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
JSEARCH_API_KEY=
TAVILY_API_KEY=
```

### Frontend (`frontend/.env.local`)

Current example file: `frontend/.env.example`

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=http://localhost:8000
```

The older `NEXT_PUBLIC_API_BASE_URL` name is not used in the current repo.

---

## 6. Database and Migration Status

The current schema is defined in `supabase/migrations/`.

Core tables now include:

- `cvs`
- `cv_chunks`
- `jobs`
- `applications`
- `chat_messages`
- `chat_sessions`
- `goals`
- `todos`
- `nudges`
- `progress_snapshots`
- `profiles`
- `application_events`
- `career_preferences`
- `copilot_user_state`
- `copilot_action_events`

Important current schema details:

- `cv_chunks.embedding` uses `vector(768)`.
- `cv_chunks.section` is restricted to `skills`, `experience`, `education`, `projects`.
- `applications.status` is restricted to `saved`, `applied`, `interviewing`, `offer`, `rejected`.
- Job score provenance fields now exist, including `scored_cv_id`, `fit_score_calculated_at`, and `fit_score_version`.

The older draft document is stale if it still references:

- `vector(384)`
- uppercase application statuses
- DuckDuckGo search
- a minimal schema without profiles/chat sessions/copilot tables

---

## 7. Local Setup

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Database

1. Create a Supabase project.
2. Apply migrations from `supabase/migrations/`.
3. Ensure pgvector is enabled.
4. Set the frontend and backend env vars.

---

## 8. Evaluation and Documentation

Current repo docs and artifacts include:

- `README.md`
- `AGENTS.md`
- `PRD.md`
- `03_System_Design.md`
- `03_System_Design.docx`
- `evaluation_suite.json`
- `backend/docs/API_DAY2_DAY3.md`

The evaluation artifact currently lives as `evaluation_suite.json`, not in a `/tests/` directory as the older draft implies.

Current backend tests are primarily the `backend/test_*.py` files.

---

## 9. Known Gaps in the Older Draft

This is the short list of things that should be corrected if the old document is used for submission:

- Update Next.js, React, and Tailwind versions.
- Replace old backend dependency names with the current package list.
- Replace `NEXT_PUBLIC_API_BASE_URL` with `NEXT_PUBLIC_API_URL`.
- Remove DuckDuckGo and sentence-transformers references.
- Replace 384-dimension vector references with 768.
- Add the newer schema tables and Copilot V2 data model.
- Mention manual profile building and resume preview.
- Mention `chat_sessions` and the current streaming proxy setup.
- Remove the `docker-compose.yml` claim.
- Fix encoding issues in the exported text.

---

## 10. Summary

The current codebase is more advanced than the original dependency/documentation draft. The updated source of truth is:

- Frontend: Next.js 16 + React 19 + Tailwind 4
- Backend: FastAPI + Groq + Gemini + LangGraph
- Database: Supabase + pgvector + Realtime + Storage
- Cache: Upstash Redis
- Deployment: Vercel + Render

For submission, this document should replace the older dependency write-up because it matches the actual repo state.

---

**End of Dependencies & Documentation**
