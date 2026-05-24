"""
Jobs Router — CareerPilot (Pillar 1: Job Hunter Agent)

Handles:
  POST /jobs/hunt  — search jobs (JSearch → Remotive → Tavily), fit score, cache
  GET  /jobs/{user_id} — fetch saved jobs for a user from DB
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from db.supabase import supabase
from services.agent import hunt_jobs

router = APIRouter(prefix="/jobs", tags=["jobs"])


class JobHuntRequest(BaseModel):
    user_id: str
    query: str
    location: str = ""


@router.post("/hunt")
async def hunt_jobs_endpoint(req: JobHuntRequest):
    """
    Hunt jobs for the user. Checks Redis cache first.
    Priority: JSearch → Remotive → Tavily.
    Returns jobs with fit scores and explanations.
    """
    try:
        jobs = await hunt_jobs(
            query=req.query,
            location=req.location,
            user_id=req.user_id,
        )
        return {"jobs": jobs, "count": len(jobs)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{user_id}")
async def get_saved_jobs(user_id: str):
    """Fetch previously saved/scored jobs for a user from the database."""
    result = await supabase.table("jobs").select(
        "id, title, company, location, fit_score, fit_explanation, source, url"
    ).eq("user_id", user_id).order("fit_score", desc=True).execute()

    return {"jobs": result.data or []}
