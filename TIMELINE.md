# CareerPilot — 14-Day Execution Timeline

**Codesprint 2026 · Powered by Poridhi.io**

> This is your day-by-day execution plan. Each task has time estimates and exact deliverables.
> Follow this strictly. Do not skip ahead. Do not work on Day 7 features on Day 3.

---

## Timeline Overview

```
PHASE 1 — Infrastructure (Days 1–5)              Foundation · No UI yet
PHASE 2 — Features + Integration (Days 6–10)     Build all four pillars
PHASE 3 — Polish + Bonus (Days 11–14)            Demo-ready · Bonus points
```

**Critical Path:** Days 1→2→3→4→5→7 must complete on time. Any delay cascades.

---

## PHASE 1 — Infrastructure (Days 1–5)

### Day 1 — Foundation Setup

**Goal:** Database live, environment configured, repos connected
**Time:** 6–8 hours

#### Morning (3–4 hours)

- [x] Create Supabase project at supabase.com
- [x] Run all SQL migrations from `CareerPilot_Stack_Final.md` Section 8
  - Enable pgvector extension
  - Create all tables: cvs, cv_chunks, jobs, applications, chat_messages, goals, todos, nudges, progress_snapshots
  - Create indexes (HNSW for embeddings, GIN for full-text search)
  - Create `hybrid_search` stored procedure
- [x] Enable Supabase Realtime on `applications` and `nudges` tables (Database → Replication)
- [x] Set up Supabase Auth (Email + Password provider)

#### Afternoon (3–4 hours)

- [x] Get all API keys:
  - Groq (groq.com) — free, no credit card
  - Google AI Studio (aistudio.google.com) — free, no credit card
  - Voyage AI (voyageai.com) — free, no credit card
  - Upstash Redis (upstash.com) — free, no credit card
  - JSearch via RapidAPI (rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch) — free tier
  - Tavily (tavily.com) — free tier
- [x] Create GitHub repos:
  - Option A: Monorepo `careerpilot` with `/frontend` and `/backend` folders
  - Option B: Two repos `careerpilot-frontend` and `careerpilot-backend`
- [x] Create `backend/.env` with all keys (see AGENTS.md)
- [x] Create `frontend/.env.local` with Supabase public keys
- [x] Initialize backend: `cd backend && python -m venv venv && pip install -r requirements.txt`
- [x] Initialize frontend: `cd frontend && npm install`
- [x] Test Supabase connection from both frontend and backend

**Deliverable:** All services accessible, environment variables working, repos initialized

---

### Day 2 — CV Parsing Pipeline

**Goal:** Upload endpoint working, both PDF and DOCX parsers returning structured JSON
**Time:** 6–8 hours

#### Morning (3–4 hours)

- [x] Create `backend/services/parser.py`:
  - `parse_pdf_cv(file: UploadFile) -> dict` — uses Gemini 2.0 Flash multimodal
  - `parse_docx_cv(file: UploadFile) -> dict` — uses python-docx + Gemini for structuring
  - Both return: `{"skills": str, "experience": str, "education": str, "projects": str}`
- [x] Create `backend/routers/cv.py`:
  - `POST /api/cv/upload` — accepts PDF or DOCX, routes to correct parser
  - Saves file metadata to `cvs` table
  - Returns parsed JSON
- [x] Test with 3 sample CVs:
  - Single-column PDF
  - Multi-column Canva PDF
  - DOCX file

#### Afternoon (3–4 hours)

- [x] Add error handling:
  - File size limit (5 MB)
  - File type validation
  - Parsing failures → return 400 with clear message
- [x] Add Supabase Storage integration:
  - Upload original file to Supabase Storage bucket `cv-files`
  - Store `file_url` in `cvs` table
- [x] Memory profiling:
  - Add `psutil` to requirements.txt
  - Log memory usage after parsing: `psutil.Process().memory_info().rss / 1024 / 1024`
  - Verify stays under 512 MB (Render free tier limit)

**Deliverable:** `POST /api/cv/upload` working end-to-end, files stored, JSON returned

---

### Day 3 — Embeddings & Vector Storage

**Goal:** CV chunks embedded and stored in pgvector, hybrid search returning results
**Time:** 6–8 hours

#### Morning (3–4 hours)

- [x] Create `backend/services/embedder.py`:
  - `embed_chunks(chunks: list[str]) -> list[list[float]]` — Voyage AI with `input_type="document"`
  - `embed_query(query: str) -> list[float]` — Voyage AI with `input_type="query"`
  - Add fallback to Gemini embeddings if Voyage fails
- [x] Create chunking logic in `backend/services/parser.py`:
  - `chunk_cv(parsed: dict, cv_id: str, user_id: str) -> list[dict]`
  - One chunk per section: skills, experience, education, projects
  - Each chunk: `{"section": str, "content": str, "cv_id": str, "user_id": str}`
- [x] Update `POST /api/cv/upload` to:
  - Parse CV → chunk by section → embed each chunk → store in `cv_chunks` table
  - Store embedding as `vector(1024)` type

#### Afternoon (3–4 hours)

- [x] Test hybrid search:
  - Insert 3 test CVs with different skill sets
  - Query: "Python FastAPI PostgreSQL"
  - Verify `hybrid_search` RPC returns relevant chunks
  - Verify BM25 catches exact keyword matches
- [x] Create `backend/services/searcher.py`:
  - `search_cv_chunks(query: str, user_id: str, top_k: int) -> list[dict]`
  - Wraps Supabase RPC call to `hybrid_search`
- [x] Add endpoint `GET /api/cv/search?q=Python` for testing

**Deliverable:** CV chunks stored with embeddings, hybrid search working, test endpoint returns results

---

### Day 4 — Fit Score & Job Search

**Goal:** Fit score algorithm working, job search APIs integrated
**Time:** 8–10 hours (longest day)

#### Morning (4–5 hours)

- [x] Create `backend/services/fit_score.py`:
  - `compute_fit_score(job_description: str, user_id: str) -> dict`
  - Algorithm:
    1. Embed JD
    2. Hybrid search per section (skills, experience, education, projects)
    3. Cosine similarity per section
    4. Weighted average: skills 40%, experience 35%, education 15%, projects 10%
    5. Multiply by 100 → integer score
    6. Pass score + evidence to Gemini for explanation
  - Return: `{"score": int, "explanation": str, "breakdown": dict}`
- [x] Test with 5 job descriptions:
  - Senior role + junior CV → expect score < 40
  - Junior role + senior CV → expect score > 70
  - Exact skill match → expect score > 80
  - No skill overlap → expect score < 30
  - Partial match → expect score 50–70

#### Afternoon (4–5 hours)

- [x] Create `backend/services/job_search.py`:
  - `search_jsearch(query: str, location: str) -> list[dict]`
  - `search_remotive(query: str) -> list[dict]`
  - `search_tavily(query: str, location: str) -> list[dict]`
  - `search_jobs(query: str, location: str) -> list[dict]` — three-tier fallback
- [x] Create `backend/services/cache.py`:
  - `cached_job_search(query: str, location: str) -> list[dict]`
  - Cache key: `jobs:{md5(query+location)}`
  - TTL: 7200 seconds
- [x] Create `backend/routers/jobs.py`:
  - `POST /api/jobs/search` — body: `{"query": str, "location": str}`
  - Returns: `[{"id": str, "title": str, "company": str, "location": str, "salary_range": str, "description": str, "source": str}]`
- [x] Test job search with: "ML engineer Dhaka", "Python developer remote", "Data analyst Bangladesh"

**Deliverable:** Fit score algorithm tested and working, job search returning results from all three APIs

---

### Day 5 — LangGraph Agent & Chat Memory

**Goal:** Agent loop working, chat memory persisting
**Time:** 8–10 hours

#### Morning (4–5 hours)

- [x] Install LangGraph: `pip install langgraph==0.2.28 langchain-core==0.3.15 langchain-groq==0.2.0`
- [x] Create `backend/services/agent.py`:
  - Define `AgentState` TypedDict
  - Create nodes: `search_node`, `score_node`, `filter_node`
  - Create conditional edge: `should_retry`
  - Compile graph
  - `run_job_hunter_agent(query: str, user_id: str) -> dict`
- [x] Create LangChain tools:
  - `@tool search_jobs_tool(query: str, location: str) -> List[dict]`
  - `@tool compute_fit_score_tool(job_description: str, user_id: str) -> dict`
  - `@tool get_cv_context_tool(user_id: str) -> str`
  - `@tool draft_cover_letter_tool(job_description: str, cv_context: str) -> str`
- [x] Test agent with: "Find me ML internships in Dhaka"
  - Verify it searches → scores → filters → returns top 10

#### Afternoon (4–5 hours)

- [x] Create `backend/services/chat.py`:
  - `get_chat_history(user_id: str, session_id: str) -> list[dict]` — fetch last 10 messages
  - `save_message(user_id: str, session_id: str, role: str, content: str)`
  - `stream_chat(user_id: str, session_id: str, message: str, cv_context: str) -> AsyncGenerator`
- [x] Create `backend/routers/chat.py`:
  - `POST /api/chat` — SSE streaming endpoint
  - Fetch history → RAG query for CV context → stream Groq response → save to DB
- [x] Test streaming:
  - Send "Am I ready for this data engineer role?" with a JD
  - Verify response references actual CV content
  - Send follow-up "What skills am I missing?" — verify memory works

**Deliverable:** LangGraph agent working, streaming chat with memory and RAG context

---

## PHASE 2 — Features + Integration (Days 6–10)

### Day 6 — Frontend Scaffold

**Goal:** Next.js app with auth, navigation, basic layouts
**Time:** 6–8 hours

#### Morning (3–4 hours)

- [x] Create Next.js project: `npx create-next-app@latest frontend --typescript --tailwind --app`
- [x] Install dependencies:
  ```bash
  npm install @supabase/supabase-js @supabase/ssr
  npm install @tanstack/react-query
  npm install ai
  npm install @dnd-kit/core @dnd-kit/sortable
  npm install recharts
  npm install lucide-react
  ```
- [x] Initialize shadcn: `npx shadcn-ui@latest init`
- [x] Add shadcn components: `npx shadcn-ui@latest add card button input textarea badge progress calendar`
- [x] Create Supabase clients:
  - `lib/supabase.ts` — browser client
  - `lib/supabase-server.ts` — server component client
- [x] Create auth pages:
  - `app/(auth)/login/page.tsx`
  - `app/(auth)/signup/page.tsx`
  - Use Supabase Auth with email/password

#### Afternoon (3–4 hours)

- [x] Create dashboard layout with old nav (temporary):
  - `app/(dashboard)/layout.tsx` — sidebar with 4 links: Jobs, CV, Chat, Tracker
  - User menu with logout
- [x] Create placeholder pages:
  - `app/(dashboard)/jobs/page.tsx`
  - `app/(dashboard)/cv/page.tsx`
  - `app/(dashboard)/chat/page.tsx`
  - `app/(dashboard)/tracker/page.tsx`
- [x] Add protected route middleware:
  - Check Supabase session
  - Redirect to /login if not authenticated
- [x] Test auth flow: signup → login → dashboard → logout

**Deliverable:** Frontend scaffold with working auth, navigation, placeholder pages

---

### Day 7 — Deployment + Job Cards UI

**Goal:** 🚀 Live deployment, job search UI working
**Time:** 6–8 hours

#### Morning (2–3 hours) — Deploy first

- [x] Backend deployment (Render):
  - Create `backend/Dockerfile` (if not exists)
  - Push to GitHub
  - Connect repo at render.com → New → Web Service
  - Select `backend` as root directory
  - Build command: `pip install -r requirements.txt`
  - Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
  - Add all environment variables in Render dashboard
  - Get Render URL: `https://your-app.onrender.com`
- [x] Frontend deployment (Vercel):
  - Push to GitHub
  - Connect repo at vercel.com
  - Add environment variables:
    - `NEXT_PUBLIC_SUPABASE_URL`
    - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
    - `NEXT_PUBLIC_API_URL=https://your-app.onrender.com`
  - Get Vercel URL: `https://your-app.vercel.app`
- [x] Test deployed endpoints:
  - `curl https://your-app.onrender.com/api/cv/upload`
  - `curl https://your-app.onrender.com/api/jobs/search`

#### Afternoon (4–5 hours) — Job cards UI

- [x] Create `components/job-card.tsx`:
  - Display: title, company, location, salary range, deadline
  - Fit score badge with color coding: <40 red, 40–70 yellow, >70 green
  - "View Details" button
- [x] Create `components/fit-score-badge.tsx`:
  - Circular progress indicator
  - Score percentage
  - Tooltip with explanation
- [x] Update `app/(dashboard)/jobs/page.tsx`:
  - Search bar with location filter
  - Grid of job cards
  - Loading state
  - Empty state: "No jobs found"
- [x] Connect to backend:
  - `POST /api/jobs/search` on search submit
  - Display results as job cards
- [x] Test with real searches: "Python developer Dhaka", "ML engineer remote"

**Deliverable:** 🚀 App deployed and accessible, job search UI working with fit scores

---

### Day 7.5 — Nav Restructure *(one short session before Day 8)*

**Goal:** Rename routes and sidebar to match new navigation structure. 5 file touches, zero new component logic.
**Time:** 1–2 hours

> **Why now:** Restructuring routing after Day 10 risks breaking live features during the polish phase. One session now saves a long debugging session later.

#### The only 5 files to touch

- [ ] `app/(dashboard)/layout.tsx` — update sidebar:
  - Replace 4-item nav (Jobs, CV, Chat, Tracker) with 5-item nav:
    - Home → `/` (icon: `LayoutDashboard`)
    - Jobs → `/jobs` (icon: `Briefcase`) — unchanged
    - My journey → `/journey` (icon: `Map`)
    - AI assistant → `/ai` (icon: `MessageCircle`)
    - Profile → `/profile` (icon: `UserCircle`)
  - Apply dark sidebar styling: `bg-[#111110]` for sidebar, white for content area
  - Active state: `bg-[#1e1b38] text-[#AFA9EC]` — no underlines, no highlight bars
  - Keep user avatar + logout in sidebar footer
  - Add mobile bottom tab bar (5 items, same order) — stub only, style on Day 11
- [ ] `app/(dashboard)/journey/page.tsx` — create file, copy content from `tracker/page.tsx`, delete `tracker/` folder
- [ ] `app/(dashboard)/ai/page.tsx` — create file, copy content from `chat/page.tsx`, delete `chat/` folder
- [ ] `app/(dashboard)/profile/page.tsx` — create file, copy content from `cv/page.tsx`, delete `cv/` folder
- [ ] `app/(dashboard)/page.tsx` — create Home page stub:
  ```tsx
  export default function HomePage() {
    return <div className="p-6 text-muted-foreground">Home dashboard — coming Day 10</div>
  }
  ```

#### After the 5 file touches

- [ ] Verify all 5 routes load without 404: `/`, `/jobs`, `/journey`, `/ai`, `/profile`
- [ ] Verify `/jobs` still works end-to-end (job search + fit scores)
- [ ] Push to GitHub → confirm Vercel redeploys cleanly
- [ ] Update any internal `router.push()` or `<Link href>` references that pointed to old routes

**Deliverable:** New 5-item dark sidebar live on Vercel, all old routes redirected, no broken functionality

---

### Day 8 — Streaming Chat UI

**Goal:** Chat interface with streaming, RAG, and memory — built at `/ai`
**Time:** 6–8 hours

#### Morning (3–4 hours)

- [x] Create `app/api/chat/route.ts`:
  - Proxy streaming requests to FastAPI backend
  - Handle SSE stream
  - Return as ReadableStream
- [x] Create `components/chat-interface.tsx`:
  - Dark user bubble (`bg-[#1e1b38] text-[#AFA9EC]`) / light assistant bubble
  - Input field with send button
  - Loading indicator while streaming
  - Use Vercel AI SDK `useChat` hook
- [x] Update `app/(dashboard)/ai/page.tsx`:
  - Render `<ChatInterface />`
  - Session switcher (dropdown to start new session)
  - "Clear history" button

#### Afternoon (3–4 hours)

- [x] Test all benchmark queries from problem statement:
  - "Am I ready for this data engineer role?" → paste a JD
  - "What skills am I missing for a Google internship?"
  - "Build me a 3-month roadmap to become job-ready"
  - "Draft a cover letter for this job posting" → paste a JD
- [x] Verify:
  - Responses reference actual CV content (RAG working)
  - Follow-up questions work (memory working)
  - Tokens stream in real-time (no lag)
- [x] Add markdown rendering for assistant responses
- [x] Add copy button for cover letters

**Deliverable:** Streaming chat working with RAG and memory at `/ai`, all benchmark queries answered

---

### Day 9 — Kanban Board

**Goal:** Drag-and-drop application tracker with Realtime updates — built at `/journey`
**Time:** 6–8 hours

#### Morning (3–4 hours)

- [x] Create `components/kanban-board.tsx`:
  - Five columns: Saved, Applied, Interviewing, Offer, Rejected
  - Use dnd-kit for drag and drop
  - Each card shows: job title, company, applied date
- [x] Create backend endpoints in `backend/routers/tracker.py`:
  - `GET /api/applications` — fetch all applications for user
  - `POST /api/applications` — create new application
  - `PATCH /api/applications/:id` — update status
  - `DELETE /api/applications/:id` — delete application

#### Afternoon (3–4 hours)

- [x] Add Supabase Realtime subscription:
  - Subscribe to `applications` table changes
  - Update Kanban board in real-time when status changes
- [x] Add "Add to Tracker" button on job cards
  - Saves job to `applications` table with status "Saved"
- [x] Update `app/(dashboard)/journey/page.tsx`:
  - Add sub-tab bar: Kanban | Calendar | Tasks | Stats
  - Render `<KanbanBoard />` under Kanban tab (other tabs are stubs for now)
  - Drag card → update status in Supabase → Realtime fires → UI updates
- [ ] Test:
  - Open app in two browser windows
  - Drag card in window 1 → verify window 2 updates instantly

**Deliverable:** Kanban board working with drag-and-drop and Realtime updates at `/journey`

---

### Day 10 — Home Dashboard + Calendar + Todos + Nudges

**Goal:** Complete Pillar 4 and ship the Home page as a real deliverable
**Time:** 8–10 hours (longest day in Phase 2)

#### Morning (4–5 hours) — Home page + Nudges

- [ ] Build `app/(dashboard)/page.tsx` (Home) — replace the stub:
  - Stats grid (4 cards): applications sent, roadmap %, new matches, streak days
  - Top job matches section: 2–3 job cards pulled from last search, highest fit scores first
  - AI nudge banner component at top:
    - Subscribe to `nudges` table via Realtime
    - Show banner when new nudge arrives: *"You haven't applied this week. Here are 3 openings."*
    - "Dismiss" button marks nudge as seen
- [ ] Create `components/progress-dashboard.tsx`:
  - Weekly stats cards with real data from `GET /api/dashboard/stats`
  - Line chart: applications over time (Recharts)
  - Bar chart: fit score distribution
- [ ] Create backend endpoint `GET /api/dashboard/stats`:
  - Query `progress_snapshots` table
  - Return current week stats
- [ ] Set up AI nudges:
  - Enable pg_cron in Supabase (Extensions → pg_cron)
  - Create cron job (see `CareerPilot_Stack_Final.md` Section 10)
  - Runs every Monday 9 AM UTC
  - Inserts nudge if user hasn't applied this week

#### Afternoon (4–5 hours) — Calendar + Todos inside `/journey`

- [ ] Create `components/calendar-view.tsx`:
  - Use shadcn Calendar component
  - Show todos and deadlines on calendar dates
  - Click date → show todos for that day
- [ ] Create `components/todo-list.tsx`:
  - List of todos with checkboxes
  - Add new todo button
  - Link todos to goals
- [ ] Create backend endpoints in `backend/routers/tracker.py`:
  - `GET /api/goals` — fetch all goals
  - `POST /api/goals` — create goal
  - `GET /api/todos` — fetch todos (optionally filtered by date)
  - `POST /api/todos` — create todo
  - `PATCH /api/todos/:id` — mark complete/incomplete
- [ ] Wire up `/journey` sub-tabs:
  - Kanban tab → `<KanbanBoard />` (already done Day 9)
  - Calendar tab → `<CalendarView />`
  - Tasks tab → `<TodoList />`
  - Stats tab → `<ProgressDashboard />` (moved here from Home — stats live in both places)

**Deliverable:** Home page live with stats + nudge banner. Calendar, todos, all `/journey` sub-tabs working.

---

## PHASE 3 — Polish + Bonus (Days 11–14)

### Day 11 — Seed Data, Bug Fixes + Polish Items

**Goal:** Demo-ready database, all edge cases handled, three polish features attempted
**Time:** 8–10 hours

#### Morning (3–4 hours) — Seed data + bug fixes

- [ ] Create `scripts/seed.py`:
  - 3 sample CVs (junior, mid-level, senior)
  - 20 sample jobs (mix of fit scores)
  - 5 applications across Kanban columns
  - 3 goals with linked todos
  - 1 progress snapshot with realistic stats (12-day streak, 47 applications)
  - 10 chat messages (demonstrate memory)
- [ ] Run seed script on deployed database
- [ ] Create test user account: `demo@careerpilot.com` / `Demo123!`
- [ ] Bug hunt and fix:
  - Test all flows end-to-end on deployed URL
  - Check error handling: file upload fails, API rate limits, network errors
  - Add loading states where missing
  - Add error boundaries in React components
  - Fix any broken links or 404s

#### Afternoon (4–6 hours) — Three polish items *(attempt all, cut if time runs short)*

**Polish item 1 — Floating AI bubble** *(highest priority)*
- [ ] Create `components/ai-fab.tsx`:
  - Fixed `bottom-4 right-4` circular button, `bg-[#534AB7]`, `MessageCircle` icon
  - On click: open a slide-up drawer with `<ChatInterface />` (reuse the Day 8 component)
  - Visible on every page except `/ai` (hide it there — user is already in full chat)
  - Add to `app/(dashboard)/layout.tsx`

**Polish item 2 — Job card side panel** *(medium priority)*
- [ ] Update `components/job-card.tsx`:
  - Replace "View Details" button with a click handler that opens a right-side sheet
  - Sheet content: full job description, fit score breakdown by section, "Ask AI about this role" button (calls `sendPrompt` to AI assistant), "Add to Tracker" button
  - Use shadcn `Sheet` component (`side="right"`)

**Polish item 3 — Onboarding wizard** *(attempt if time allows)*
- [ ] Create `components/onboarding-wizard.tsx`:
  - Show only if user has no CV uploaded (check `cvs` table on login)
  - Step 1: Upload CV (drag-and-drop, reuse existing upload logic)
  - Step 2: Processing animation — "Parsing your CV… Embedding sections… Building your profile…"
  - Step 3: Welcome screen — "Your profile is ready. Here are your first 3 job matches."
  - On complete: redirect to Home `/`
- [ ] Add check in `app/(dashboard)/layout.tsx`: if no CV → redirect to `/onboarding`
- [ ] Create `app/onboarding/page.tsx` (outside dashboard layout — full-screen wizard)

**Cut rule:** If behind on time, cut Polish item 3 entirely. Cut Polish item 2 before cutting item 1. The AI bubble has the highest visual impact for judges.

- [ ] General UI polish (do last):
  - Consistent spacing and typography across all 5 pages
  - Mobile responsive — test bottom tab bar on phone
  - Add empty states with helpful messages
  - Add success toasts for actions (application saved, todo completed)
  - Check Lighthouse score (aim for >80)

**Deliverable:** Fully seeded database, all bugs fixed, floating AI bubble live, side panel attempted, onboarding wizard if time allows

---

### Day 12 — Evaluation Suite

**Goal:** 5 documented test cases for bonus points
**Time:** 4–6 hours

#### Morning (2–3 hours)

- [ ] Create `eval.md` with this structure:

  ```markdown
  # CareerPilot Evaluation Suite

  ## Test Case 1: CV Upload (PDF Multi-Column)

  **Input:** sample_cv_canva.pdf (2-column Canva template)
  **Expected:** All 4 sections parsed correctly, no text scrambling
  **Actual:** [PASS/FAIL]
  **Evidence:** [Screenshot or JSON output]

  ## Test Case 2: Fit Score Accuracy (Mismatch)

  **Input:** Senior ML Engineer JD + Junior Developer CV
  **Expected:** Score < 40%, explanation mentions missing senior experience
  **Actual:** Score = 32%, explanation = "Limited ML experience..."
  **Verdict:** PASS

  [... 3 more test cases]
  ```

#### Afternoon (2–3 hours)

- [ ] Run all 5 test cases:
  1. CV Upload (PDF multi-column)
  2. Fit Score Accuracy (mismatch)
  3. Fit Score Accuracy (exact match)
  4. Chat Memory (follow-up question)
  5. Realtime Updates (Kanban drag in two windows)
- [ ] Document results with screenshots
- [ ] Fix any failing tests
- [ ] Commit `eval.md` to repo

**Deliverable:** `eval.md` with 5 passing test cases

---

### Day 13 — System Design Document

**Goal:** Architecture diagram, scaling analysis, cost breakdown
**Time:** 4–6 hours

#### Morning (2–3 hours)

- [ ] Create `system-design.md` with sections:
  1. **Architecture diagram** (use Mermaid or draw.io)
     - User → Next.js → FastAPI → Supabase/Voyage/Groq/Gemini
     - Show data flow: CV upload → parsing → embedding → vector DB
     - Show agent loop: search → score → filter
  2. **Data flow**
     - CV Upload: PDF → Gemini → JSON → Voyage → pgvector
     - Job Search: Query → Redis check → API call → cache → fit score
     - Chat: Message → history → RAG → Groq stream → save
  3. **Tech stack justification**
     - Why Groq for chat (speed)
     - Why Gemini for parsing (multimodal, 1M context)
     - Why hybrid search (keyword + semantic)

#### Afternoon (2–3 hours)

- [ ] Add scaling analysis:
  - **At 10,000 users:**
    - Supabase: 500 MB → 2–4 GB (upgrade to Pro $25/mo)
    - LLM: Groq free → paid or self-hosted ($50–200/mo)
    - Job APIs: JSearch free → paid + Redis cache ($10/mo)
    - Total: ~$135–315/mo → $0.01–0.03 per user
  - **Bottlenecks:**
    1. LLM rate limits → Mitigation: Redis caching, queue system
    2. Render cold starts → Mitigation: Keep-alive pings, upgrade to paid tier for always-on
    3. Supabase connections → Mitigation: pgBouncer (built-in)
  - **Cost optimization:**
    - Redis caching reduces API calls by 80%
    - Batch embeddings reduce Voyage API calls
    - Supabase Realtime reduces polling
- [ ] Add architecture diagram (Mermaid code or image)
- [ ] Commit `system-design.md` to repo

**Deliverable:** `system-design.md` with diagram, scaling analysis, cost breakdown

---

### Day 14 — Demo Video & Final Submission

**Goal:** 5-minute demo video, final polish, submit
**Time:** 6–8 hours

#### Morning (3–4 hours) — Record demo

- [ ] Script the demo (see `CareerPilot_Stack_Final.md` Section 18):
  - 0:00–0:20: Onboarding wizard (CV upload → processing → welcome)
  - 0:20–0:50: Home dashboard (stats, nudge banner, top matches)
  - 0:50–1:30: Jobs page (live search, job cards, fit score breakdown in side panel)
  - 1:30–2:15: AI assistant (benchmark query + follow-up showing memory)
  - 2:15–3:00: Cover letter draft from AI assistant
  - 3:00–3:45: My journey (Kanban drag, Calendar, Todos)
  - 3:45–4:15: Profile page (parsed CV sections, skills)
  - 4:15–5:00: Floating AI bubble demo + wrap-up
- [ ] Record demo (use OBS Studio or Loom):
  - Use seeded database (looks actively used)
  - Show real data, not placeholders
  - Speak clearly, explain what you're doing
  - Keep it under 5 minutes
- [ ] Record twice, use better take
- [ ] Edit: add title card, trim dead air, export as MP4

#### Afternoon (3–4 hours) — Final polish & submit

- [ ] Update README.md:
  - Project description
  - Features list (all four pillars)
  - Tech stack
  - Setup instructions:

    ```bash
    # Backend
    cd backend
    python -m venv venv
    source venv/bin/activate  # or venv\Scripts\activate on Windows
    pip install -r requirements.txt
    cp .env.example .env  # add your API keys
    uvicorn main:app --reload

    # Frontend
    cd frontend
    npm install
    cp .env.local.example .env.local  # add your Supabase keys
    npm run dev
    ```

  - Environment variables list
  - Live demo link
  - Demo video link

- [ ] Create architecture diagram (if not done on Day 13)
- [ ] Final checks:
  - All links in README work
  - Live deployment is stable
  - Demo video is uploaded (YouTube unlisted or Google Drive)
  - All required files present: README, eval.md, system-design.md
- [ ] Submit:
  - GitHub repo URL
  - Live deployment URL
  - Demo video URL
  - Any other required forms

**Deliverable:** 🎉 Complete submission with demo video, all bonus points earned

---

## Daily Checklist Template

Copy this for each day:

```
## Day X — [Goal]
Date: ___________
Start time: _____
End time: _____

### Morning Tasks
- [ ] Task 1
- [ ] Task 2
- [ ] Task 3

### Afternoon Tasks
- [ ] Task 4
- [ ] Task 5
- [ ] Task 6

### Blockers
- None / [Describe blocker]

### Notes
- [Any important decisions or learnings]

### Tomorrow's Priority
- [Top 1-2 things to tackle first]
```

---

## Emergency Fallback Plan

If you fall behind schedule:

### If behind by 1 day (Day 6):

- **Cut:** In-platform CV builder (already planned to skip)
- **Cut:** Streak counter in progress dashboard
- **Keep:** Everything else

### If behind by 2 days (Day 8):

- **Cut:** AI nudges (pg_cron)
- **Cut:** Calendar view (keep todos only)
- **Simplify:** Progress dashboard (show only applications count)
- **Keep:** All four pillars functional

### If behind by 3+ days (Day 10):

- **STOP.** Reassess scope.
- **Minimum viable demo:**
  1. CV upload working
  2. Job search with fit scores
  3. Chat with RAG (no memory)
  4. Kanban board (no Realtime)
- **Skip:** Calendar, todos, Home dashboard, nudges, bonus points, all three polish items
- **Focus:** Core demo flow for video

**DO NOT skip deployment (Day 7).** A broken local demo is worse than a simple deployed demo.

---

## Success Metrics

By end of Day 14, you should have:

- [x] All four pillars implemented
- [x] Live deployment (Vercel + Render)
- [x] 5-minute demo video
- [x] Evaluation suite (5 test cases)
- [x] System design document
- [x] Seeded database with realistic data
- [x] README with setup instructions
- [x] GitHub repo with clean commit history

**If you have all of these, you're in the top 10%.**

---

_Last updated: Day 8 · Codesprint 2026_
_Related docs: `AGENTS.md` · `CareerPilot_Stack_Final.md` · `PRD.md`_
