# CareerPilot — Product Requirements Document
**Codesprint 2026 · Version 1.0 · Status: Active**

---

## Overview

CareerPilot is an agentic career co-pilot. It actively works for the user — hunting jobs,
scoring fit against their real CV, drafting applications, and tracking progress.
The RAG layer over the user's own CV is the single source of truth.
No agent ever hallucinates the user's background.

**Users:** Job seekers in Bangladesh (primary), remote workers globally (secondary).
**Demo user:** A Bangladeshi CS graduate searching for ML/software engineering roles in Dhaka.

---

## Pillar 1 — Job Hunter Agent

### User Story
As a job seeker, I want to describe what I'm looking for in plain English and get
structured job cards that match my actual profile — not generic results.

### Input
Natural language query. Examples:
- "Find me ML internships in Dhaka open this month"
- "Show me remote backend engineering jobs paying above 50k BDT"
- "Find data engineering roles at product companies in Bangladesh"

### Output — Job Card
Each result must contain:
```
title         string    Job title
company       string    Company name
location      string    City / Remote / Hybrid
salary_range  string    Range or "Not specified"
deadline      string    Application deadline or "Not specified"
fit_score     integer   0–100 computed programmatically
fit_snippet   string    One sentence explaining the score
source        string    Which API returned this (JSearch / Remotive / Tavily)
apply_url     string    Direct application link
```

### Agent Behaviour
1. Parse the user's query for role, location, seniority, salary intent
2. Call job search APIs in priority order (JSearch → Remotive → Tavily)
3. For each result, compute fit score against user's CV chunks
4. Sort by fit score descending
5. Explain WHY each result matches or doesn't, referencing the actual CV
6. Return minimum 3, maximum 10 job cards

### Acceptance Criteria
- [ ] Returns structured cards (not raw text) for any natural language query
- [ ] Fit score is an integer 0–100, computed via cosine similarity (not LLM guess)
- [ ] At least one live API call to a real job board per query
- [ ] Agent explains its reasoning for each match
- [ ] Results are cached in Redis (2h TTL) to avoid repeat API calls
- [ ] Returns results for Dhaka-based queries (Bangladesh coverage confirmed)

---

## Pillar 2 — Profile & Resume Intelligence (RAG Core)

### User Story
As a job seeker, I want to upload my CV once and have the platform understand
everything about me — so every recommendation is personalised to my actual background.

### CV Upload Flow
```
User uploads PDF or DOCX
    ↓
File type check → route to correct parser
    ↓
PDF  → Gemini 2.0 Flash multimodal → structured JSON
DOCX → python-docx → raw text → Gemini → structured JSON
    ↓
Section-aware chunking
{section: "skills",     content: "Python, FastAPI, PostgreSQL..."}
{section: "experience", content: "Software Engineer at XYZ..."}
{section: "education",  content: "BSc Computer Science..."}
{section: "projects",   content: "Built a RAG pipeline..."}
    ↓
Voyage AI voyage-3 embeddings (1024 dimensions)
    ↓
Store in Supabase pgvector with section metadata
    ↓
Show parsed sections to user for confirmation
```

### Acceptance Criteria
- [ ] Accepts PDF and DOCX files (both required)
- [ ] Handles multi-column CV layouts without scrambling text order
- [ ] Parsed sections shown to user after upload (confirmation step)
- [ ] Each chunk stored with correct section label and user_id
- [ ] Hybrid search returns relevant chunks within 1 second
- [ ] Uploading a new CV replaces the old one (user has one active CV at a time)

### Fit Score Algorithm
```python
WEIGHTS = {"skills": 0.40, "experience": 0.35, "education": 0.15, "projects": 0.10}

for section, weight in WEIGHTS.items():
    top_chunks = hybrid_search(jd_embedding, section=section, top_k=3)
    section_score = mean(cosine_similarity(jd_embedding, chunk) for chunk in top_chunks)
    weighted_score += section_score * weight

final_score = round(weighted_score * 100)  # integer 0–100
```

---

## Pillar 3 — Personal AI Assistant

### User Story
As a job seeker, I want a chat assistant that already knows my background and can
give me personalised advice — without me having to explain myself every time.

### Required Query Types (all must work in the demo)

| Query | Expected behaviour |
|-------|--------------------|
| "Am I ready for this data engineer role?" | Verdict (yes/partial/no) + reasoning grounded in CV + specific gaps identified |
| "What skills am I missing for a Google internship?" | Gap analysis comparing user CV to benchmark profile for the role |
| "Build me a 3-month roadmap to become job-ready" | Week-by-week plan with specific learning resources (courses, docs, projects) |
| "Draft a cover letter for this job posting" | Full cover letter referencing user's actual experience, tailored to the JD |
| Follow-up: "Make it more concise" | Response acknowledges previous message — proves session memory works |

### Technical Requirements
- Streaming responses — user sees tokens as they arrive, never waits for full response
- Session memory — last 10 messages from `chat_messages` table included in every request
- RAG grounding — relevant CV chunks retrieved and injected into system prompt
- No hallucination — assistant must only reference experience that exists in the CV

### System Prompt Structure
```
You are CareerPilot, an expert career assistant.
The user's CV context:
  Skills: {cv_skills_chunk}
  Experience: {cv_experience_chunk}
  Education: {cv_education_chunk}

Conversation history: {last_10_messages}

Current query: {user_message}

Rules:
- Only reference experience that exists in the CV above
- Be specific — cite actual skills and roles, not generic advice
- If asked for a roadmap, structure it week by week
- If asked for a cover letter, output the full letter
```

### Acceptance Criteria
- [ ] Streaming works — tokens appear progressively in the UI
- [ ] All five query types above return relevant, grounded responses
- [ ] Follow-up questions work correctly (memory demonstrated)
- [ ] Cover letter references at least 2 specific items from the user's actual CV
- [ ] Roadmap output is structured (week labels, specific resources)
- [ ] Gap analysis names specific missing skills, not generic "improve coding"

---

## Pillar 4 — Productivity & Progress Tracker

### User Story
As a job seeker, I want to track every application, set goals, and see my
progress at a glance — so I stay accountable and never miss a deadline.

### Application Tracker (Kanban)

Four columns, in order:
```
Applied → Interviewing → Offer → Rejected
```
Plus a hidden `saved` state (job saved but not yet applied).

Behaviour:
- Drag a card between columns → immediate Supabase update → Realtime reflects across all open tabs
- Each card shows: job title, company, fit score badge, date applied
- Clicking a card shows full history and notes field

### Calendar & To-Do

- Calendar view showing: application deadlines, interview dates, todo due dates
- Create a todo → link it to a goal (optional) → set a due date
- Overdue todos highlighted in red
- Use shadcn Calendar component

### Goal Setting

User can create goals:
```
"Apply to 5 jobs this week"     → target: 5, unit: applications, deadline: Sunday
"Finish DSA course by Friday"   → target: 1, unit: completion, deadline: Friday
"Update CV by Sunday"           → target: 1, unit: completion, deadline: Sunday
```

Progress bar shows completion percentage.

### Progress Dashboard

Live stats displayed as metric cards:
```
Applications sent (this week)   integer
Skills added (total)            integer
Roadmap completion              percentage 0–100%
Current streak                  integer (days with at least 1 action)
```

Charts using Recharts:
- Bar chart: applications per week (last 4 weeks)
- Donut chart: Kanban status breakdown

### AI Nudges

Proactive reminders triggered by pg_cron (runs weekly, Monday 9 AM UTC):
- If user has 0 applications this week → nudge with 3 matching job suggestions
- Nudge appears as a dismissible banner via Supabase Realtime

### Acceptance Criteria
- [ ] Drag and drop between all Kanban columns works
- [ ] Kanban updates are reflected in real time (Supabase Realtime)
- [ ] Calendar shows deadlines and todos
- [ ] At least one working goal with progress tracking
- [ ] Dashboard shows real data (not hardcoded)
- [ ] Streak counter increments correctly
- [ ] At least one AI nudge can be triggered and displayed

---

## Non-Functional Requirements

| Requirement | Target | How |
|-------------|--------|-----|
| Chat response start | < 1 second to first token | Groq streaming |
| Job search response | < 3 seconds | Redis cache + parallel API calls |
| CV processing | < 10 seconds end-to-end | Gemini cloud parsing |
| Fit score computation | < 2 seconds | pgvector HNSW index |
| Uptime during judging | 100% | Deploy Day 7, freeze config |

---

## Out of Scope (explicitly excluded)

- In-platform CV builder (upload only — the problem statement uses OR)
- Mobile app (web only)
- Multi-language support
- Email notifications (Supabase Realtime nudges only)
- Payment or subscription features
- CV export to PDF
- Social features (sharing, referrals)

---

## Bonus Deliverables

### Live Deployment
- Frontend: Vercel — public URL available on Day 7
- Backend: Railway — public API URL available on Day 7
- Both must be stable and functional during judging

### System Design Document (`system-design.md`)
- Data flow diagram (CV upload through to agent response)
- Scale analysis to 10,000 users
- Cost per user per month (~$0.01–$0.03)
- Key bottlenecks: LLM rate limits, pgvector at scale, JSearch quotas
- Mitigations: Redis caching (already in stack), HNSW index (already configured)

### Evaluation Suite (`eval.md`)
Minimum 5 test cases:

| # | Input CV | Input JD | Expected score range | Pass condition |
|---|----------|----------|---------------------|----------------|
| 1 | Python ML engineer, 3 years | ML Engineer role requiring Python, TensorFlow | 75–90% | Score in range |
| 2 | Fresh graduate, no experience | Senior backend engineer, 5 years required | 10–30% | Score in range |
| 3 | Full-stack dev, React + Node | Frontend React engineer role | 60–80% | Score in range |
| 4 | Data analyst, SQL + Excel | Data engineer, Python + Spark | 30–55% | Score in range |
| 5 | DevOps engineer, AWS + Docker | Backend Python engineer | 40–65% | Score in range |

Each test case must show: actual score output, actual explanation, pass/fail verdict.

---

## Demo Video Script (5 minutes — must follow this exact flow)

```
00:00 – 00:30   Upload a PDF CV. Show parsing in progress. Show sections appear.
00:30 – 01:15   Type "Find me ML engineering jobs in Dhaka". Show agent running.
                Show job cards with fit scores and explanations.
01:15 – 02:00   Click one job card. Show fit score breakdown by section.
                Show the one-sentence explanation referencing the CV.
02:00 – 02:45   Open AI Assistant. Ask "Am I ready for this role?"
                Show streaming response. Ask a follow-up. Show memory working.
02:45 – 03:30   Ask "Draft a cover letter for this job." Show personalised output.
03:30 – 04:15   Drag job card to "Applied" on Kanban. Show dashboard update live.
04:15 – 05:00   Show progress dashboard: streak, applications, roadmap %.
                Show a nudge notification appear.
```

**Before recording:** Run the seed data script. Dashboard must show active data.

---

## Definition of Done

A feature is done when:
1. The happy path works end-to-end
2. An unfamiliar CV (not the one you tested with) returns reasonable results
3. It works on the deployed version (Vercel + Railway), not just locally
4. There are no console errors in the browser during the demo flow

---

*CareerPilot · PRD v1.0 · Codesprint 2026*
*Related: AGENTS.md · CareerPilot_Stack_Final.md · eval.md · system-design.md*
