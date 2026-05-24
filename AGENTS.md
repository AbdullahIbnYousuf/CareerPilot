# CareerPilot — Agent Context File

> Read this entire file before writing a single line of code.
> This is the single source of truth for every architectural decision in this project.

---

## What This Project Is

CareerPilot is an agentic career co-pilot built for Codesprint 2026 (14-day hackathon).
It hunts jobs, scores CV fit, drafts cover letters, and tracks applications.
Stack is 100% free tier. No paid APIs. No credit card.

**Four pillars:**

1. Job Hunter Agent — searches jobs, returns structured cards with fit scores
2. CV Intelligence — RAG over the user's own CV using vector search
3. AI Assistant — conversational interface with full CV context and session memory
4. Productivity Tracker — Kanban, calendar, todos, progress dashboard, AI nudges

---

## Monorepo Structure

```
careerpilot/                        ← repo root
├── AGENTS.md                       ← this file
├── PRD.md                          ← product requirements
├── README.md
├── frontend/                       ← Next.js 14 App Router
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── signup/page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx
│   │   │   ├── jobs/page.tsx       ← Pillar 1
│   │   │   ├── cv/page.tsx         ← Pillar 2
│   │   │   ├── chat/page.tsx       ← Pillar 3
│   │   │   └── tracker/page.tsx    ← Pillar 4
│   │   ├── api/
│   │   │   └── chat/route.ts       ← proxies streaming to FastAPI
│   │   ├── layout.tsx
│   │   └── page.tsx                ← landing / redirect
│   ├── components/
│   │   ├── ui/                     ← shadcn components (auto-generated, do not edit)
│   │   ├── job-card.tsx
│   │   ├── fit-score-badge.tsx
│   │   ├── kanban-board.tsx
│   │   ├── cv-upload.tsx
│   │   ├── chat-interface.tsx
│   │   └── progress-dashboard.tsx
│   ├── lib/
│   │   ├── supabase.ts             ← Supabase client (browser)
│   │   ├── supabase-server.ts      ← Supabase client (server components)
│   │   └── utils.ts
│   ├── types/
│   │   └── index.ts                ← all shared TypeScript types
│   ├── .env.local                  ← never commit this
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   └── package.json
├── backend/                        ← FastAPI Python 3.11
│   ├── main.py
│   ├── routers/
│   │   ├── cv.py
│   │   ├── jobs.py
│   │   ├── chat.py
│   │   ├── tracker.py
│   │   └── dashboard.py
│   ├── services/
│   │   ├── parser.py               ← PDF (Gemini) + DOCX (python-docx) routing
│   │   ├── embedder.py             ← Voyage AI embedding
│   │   ├── searcher.py             ← hybrid search RPC
│   │   ├── fit_score.py            ← weighted cosine similarity
│   │   ├── agent.py                ← job hunter agent
│   │   └── cache.py                ← Upstash Redis helpers
│   ├── db/
│   │   └── supabase.py             ← Supabase client (service role)
│   ├── .env                        ← never commit this
│   ├── requirements.txt
│   └── Dockerfile
└── supabase/
    └── migrations/                 ← SQL migration files
```

---

## Tech Stack — Exact Decisions

### LLMs

| Task                                         | Model            | Library             | Import                     |
| -------------------------------------------- | ---------------- | ------------------- | -------------------------- |
| Streaming chat                               | Llama 3.3 70B    | groq                | `from groq import Groq`    |
| CV parsing, reasoning, gap analysis, roadmap | Gemini 2.0 Flash | google-generativeai | `from google import genai` |

**NEVER suggest or use:** OpenAI, Anthropic, Cohere, Mistral, or any other LLM provider.
**NEVER use non-streaming responses for chat** — always stream from Groq.

### CV Parsing

| File type | Parser                                                             | Why                                                           |
| --------- | ------------------------------------------------------------------ | ------------------------------------------------------------- |
| `.pdf`    | Gemini 2.0 Flash multimodal — raw bytes as `types.Part.from_bytes` | Handles multi-column Canva/Figma CVs. No local memory needed. |
| `.docx`   | python-docx                                                        | Pure Python, no ML, safe for Railway free tier.               |

**NEVER use:** docling, pypdf, pdfplumber, pdfminer, unstructured.
Docling requires 1.5–2 GB RAM and will OOM-kill the Railway container.

### Embeddings

**Always use:** Voyage AI `voyage-3`

```python
import voyageai
vo = voyageai.Client()
# For documents: input_type="document"
# For queries: input_type="query"
```

**NEVER use:** OpenAI embeddings, HuggingFace inference API, sentence-transformers locally.

### Vector Search

Supabase pgvector with hybrid search (dense + BM25 + RRF).
Always call the `hybrid_search` stored procedure via Supabase RPC. Never write raw SQL for search.

```python
result = await supabase.rpc("hybrid_search", {
    "query_embedding": embedding,
    "query_text": query,
    "match_count": 5,
    "p_user_id": user_id
}).execute()
```

### Database

**Always use:** Supabase (already configured — use existing client, never initialise a new one).

Backend client (service role — full access, server only):

```python
# db/supabase.py — import from here, never re-initialise
from supabase import create_client, Client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
```

Frontend client (anon key — respects RLS):

```typescript
// lib/supabase.ts — import from here, never re-initialise
import { createBrowserClient } from "@supabase/ssr";
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
```

Server component client:

```typescript
// lib/supabase-server.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
```

### Caching

**Always use:** Upstash Redis for job search result caching.

```python
from upstash_redis import Redis
redis = Redis.from_env()
```

Cache key pattern: `jobs:{md5(query+location)}`
TTL: 7200 seconds (2 hours).

### Job Search APIs

| Priority | Service            | When to use                                       |
| -------- | ------------------ | ------------------------------------------------- |
| 1st      | JSearch (RapidAPI) | Always try first. Best Bangladesh/Dhaka coverage. |
| 2nd      | Remotive           | Fallback for remote roles. No API key needed.     |
| 3rd      | Tavily             | Fallback for local BD sites including bdjobs.com. |

**NEVER use:** Firecrawl, Adzuna, SerpAPI, ScraperAPI.

### Frontend

- **Framework:** Next.js 14 with App Router. Never use Pages Router.
- **Styling:** Tailwind CSS only. Never write custom CSS files.
- **Components:** shadcn/ui. Never install MUI, Chakra, Ant Design.
- **Drag and drop:** dnd-kit only. Never use react-beautiful-dnd or react-dnd.
- **Charts:** Recharts only.
- **Data fetching:** TanStack Query (`@tanstack/react-query`) for client-side. Native fetch in Server Components.
- **Streaming:** Vercel AI SDK `useChat` hook for chat interface.
- **Icons:** lucide-react (already installed with shadcn).

### Backend

- **Framework:** FastAPI. Never Flask, Django, Express.
- **Python version:** 3.11
- **Async:** Always use `async def` for route handlers. Always use `await` for Supabase calls.
- **Streaming:** Server-Sent Events (SSE) via `StreamingResponse` in FastAPI.

---

## Environment Variables — Exact Names

### Backend (`backend/.env`)

```
GROQ_API_KEY=
GOOGLE_API_KEY=
VOYAGE_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
JSEARCH_API_KEY=
TAVILY_API_KEY=
```

### Frontend (`frontend/.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=https://your-railway-url.railway.app
```

**NEVER hardcode API keys. NEVER commit .env files.**
**NEVER use different variable names** — these are referenced across services.

---

## Database Schema — Quick Reference

| Table                | Purpose                         | Key columns                                                                      |
| -------------------- | ------------------------------- | -------------------------------------------------------------------------------- |
| `auth.users`         | Supabase managed — do not touch | `id`, `email`                                                                    |
| `cvs`                | CV file metadata                | `id`, `user_id`, `file_name`, `file_url`, `parsed_at`                            |
| `cv_chunks`          | Embedded CV sections            | `id`, `user_id`, `cv_id`, `section`, `content`, `embedding`, `fts`               |
| `jobs`               | Cached job search results       | `id`, `user_id`, `title`, `company`, `location`, `fit_score`, `fit_explanation`  |
| `applications`       | Kanban tracker                  | `id`, `user_id`, `job_id`, `status`, `applied_at`                                |
| `chat_messages`      | Conversational memory           | `id`, `user_id`, `session_id`, `role`, `content`                                 |
| `goals`              | User goals                      | `id`, `user_id`, `title`, `target_date`, `completed`                             |
| `todos`              | Daily todos linked to goals     | `id`, `user_id`, `goal_id`, `title`, `due_date`, `completed`                     |
| `nudges`             | AI proactive reminders          | `id`, `user_id`, `message`, `job_ids`, `seen`                                    |
| `progress_snapshots` | Weekly dashboard data           | `id`, `user_id`, `week_start`, `applications_sent`, `streak_days`, `roadmap_pct` |

**Application status values (exactly these, no others):**
`saved` → `applied` → `interviewing` → `offer` → `rejected`

---

## Fit Score — How It Works

The fit score must be computed programmatically. Never ask the LLM to guess a score.

```
Section weights:
  skills      → 40%
  experience  → 35%
  education   → 15%
  projects    → 10%

Algorithm:
  1. Embed the job description
  2. Hybrid search for top-k CV chunks per section
  3. Compute cosine similarity between JD embedding and each chunk
  4. Weighted average across sections
  5. Multiply by 100 → integer 0–100
  6. Pass score + evidence to Gemini for one-sentence explanation
```

The score calculation is in `backend/services/fit_score.py`. Always import from there.

---

## CV Chunking — Section Labels

When storing CV chunks, the `section` field must be exactly one of:
`skills` | `experience` | `education` | `projects`

No other values. These map directly to fit score weights.

---

## Coding Conventions

### Python (backend)

- Type hints on all function signatures
- `async def` for all route handlers and service functions
- Pydantic models for all request/response bodies — never raw dicts in routes
- One router per pillar (`cv.py`, `jobs.py`, `chat.py`, `tracker.py`, `dashboard.py`)
- Services contain business logic. Routers only handle HTTP concerns.
- Never put database queries directly in routers — always call a service function

### TypeScript (frontend)

- All types in `frontend/types/index.ts`
- `'use client'` directive only when the component uses hooks or browser APIs
- Server Components by default — fetch data at the server level when possible
- No `any` types
- Tailwind classes only — no inline `style={{}}` unless absolutely necessary

### Git

- Commit after every working feature, never at end of day
- Commit message format: `feat: add cv upload endpoint` / `fix: streaming chat disconnect` / `chore: seed database`

---

## Forbidden Patterns

The agent must never do any of the following:

```
❌ import openai
❌ from anthropic import Anthropic
❌ import docling
❌ import pypdf
❌ from langchain import ...         ← use LangGraph directly or Python tool loop
❌ pages/ directory in Next.js       ← App Router only
❌ getServerSideProps                ← App Router only
❌ import { default as axios }       ← use native fetch or httpx
❌ SELECT * FROM ...                 ← always select specific columns
❌ console.log in production code    ← use proper logging
❌ hardcoded user IDs or API keys
❌ any CSS file outside globals.css
❌ installing MUI, Chakra, Ant Design
❌ react-beautiful-dnd or react-dnd  ← dnd-kit only
```

---

## Key API Patterns

### Streaming chat response (FastAPI → Frontend)

```python
from fastapi.responses import StreamingResponse

@router.post("/chat")
async def chat_endpoint(request: ChatRequest):
    async def generate():
        async for token in chat_service.stream(request):
            yield f"data: {token}\n\n"
    return StreamingResponse(generate(), media_type="text/event-stream")
```

### Supabase query pattern (backend)

```python
# Always await. Always handle errors.
result = await supabase.table("jobs").select("id, title, company, fit_score") \
    .eq("user_id", user_id) \
    .order("fit_score", desc=True) \
    .execute()
return result.data
```

### Supabase Realtime subscription (frontend)

```typescript
useEffect(() => {
  const channel = supabase
    .channel("applications-changes")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "applications",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        /* update local state */
      },
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}, [userId]);
```

---

## What Each Day Should Produce

| Day | Deliverable                                                                   |
| --- | ----------------------------------------------------------------------------- |
| 1   | Supabase schema live, env vars configured, repos connected                    |
| 2   | CV upload endpoint working, both parsers returning structured JSON            |
| 3   | Embeddings stored in pgvector, hybrid search returning results                |
| 4   | Fit score algorithm returning 0–100 with explanation, job search APIs working |
| 5   | Agent loop working (LangGraph or Python tool loop)                            |
| 6   | Frontend scaffold, auth pages, basic navigation                               |
| 7   | 🚀 Deployed (Vercel + Railway) — frontend shows job cards                     |
| 8   | Streaming chat working end-to-end with RAG and memory                         |
| 9   | Kanban working with drag-and-drop and Realtime updates                        |
| 10  | Calendar, todos, progress dashboard, AI nudges via pg_cron                    |
| 11  | Seed data, bug fixes, polish                                                  |
| 12  | Evaluation suite (5 test cases → eval.md)                                     |
| 13  | System design doc, README, architecture diagram                               |
| 14  | Demo video, final submission                                                  |

---

## Current Status

- [x] Stack finalised — see `CareerPilot_Stack_Final.md`
- [x] Schema designed
- [x] Agent choice: **LangGraph** — LOCKED
- [ ] Code: not started

_Last updated: Day 0 · Codesprint 2026_
