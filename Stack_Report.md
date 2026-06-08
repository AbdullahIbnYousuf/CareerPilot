# CareerPilot

## Stack Report & Architectural Decisions

**Project:** CareerPilot - Your Agentic Career Co-pilot  
**Event:** Codesprint 2026  
**Team:** .sadcats  
**Repository:** github.com/AbdullahIbnYousuf/CareerPilot  
**Date:** June 2026  

---

## 1. Executive Summary

CareerPilot is a full-stack, agentic career co-pilot that helps job seekers turn their CV into practical career progress. The platform searches jobs, scores fit against the user's own profile, supports CV/profile intelligence, streams personalized AI guidance, and tracks applications, goals, tasks, nudges, and progress inside a daily workspace called **My Journey**.

The architecture is built around one product principle: the user's CV/profile is the source of truth. Job matches, fit explanations, chat responses, roadmap suggestions, and Copilot proposals are grounded in stored CV/profile data rather than generic assumptions.

The current implementation covers the four main pillars:

1. **Job Hunter Agent** - LangGraph-powered job search using JSearch, Remotive, and Tavily, with Redis caching and programmatic fit scoring.
2. **Profile & CV Intelligence** - PDF/DOCX upload, Gemini parsing, manual profile building, resume preview, Gemini embeddings, and Supabase pgvector search.
3. **AI Assistant** - Groq Llama 3.3 70B streaming chat with CV RAG context and session memory persisted in Supabase.
4. **My Journey** - Today, Applications, Goals & Tasks, Calendar, Progress, nudges, and confirmed Copilot action proposals.

---

## 2. Problem We Are Solving

Job seekers usually manage their career search across disconnected job boards, spreadsheets, calendars, CV tools, and generic AI chats. This creates three problems:

- **Fragmentation:** job search, applications, goals, tasks, and progress are spread across separate tools.
- **Generic AI:** most assistants do not know the user's actual CV, skills, projects, and career targets.
- **Low accountability:** job seekers lack a daily workspace that keeps applications, tasks, deadlines, and next actions visible.

CareerPilot brings these workflows into one product. The CV/profile powers job matching and AI guidance, while My Journey turns advice into applications, goals, tasks, nudges, and measurable progress.

---

## 3. High-Level Architecture

CareerPilot is a three-tier application with a dedicated agent and AI service layer.

| Layer | Technology | Role |
| --- | --- | --- |
| Presentation | Next.js 16 App Router, React 19, Tailwind CSS 4, shadcn-style components | Authenticated UI for Jobs, Profile, AI Assistant, and My Journey |
| API Gateway | FastAPI, Python 3.11 | REST endpoints, SSE streaming, agent orchestration, profile/CV pipeline, tracker APIs |
| Agent Layer | LangGraph | Multi-step Job Hunter workflow with search, filtering, retry, scoring, and ranking |
| LLM Inference | Groq Llama 3.3 70B, Google Gemini Flash family | Streaming chat, CV parsing, profile extraction, fit explanations |
| Embeddings | Gemini `models/gemini-embedding-001` | 768-dimensional CV/profile embeddings |
| Vector Search | Supabase PostgreSQL + pgvector | Hybrid dense + BM25 + RRF retrieval over CV chunks |
| Database | Supabase PostgreSQL | Auth-linked product data, jobs, applications, goals, todos, chats, profiles, Copilot state |
| Storage | Supabase Storage | Uploaded CV files |
| Cache | Upstash Redis | Job search cache with 2-hour TTL |
| Deployment | Vercel + Render | Frontend on Vercel, backend on Render |

Typical AI Assistant flow:

1. The authenticated user opens `/chat`.
2. The frontend posts to the Next.js `/api/chat` proxy.
3. The proxy forwards the request to FastAPI `/chat/`.
4. FastAPI retrieves relevant CV chunks through the Supabase `hybrid_search` RPC.
5. The chat service loads recent session memory from Supabase.
6. Groq streams a Llama 3.3 70B response back through SSE-style chunks.
7. The frontend renders the stream and persists session continuity through `chat_sessions` and `chat_messages`.

Typical Job Hunter flow:

1. The user searches for a target role and location in `/jobs`.
2. FastAPI calls the LangGraph job workflow.
3. The workflow checks Upstash Redis for cached raw job results.
4. If needed, it searches JSearch first, then Remotive, then Tavily.
5. Each job is scored programmatically against the user's active CV/profile.
6. Jobs are saved to Supabase and displayed as structured cards with fit scores and explanations.

---

## 4. Technology Stack

### 4.1 Frontend

| Area | Current Implementation |
| --- | --- |
| Framework | Next.js 16.2.6 with App Router |
| Runtime UI | React 19.2.4 |
| Styling | Tailwind CSS 4 |
| UI primitives | shadcn-style local components, Base UI, class-variance-authority |
| Icons | lucide-react |
| Drag and drop | dnd-kit |
| Charts | Recharts |
| Client data | Native fetch, Supabase client, TanStack Query available |
| Chat streaming | Next.js `/api/chat` proxy with manual stream parsing |

Canonical product routes:

| Route | Visible Label | Purpose |
| --- | --- | --- |
| `/tracker` | My Journey | Main authenticated workspace |
| `/jobs` | Jobs | Job Hunter Agent |
| `/chat` | AI Assistant | CV-grounded streaming assistant |
| `/cv` | Profile | CV/profile intelligence |
| `/cv/preview` | Resume Preview | Resume view generated from the saved profile |
| `/` | Redirect | Authenticated redirect to `/tracker` |

Compatibility routes also exist for `/journey` and `/ai`, which re-export the tracker and chat pages.

### 4.2 Backend

| Area | Current Implementation |
| --- | --- |
| Framework | FastAPI |
| Python | Python 3.11 |
| Server | Uvicorn |
| Data validation | Pydantic |
| Supabase client | Async service-role client imported from `backend/db/supabase.py` |
| Streaming | FastAPI `StreamingResponse` |
| Agent orchestration | LangGraph |

Backend routers:

| Router | Prefix | Purpose |
| --- | --- | --- |
| `cv.py` | `/api/cv` | CV upload, parsing, profile save/update, CV search |
| `jobs.py` | `/jobs` | Job hunting, saved jobs, on-demand scoring |
| `chat.py` | `/chat` | Streaming AI Assistant |
| `tracker.py` | `/tracker` | Applications, goals, todos, notes, events |
| `dashboard.py` | `/dashboard` | Progress metrics and nudges |
| `copilot.py` | `/copilot` | Preferences, context snapshots, action validation/execution, Copilot state |

### 4.3 AI and LLM Providers

CareerPilot uses only free-tier-friendly AI providers.

| Task | Provider / Model | Why |
| --- | --- | --- |
| Streaming assistant chat | Groq `llama-3.3-70b-versatile` | Low-latency token streaming for conversational UX |
| Job search query expansion/filtering | Groq `llama-3.3-70b-versatile` | Fast structured reasoning inside the agent workflow |
| CV parsing and profile extraction | Gemini Flash family with fallback | Handles PDF/DOCX-derived content and structured JSON extraction |
| Fit score explanation | Gemini Flash family with fallback | Generates concise explanation after numeric score is computed |
| Embeddings | Gemini `models/gemini-embedding-001` | 768-dimensional embeddings compatible with pgvector |

The Gemini parser uses a fallback list including Gemini 2.5 Flash Lite, Gemini Flash Lite Latest, Gemini 2.0 Flash Lite, Gemini 2.5 Flash, Gemini Flash Latest, and Gemini 2.0 Flash. This improves resilience during rate limits or model availability changes.

### 4.4 Agent Framework

The Job Hunter Agent is implemented with **LangGraph**. The graph includes search, filtering, retry, and ranking steps. This is a better fit than a single sequential chain because job search can fail, return too few results, or need fallback providers.

The current workflow:

1. Search jobs through the provider fallback pipeline.
2. Filter and normalize results.
3. Retry if too few useful jobs are found.
4. Score and rank jobs against the user's active CV/profile.
5. Return structured cards.

### 4.5 CV and Profile Intelligence

CareerPilot supports both uploaded CVs and manual profile building.

| Input Type | Pipeline |
| --- | --- |
| PDF | Gemini multimodal parsing from raw PDF bytes |
| DOCX | `python-docx` text extraction, then Gemini structuring |
| Manual profile | User-edited structured profile saved as the active CV intelligence source |

The profile layer stores editable fields such as name, headline, location, links, summary, skills, experience, education, projects, and certifications. Saving a profile refreshes the CV intelligence source, chunks, and embeddings used by chat, search, and fit scoring.

The Profile area also includes a resume preview/export-style page at `/cv/preview`.

### 4.6 Embeddings and Vector Search

All CV/profile chunks are embedded using Gemini `models/gemini-embedding-001`. The vectors are stored in Supabase pgvector as 768-dimensional embeddings.

Search is performed through the Supabase `hybrid_search` RPC, combining:

- Dense semantic search with pgvector cosine distance.
- Keyword search with PostgreSQL full-text search.
- Reciprocal Rank Fusion to merge rankings.

The backend does not write raw SQL for search at runtime; it calls the stored RPC.

### 4.7 Fit Score Algorithm

Fit scores are computed programmatically, not guessed by an LLM.

Section weights:

| CV Section | Weight |
| --- | ---: |
| Skills | 40% |
| Experience | 35% |
| Education | 15% |
| Projects | 10% |

Algorithm:

1. Embed the job description.
2. Retrieve top matching chunks per CV/profile section.
3. Load stored chunk embeddings.
4. Compute cosine similarity between job and CV evidence.
5. Apply section weights.
6. Apply a role relevance multiplier based on the user's search query.
7. Convert the result to an integer score from 0 to 100.
8. Ask Gemini only to explain the computed score in one sentence.

The current fit score version is `fit-v2`, and jobs track score provenance through fields such as `scored_cv_id`, `fit_score_calculated_at`, and `fit_score_version`.

### 4.8 Job Search APIs and Caching

CareerPilot uses a provider fallback strategy:

| Priority | Provider | Purpose |
| --- | --- | --- |
| 1 | JSearch via RapidAPI | Best first choice for broad and Bangladesh/Dhaka coverage |
| 2 | Remotive | Free fallback for remote roles |
| 3 | Tavily | Fallback for local web results, including local job sites |

Upstash Redis caches raw job search results for 2 hours.

Current cache key pattern:

```text
jobs:v2:{md5(query+location)}
```

User-specific fields such as fit scores are stripped from cached raw job results so cached search data can be reused safely before user-specific scoring.

### 4.9 Authentication and Security

Frontend authentication uses Supabase Auth through `@supabase/ssr` middleware. Authenticated users are redirected into the dashboard area, and unauthenticated users are redirected to login.

Backend services use a singleton Supabase service-role client. The current API shape passes `user_id` through query parameters or request bodies and scopes database queries by that user ID. This keeps the hackathon implementation simple, but the production hardening path is to verify Supabase JWTs in FastAPI and derive `user_id` server-side instead of trusting client-provided IDs.

Security measures currently present:

- Frontend route protection through Supabase session middleware.
- Supabase RLS policies on user-facing tables.
- Backend service-role key kept server-side only.
- Secrets read from environment variables.
- Uploaded CVs stored through Supabase Storage.
- Copilot mutations require validation and explicit user confirmation before execution.

Recommended production hardening:

- Add FastAPI JWT verification for all backend routes.
- Replace client-provided `user_id` with authenticated user identity from the token.
- Restrict CORS origins to deployed frontend domains.
- Add rate limits to chat, upload, and job search endpoints.

---

## 5. Database Schema

CareerPilot uses Supabase PostgreSQL for relational data, auth-linked records, vector search, and Realtime subscriptions.

Core tables:

| Table | Purpose |
| --- | --- |
| `cvs` | Uploaded/generated CV source metadata |
| `cv_chunks` | Section-aware CV/profile chunks with pgvector embeddings |
| `profiles` | Editable user profile and active CV source |
| `jobs` | Saved and scored job results |
| `applications` | Application tracker records |
| `application_events` | Application status and note history |
| `chat_sessions` | Durable assistant chat sessions/tabs |
| `chat_messages` | User and assistant message memory |
| `goals` | Career goals |
| `todos` | Tasks linked to goals or daily work |
| `nudges` | Suggested next-step reminders |
| `progress_snapshots` | Weekly progress metrics |
| `career_preferences` | Copilot/user career preferences |
| `copilot_user_state` | Guided onboarding and feature exposure state |
| `copilot_action_events` | Validated/executed/rejected/failed Copilot action audit trail |

Application status values:

```text
saved -> applied -> interviewing -> offer -> rejected
```

CV chunk section values:

```text
skills | experience | education | projects
```

---

## 6. My Journey Workspace

`/tracker` is the main authenticated workspace and Pillar 4 hub. It contains five internal views:

| View | Purpose |
| --- | --- |
| Today | Daily action queue, urgent items, nudges, weekly progress, and next best action |
| Applications | Drag-and-drop application tracking with notes and events |
| Goals & Tasks | Career goals, todos, deadlines, skill-growth actions |
| Calendar | Todo due dates, goal target dates, and job/application deadlines |
| Progress | Metrics, charts, attention items, pipeline counts |

The UI intentionally uses the visible label **Applications**, not Kanban, even though the underlying implementation uses a Kanban-style board.

---

## 7. Copilot V2

CareerPilot includes a persistent in-app Copilot widget. It acts as a product guide, career coach, and action proposal layer.

Copilot can:

- Collect onboarding preferences.
- Explain product features in context.
- Suggest focused job searches.
- Draft goals and tasks for review.
- Propose application status updates or notes.
- Route users to the right page.
- Validate and execute confirmed actions through backend handlers.

Important safety decision:

Copilot does not silently mutate product state. The chat model may propose an action through a hidden directive, but backend action handlers validate it and the user must explicitly confirm before mutations such as creating tasks, saving applications, or updating application statuses.

---

## 8. Deployment

| Component | Deployment Target |
| --- | --- |
| Frontend | Vercel |
| Backend | Render |
| Database/Auth/Storage | Supabase |
| Cache | Upstash Redis |

The backend includes:

- `render.yaml` for Render deployment.
- `backend/Dockerfile` with Python 3.11 slim and Uvicorn.
- `/health` health check endpoint.

Required backend environment variables:

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

Required frontend environment variables:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=
```

---

## 9. Scalability Analysis

CareerPilot's current free-tier stack is suitable for hackathon/demo usage. The same architecture can scale to 10,000 users by upgrading managed tiers and adding queue/rate-limit controls.

| Component | Current State | Bottleneck at Scale | Mitigation |
| --- | --- | --- | --- |
| Groq chat | Direct streaming API calls | Rate limits and concurrent usage | Request queue, per-user limits, fallback messaging |
| Gemini parsing/embeddings | Direct API calls | Quotas during CV upload spikes | Background jobs, retry queues, key rotation, upload throttling |
| Job search APIs | JSearch/Remotive/Tavily | API quotas and repeated queries | Upstash caching, query normalization, provider fallback |
| Supabase pgvector | Hybrid search in Postgres | Index size and query load | HNSW indexes, tighter per-user filters, Supabase tier upgrade |
| FastAPI | Single Render service | Cold starts and concurrent agent calls | More workers, paid Render instance, background worker split |
| Frontend | Vercel | Minimal for authenticated app | Keep dashboard client bundles focused |
| Storage | Supabase Storage | CV file volume | File size limits, retention policy, paid storage tier |

At 10,000 users, the highest-risk areas are LLM/API quotas and job-search API limits, not frontend rendering. Redis caching is the key cost and latency control for repeated searches.

---

## 10. Key Architectural Decisions

### 10.1 CV/Profile as the Source of Truth

All personalized intelligence starts from the user's saved CV/profile. Chat, job matching, fit scores, resume preview, and Copilot guidance are grounded in profile/CV data.

### 10.2 Programmatic Scores, LLM Explanations

The numeric fit score is computed using embeddings and cosine similarity. Gemini is used only to explain the computed score.

### 10.3 Hybrid Retrieval Instead of Dense-Only Search

Dense embeddings capture semantic similarity, while BM25/full-text search catches exact skill and tool names. RRF merges both signals without requiring another vector service.

### 10.4 Confirmed Copilot Actions

The AI can propose actions, but product state changes only happen through validated backend handlers after explicit user confirmation.

### 10.5 Supabase as the Data Backbone

Supabase provides auth, PostgreSQL, pgvector, Realtime, storage, and RLS in one free-tier-friendly platform, reducing operational complexity for a hackathon team.

---

## 11. Current Known Limitations

- FastAPI backend routes currently trust client-provided `user_id`; production should verify Supabase JWTs and derive identity server-side.
- CORS is permissive in the current backend and should be restricted for production.
- Chat streaming is implemented manually through a Next.js proxy rather than the Vercel AI SDK `useChat` hook.
- Nudge generation is rule-based and request-triggered/current-app-triggered; a production scheduler would make this more autonomous.
- Background job processing would improve CV upload and embedding UX under heavier load.

---

## 12. Conclusion

CareerPilot's current stack is a cohesive, free-tier-friendly AI application architecture:

- **Next.js + React + Tailwind** for the product UI.
- **FastAPI** for async backend APIs and streaming.
- **LangGraph** for the Job Hunter Agent.
- **Groq** for low-latency streaming chat.
- **Gemini** for CV parsing, profile extraction, embeddings, and grounded explanations.
- **Supabase + pgvector** for relational data, auth-linked state, and RAG retrieval.
- **Upstash Redis** for job search caching.
- **Vercel + Render** for deployment.

The result is not just a chatbot or a tracker. CareerPilot connects CV intelligence, job discovery, AI guidance, and daily accountability into one workflow designed to help job seekers make consistent, personalized progress.

---

**End of Stack Report**
