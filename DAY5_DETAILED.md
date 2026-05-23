# DAY 5 - LangGraph Agent & Chat Memory (Detailed AI-Executable Guide)

**CareerPilot - Codesprint 2026 - DEV1 Backend**

> This guide assumes Day 4 service code exists for job search and fit scoring.
> Day 5 wires those services into an agent workflow and builds the streaming assistant with CV context and session memory.

**Estimated Time:** 8-10 hours  
**Goal:** Job hunter agent works through tools, and chat streams grounded responses with conversational memory.

---

## Day 5 Scope (STRICT)

**What Day 5 DOES:**

- Implement LangGraph job hunter agent
- Define tools around existing Day 4 services
- Build chat memory helpers using `chat_messages`
- Build streaming chat endpoint with Groq Llama 3.3 70B
- Retrieve CV context through hybrid search
- Persist user and assistant messages
- Demonstrate follow-up memory within a session

**What Day 5 DOES NOT DO:**

- No frontend chat UI
- No Vercel AI SDK proxy route
- No Kanban/tracker work
- No new fit score algorithm
- No duplicate job search implementation inside the agent
- No Gemini for user-visible streaming chat
- No OpenAI/Anthropic/Cohere/Mistral

---

## Current Blockers / Manual Tasks

If Supabase access is unavailable, implement code and run local/import tests only.

- [ ] Real Supabase Auth user UUID exists
- [ ] `chat_messages` table exists
- [ ] User has uploaded CV chunks
- [ ] `hybrid_search` RPC works
- [ ] `GROQ_API_KEY` is valid
- [ ] Day 4 job search and fit score services are available

**Important:** Streaming chat can be tested only when Groq key is valid. RAG and memory require Supabase.

---

## Technical Baseline

- Python version: **3.11**
- Backend: FastAPI
- Agent framework: **LangGraph**
- Chat LLM: **Groq Llama 3.3 70B**
- Reasoning/background LLM: Gemini 2.0 Flash only where needed
- Supabase client currently sync unless the whole project converts to async
- Streaming response type: FastAPI `StreamingResponse` with SSE

---

## What You'll Build Today

```text
Job Hunter Agent:
User query
    |
    v
LangGraph state
    |
    v
Search jobs tool -> fit score tool -> filter/sort
    |
    v
Structured job cards

Streaming Chat:
User message
    |
    v
Fetch last 10 messages from chat_messages
    |
    v
Retrieve relevant CV chunks via hybrid_search
    |
    v
Groq Llama 3.3 70B streaming SSE
    |
    v
Save assistant response to chat_messages
```

---

## PHASE 1 - Dependencies & Imports (45 minutes)

### Step 1.1: Verify Dependencies

Install only if missing:

```bash
pip install langgraph langchain-core langchain-groq
```

If dependency installation is blocked by time, use a lightweight Python tool loop as fallback, but keep the service interface the same:

```python
async def run_job_hunter_agent(query: str, location: str, user_id: str) -> dict:
    ...
```

### Step 1.2: Forbidden Imports

Do not use:

```python
import openai
from anthropic import Anthropic
from langchain import ...
```

Allowed:

```python
from langgraph.graph import StateGraph, END
from langchain_core.tools import tool
from groq import Groq
```

Use LangGraph directly or a Python tool loop. Do not build the app around old `langchain` imports.

---

## PHASE 2 - Agent State & Tools (2 hours)

### Step 2.1: Define Agent State

Create or update `backend/services/agent.py`.

```python
from typing import TypedDict


class AgentState(TypedDict):
    user_id: str
    query: str
    location: str
    jobs: list[dict]
    selected_jobs: list[dict]
    error: str | None
```

### Step 2.2: Tool Rules

Tools should wrap existing services. Do not duplicate logic.

Required tools:

- `search_jobs_tool(query: str, location: str, user_id: str) -> list[dict]`
- `get_cv_context_tool(user_id: str, query: str) -> str`
- `draft_cover_letter_tool(job_description: str, cv_context: str) -> str`

Optional if Day 4 already returns scored jobs:

- `compute_fit_score_tool(job_description: str, user_id: str) -> dict`

### Step 2.3: Search Tool

```python
async def search_jobs_tool(query: str, location: str, user_id: str) -> list[dict]:
    return await search_jobs_with_scores(query=query, location=location, user_id=user_id)
```

If Day 4 service is still named differently, adapt the import but keep the tool behavior.

### Step 2.4: CV Context Tool

```python
async def get_cv_context_tool(user_id: str, query: str) -> str:
    chunks = await hybrid_search(query=query, user_id=user_id, match_count=5)
    if not chunks:
        return "No CV context available."
    return "\n\n".join(f"[{c['section']}] {c['content']}" for c in chunks)
```

If Supabase is blocked, this tool should fail gracefully and return `"No CV context available."`

---

## PHASE 3 - LangGraph Workflow (2 hours)

### Step 3.1: Create Nodes

Suggested nodes:

```text
start
  |
  v
search_node
  |
  v
filter_node
  |
  v
response_node
```

`search_node`:

- calls Day 4 search + score service
- stores jobs in state

`filter_node`:

- keeps top 10 jobs
- sorts by `fit_score`
- stores in `selected_jobs`

`response_node`:

- returns structured output
- does not turn cards into prose

### Step 3.2: Compile Graph

Example structure:

```python
from langgraph.graph import StateGraph, END

graph = StateGraph(AgentState)
graph.add_node("search", search_node)
graph.add_node("filter", filter_node)
graph.set_entry_point("search")
graph.add_edge("search", "filter")
graph.add_edge("filter", END)

job_hunter_graph = graph.compile()
```

### Step 3.3: Public Agent Function

```python
async def run_job_hunter_agent(query: str, location: str, user_id: str) -> dict:
    initial_state = {
        "user_id": user_id,
        "query": query,
        "location": location,
        "jobs": [],
        "selected_jobs": [],
        "error": None,
    }

    result = await job_hunter_graph.ainvoke(initial_state)
    return {
        "jobs": result.get("selected_jobs", []),
        "count": len(result.get("selected_jobs", [])),
    }
```

If LangGraph dependency is not available, implement the same function with a direct Python flow and document the fallback.

---

## PHASE 4 - Jobs Router Agent Endpoint (45 minutes)

### Step 4.1: Add Endpoint

Add or update `backend/routers/jobs.py`.

```text
POST /api/jobs/agent
```

Request:

```json
{
  "user_id": "real-supabase-auth-uuid",
  "query": "Find ML internships in Dhaka",
  "location": "Dhaka"
}
```

Response:

```json
{
  "jobs": [
    {
      "title": "ML Intern",
      "company": "Example AI",
      "location": "Dhaka",
      "fit_score": 82,
      "fit_explanation": "Strong match because..."
    }
  ],
  "count": 1
}
```

The existing `POST /api/jobs/search` may remain as a direct service endpoint. The agent endpoint is useful for Day 5 demo/testing.

---

## PHASE 5 - Chat Memory Service (1.5 hours)

### Step 5.1: Create Chat Service

Create `backend/services/chat.py`.

```python
from db.supabase import supabase

MEMORY_LIMIT = 10


def get_chat_history(user_id: str, session_id: str) -> list[dict]:
    result = supabase.table("chat_messages").select(
        "role, content"
    ).eq("user_id", user_id).eq("session_id", session_id).order(
        "created_at", desc=True
    ).limit(MEMORY_LIMIT).execute()

    return list(reversed(result.data or []))


def save_message(user_id: str, session_id: str, role: str, content: str) -> None:
    supabase.table("chat_messages").insert({
        "user_id": user_id,
        "session_id": session_id,
        "role": role,
        "content": content,
    }).execute()
```

If the project chooses async Supabase later, convert all calls together. Do not mix styles.

### Step 5.2: Memory Rules

- Fetch last 10 messages
- Include both user and assistant messages
- Preserve chronological order when sending to Groq
- Save user message before streaming
- Save assistant message after streaming completes

---

## PHASE 6 - Streaming Chat Endpoint (2 hours)

### Step 6.1: Router Endpoint

Update `backend/routers/chat.py`.

Recommended route:

```text
POST /api/chat
```

Request:

```json
{
  "user_id": "real-supabase-auth-uuid",
  "session_id": "session-uuid",
  "message": "Am I ready for this data engineer role?"
}
```

Response:

```text
text/event-stream
```

SSE events:

```text
data: {"token":"..."}

data: [DONE]
```

### Step 6.2: Build System Prompt

Use this structure:

```python
system_prompt = f"""
You are CareerPilot, an expert career assistant.

User CV context:
{cv_context}

Rules:
- Only reference experience that exists in the CV context.
- Be specific and practical.
- If evidence is missing, say so clearly.
- For roadmap requests, structure the answer week by week.
- For cover letters, write the full letter.
"""
```

### Step 6.3: Groq Streaming

Use:

```python
from groq import Groq

client = Groq(api_key=os.environ["GROQ_API_KEY"])

stream = client.chat.completions.create(
    model="llama-3.3-70b-versatile",
    messages=messages,
    stream=True,
    temperature=0.4,
)
```

Do not use Gemini for streaming chat.

### Step 6.4: Error Handling

If CV search fails:

- continue with `"No CV context available."`
- do not crash chat

If Groq fails:

- yield an SSE error event
- do not save an empty assistant message

Example:

```python
yield f"data: {json.dumps({'error': str(exc)})}\n\n"
```

---

## PHASE 7 - Chat Test Cases (1 hour)

### Step 7.1: Basic Streaming Test

```cmd
curl -N -X POST "http://localhost:8000/api/chat" ^
  -H "Content-Type: application/json" ^
  -d "{\"user_id\":\"REAL_AUTH_USER_UUID\",\"session_id\":\"11111111-1111-1111-1111-111111111111\",\"message\":\"What are my strongest skills?\"}"
```

Expected:

- tokens appear progressively
- final event is `[DONE]`
- answer references CV context if chunks exist

### Step 7.2: Memory Test

Send message 1:

```text
I want to target backend roles.
```

Send message 2 in same `session_id`:

```text
What should I focus on first?
```

Expected:

- assistant remembers backend role target
- answer references previous turn

### Step 7.3: Required Demo Queries

Test these once CV chunks exist:

1. `"Am I ready for this data engineer role?"`
2. `"What skills am I missing for a Google internship?"`
3. `"Build me a 3-month roadmap to become job-ready"`
4. `"Draft a cover letter for this job posting"`
5. Follow-up: `"Make it more concise"`

Record actual outputs honestly. If Supabase is unavailable, mark RAG/memory tests blocked.

---

## PHASE 8 - Agent Test Cases (45 minutes)

### Step 8.1: Direct Agent Test

Create `backend/test_agent.py`.

```python
import asyncio
from services.agent import run_job_hunter_agent

USER_ID = "REAL_AUTH_USER_UUID"


async def main():
    result = await run_job_hunter_agent(
        query="Find ML internships in Dhaka",
        location="Dhaka",
        user_id=USER_ID,
    )
    print(result)


if __name__ == "__main__":
    asyncio.run(main())
```

Expected:

- returns dict with `jobs` and `count`
- each job has fit score if Day 4 live scoring works
- no provider-specific raw payloads leak through

---

## PHASE 9 - Documentation & Commit (30 minutes)

### Step 9.1: Create API Docs

Create or update `backend/docs/API_DAY5.md`.

Include:

- `POST /api/jobs/agent`
- `POST /api/chat`
- SSE event format
- memory behavior
- RAG behavior
- blocked live tests if Supabase/Groq unavailable

### Step 9.2: Commit

```bash
git status
git add backend/services/agent.py backend/services/chat.py backend/routers/chat.py backend/routers/jobs.py backend/docs/API_DAY5.md
git commit -m "Day 5: add agent workflow and streaming chat memory"
```

Do not commit:

- `.env`
- API keys
- fake test outputs
- generated cache files

---

## Day 5 Checklist

### Agent

- [ ] `AgentState` defined
- [ ] LangGraph graph compiles
- [ ] Agent calls Day 4 job search/scoring service
- [ ] Agent returns structured job cards
- [ ] No duplicated fit score logic
- [ ] Fallback Python flow documented if LangGraph unavailable

### Chat Memory

- [ ] Last 10 messages fetched
- [ ] Messages ordered chronologically for Groq
- [ ] User message saved
- [ ] Assistant reply saved after stream
- [ ] Follow-up questions work in same session

### RAG

- [ ] CV context retrieved via hybrid search
- [ ] Missing CV context handled gracefully
- [ ] Assistant only references evidence from CV context

### Streaming

- [ ] Groq Llama 3.3 70B used
- [ ] SSE returns token events
- [ ] `[DONE]` event sent
- [ ] Error event sent on failure
- [ ] Gemini not used for visible streaming chat

### API

- [ ] `POST /api/jobs/agent` works
- [ ] `POST /api/chat` works
- [ ] Request/response docs created
- [ ] Route prefixes consistent with previous days

### Blocked If No Supabase

- [ ] Chat memory persistence
- [ ] RAG CV context
- [ ] Agent fit scoring against real CV
- [ ] End-to-end demo query validation

---

## Troubleshooting

### Issue: LangGraph import fails

Install dependencies:

```bash
pip install langgraph langchain-core langchain-groq
```

If time is tight, use the direct Python fallback with the same public function.

### Issue: Chat does not stream

Check:

- `stream=True` in Groq call
- endpoint returns `StreamingResponse`
- media type is `text/event-stream`
- curl uses `-N`

### Issue: Follow-up memory does not work

Check:

- same `session_id` is used
- `chat_messages` insert succeeds
- history query orders messages correctly
- history is included before current user message

### Issue: Assistant hallucinates CV details

Tighten system prompt:

```text
Only reference information present in the CV context. If missing, say the CV does not show it.
```

### Issue: Groq model fails

Verify model name:

```text
llama-3.3-70b-versatile
```

Check `GROQ_API_KEY` and Groq account limits.

---

## Success Criteria

By end of Day 5:

- Agent endpoint can return structured job cards
- Chat endpoint streams Groq tokens
- Chat includes CV context when available
- Chat remembers last 10 messages within a session
- Follow-up query demonstrates memory
- Day 6 frontend has stable backend APIs to consume

If Supabase is unavailable, Day 5 is code-complete only when imports, route definitions, streaming shape, and fallback behavior are implemented, with memory/RAG live tests documented as blocked.

---

## What's Next (Day 6)

Day 6 starts frontend:

1. Next.js 14 App Router scaffold
2. Supabase auth pages
3. Dashboard shell
4. CV upload page
5. Placeholder pages for jobs, chat, tracker

**Critical dependency:** Frontend should call the route prefixes chosen by backend. Do not let `/api/...` vs `/...` drift.

---

_Day 5 Complete - CareerPilot - Codesprint 2026_  
_Next: DAY 6 - Frontend Scaffold_
