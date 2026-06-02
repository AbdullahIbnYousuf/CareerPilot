"""
Job Hunter Agent Service — CareerPilot

Job search priority (AGENTS.md):
  1st  JSearch (RapidAPI)  — always try first, best BD/Dhaka coverage
  2nd  Remotive            — fallback for remote roles, no API key needed
  3rd  Tavily              — fallback for local BD sites incl. bdjobs.com

Agent State and Graph structure built with LangGraph:
  Nodes: search_node, score_node, filter_node
  Conditional Edge: should_retry
"""

import os
import json
import httpx
import hashlib
from typing import TypedDict, List, Dict, Any, Literal
from langchain_core.tools import tool
from langgraph.graph import StateGraph, END

from services.cache import get_cached_jobs, cache_jobs
from services.fit_score import compute_fit_score
from services.searcher import hybrid_search
from groq import Groq

# Setup API keys and clients
JSEARCH_API_KEY: str = os.environ.get("JSEARCH_API_KEY", "")
TAVILY_API_KEY: str  = os.environ.get("TAVILY_API_KEY", "")
_groq = Groq(api_key=os.environ.get("GROQ_API_KEY", ""))
_MODEL = "llama-3.3-70b-versatile"


# ---------------------------------------------------------------------------
# Procedural Job API Integrations
# ---------------------------------------------------------------------------

async def _search_jsearch(query: str, location: str = "") -> list[dict]:
    url = "https://jsearch.p.rapidapi.com/search"
    params = {
        "query": f"{query} {location}".strip(),
        "num_pages": "1",
        "date_posted": "month",
    }
    headers = {
        "x-rapidapi-key": JSEARCH_API_KEY,
        "x-rapidapi-host": "jsearch.p.rapidapi.com",
    }
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(url, params=params, headers=headers)
        resp.raise_for_status()
        data = resp.json()

    jobs = []
    for item in data.get("data", []):
        jobs.append({
            "title":       item.get("job_title", ""),
            "company":     item.get("employer_name", ""),
            "location":    item.get("job_city", "") or item.get("job_country", ""),
            "url":         item.get("job_apply_link", ""),
            "description": item.get("job_description", "")[:1000],
            "source":      "jsearch",
        })
    return jobs


async def _search_remotive(query: str) -> list[dict]:
    url = "https://remotive.com/api/remote-jobs"
    params = {"search": query, "limit": 10}
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()

    jobs = []
    for item in data.get("jobs", []):
        jobs.append({
            "title":       item.get("title", ""),
            "company":     item.get("company_name", ""),
            "location":    item.get("candidate_required_location", "Remote"),
            "url":         item.get("url", ""),
            "description": item.get("description", "")[:1000],
            "source":      "remotive",
        })
    return jobs


async def _search_tavily(query: str, location: str = "") -> list[dict]:
    url = "https://api.tavily.com/search"
    payload = {
        "api_key": TAVILY_API_KEY,
        "query": f"{query} jobs {location} site:bdjobs.com OR linkedin.com OR glassdoor.com".strip(),
        "search_depth": "basic",
        "max_results": 10,
    }
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(url, json=payload)
        resp.raise_for_status()
        data = resp.json()

    jobs = []
    for item in data.get("results", []):
        jobs.append({
            "title":       query,
            "company":     "",
            "location":    location or "Bangladesh",
            "url":         item.get("url", ""),
            "description": item.get("content", "")[:1000],
            "source":      "tavily",
        })
    return jobs


# ---------------------------------------------------------------------------
# LangChain Tools (Day 5 requirement)
# ---------------------------------------------------------------------------

@tool
async def search_jobs_tool(query: str, location: str = "") -> List[dict]:
    """Search for jobs using the priority fallback pipeline: JSearch -> Remotive -> Tavily."""
    # JSearch
    try:
        jobs = await _search_jsearch(query, location)
        if jobs:
            return jobs
    except Exception:
        pass

    # Remotive
    try:
        jobs = await _search_remotive(query)
        if jobs:
            return jobs
    except Exception:
        pass

    # Tavily
    try:
        jobs = await _search_tavily(query, location)
        return jobs
    except Exception:
        return []


@tool
async def compute_fit_score_tool(job_description: str, user_id: str) -> dict:
    """Programmatically compute a matching fit score (0-100) and get a detailed one-sentence explanation."""
    return await compute_fit_score(job_description, user_id)


@tool
async def get_cv_context_tool(user_id: str) -> str:
    """Retrieve highly relevant section chunks from a user's CV via hybrid vector search."""
    try:
        chunks = await hybrid_search(query="", user_id=user_id, match_count=5)
        return "\n\n".join(f"[{c['section']}] {c['content']}" for c in chunks)
    except Exception:
        return "No CV context available."


@tool
def draft_cover_letter_tool(job_description: str, cv_context: str) -> str:
    """Draft a persuasive and professional cover letter tailored to a specific job description using the candidate's CV context."""
    prompt = (
        "You are a professional cover letter assistant.\n\n"
        f"Job Description:\n{job_description}\n\n"
        f"Candidate CV Context:\n{cv_context}\n\n"
        "Draft a compelling, professional cover letter tailored to this job description. "
        "Highlight key skills, experience matches, and use persuasive business language. "
        "Keep it concise, elegant, and ready for submission."
    )
    try:
        resp = _groq.chat.completions.create(
            model=_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4,
        )
        return (resp.choices[0].message.content or "").strip()
    except Exception as e:
        return f"Failed to generate cover letter: {e}"


# ---------------------------------------------------------------------------
# LangGraph Agent Implementation
# ---------------------------------------------------------------------------

class AgentState(TypedDict):
    query: str
    location: str
    user_id: str
    jobs: List[Dict[str, Any]]
    retries: int
    max_retries: int


async def search_node(state: AgentState) -> Dict[str, Any]:
    """Search node - executes priority search fallbacks."""
    query = state["query"]
    location = state["location"]
    
    # Try JSearch
    jobs = []
    try:
        jobs = await _search_jsearch(query, location)
    except Exception:
        pass

    # Try Remotive fallback
    if not jobs:
        try:
            jobs = await _search_remotive(query)
        except Exception:
            pass

    # Try Tavily fallback
    if not jobs:
        try:
            jobs = await _search_tavily(query, location)
        except Exception:
            pass
            
    return {"jobs": jobs}


async def filter_node(state: AgentState) -> Dict[str, Any]:
    """Filter node - keeps first 30 unscored search result jobs and caches in Supabase."""
    jobs = list(state["jobs"])
    # Slice first 30 jobs from the search result order (no fit_score sorting)
    filtered_jobs = jobs[:30]

    from db.supabase import supabase
    user_id = state["user_id"]
    enriched_jobs = []

    for job in filtered_jobs:
        try:
            title = job.get("title", "")
            company = job.get("company", "")
            existing = await supabase.table("jobs").select("id").eq("user_id", user_id).eq("title", title).eq("company", company).execute()

            if existing.data:
                job_id = existing.data[0]["id"]
                # If job already exists, reuse its id but do not overwrite existing score/explanation
            else:
                # Insert the job into DB without fit_score and fit_explanation
                insert_data = {
                    "user_id": user_id,
                    "title": title,
                    "company": company,
                    "location": job.get("location", ""),
                    "salary_range": job.get("salary_range", "Not Disclosed"),
                    "deadline": job.get("deadline", "Rolling / Open"),
                    "description": job.get("description", ""),
                    "source": job.get("source", "jsearch"),
                    "url": job.get("url", "")
                }
                res = await supabase.table("jobs").insert(insert_data).execute()
                if res.data:
                    job_id = res.data[0]["id"]
                else:
                    job_id = None

            job_copy = dict(job)
            if job_id:
                job_copy["id"] = job_id
            # Strip fit_score and fit_explanation to guarantee they are unscored initial cards
            job_copy.pop("fit_score", None)
            job_copy.pop("fit_explanation", None)
            enriched_jobs.append(job_copy)
        except Exception:
            # Fallback (strip fit score columns too)
            job_copy = dict(job)
            job_copy.pop("fit_score", None)
            job_copy.pop("fit_explanation", None)
            enriched_jobs.append(job_copy)

    return {"jobs": enriched_jobs}


def should_retry(state: AgentState) -> Literal["retry", "end"]:
    """Conditional edge checking if we should try a broader query if zero jobs are found."""
    if not state["jobs"] and state["retries"] < state["max_retries"]:
        return "retry"
    return "end"


async def retry_node(state: AgentState) -> Dict[str, Any]:
    """Broadens query terms to trigger a retry search."""
    # Simplify query: split and take first 2 words
    words = state["query"].split()
    broader_query = " ".join(words[:2]) if len(words) > 2 else state["query"]
    return {
        "query": broader_query,
        "retries": state["retries"] + 1
    }


# Build LangGraph workflow
workflow = StateGraph(AgentState)

# Add nodes
workflow.add_node("search", search_node)
workflow.add_node("filter", filter_node)
workflow.add_node("retry", retry_node)

# Set entry point
workflow.set_entry_point("search")

# Add standard edges
workflow.add_edge("retry", "search")
workflow.add_edge("filter", END)

# Add conditional edges from search
workflow.add_conditional_edges(
    "search",
    should_retry,
    {
        "retry": "retry",
        "end": "filter"
    }
)

# Compile graph
graph = workflow.compile()


# ---------------------------------------------------------------------------
# Main Router Interface
# ---------------------------------------------------------------------------

async def hunt_jobs(query: str, location: str, user_id: str) -> list[dict]:
    """
    Hunt jobs using the compiled LangGraph workflow.
    Checks Upstash Redis cache first.
    """
    # 1. Check cache first
    cached = await get_cached_jobs(query, location)
    if cached is not None:
        return cached

    # 2. Run LangGraph pipeline
    initial_state: AgentState = {
        "query": query,
        "location": location,
        "user_id": user_id,
        "jobs": [],
        "retries": 0,
        "max_retries": 1
    }
    
    final_state = await graph.ainvoke(initial_state)
    jobs = final_state.get("jobs", [])

    # 3. Cache results
    await cache_jobs(jobs, query, location)

    return jobs
