"""
Jobs Router — CareerPilot (Pillar 1: Job Hunter Agent)

Handles:
  POST /jobs/hunt  — search jobs (JSearch → Remotive → Tavily), fit score, cache
  GET  /jobs/{user_id} — fetch saved jobs for a user from DB
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from db.supabase import supabase
from services.agent import hunt_jobs
from services.fit_score import compute_fit_score

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
    Returns jobs without fit scores.
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


@router.post("/score/{job_id}")
async def score_job_endpoint(job_id: str, user_id: str = Query(...)):
    """
    On-demand calculation of the fit score for a specific job.
    Fetches the job from Supabase, computes fit score, and updates the database.
    """
    try:
        result = await supabase.table("jobs").select("id, user_id, description, title") \
            .eq("id", job_id).eq("user_id", user_id).execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Job not found or does not belong to user")

        job_data = result.data[0]
        job_description = job_data.get("description") or job_data.get("title") or ""

        # Compute fit score
        score_res = await compute_fit_score(
            job_description=job_description,
            user_id=user_id
        )

        # Update fit_score and fit_explanation
        await supabase.table("jobs").update({
            "fit_score": score_res["score"],
            "fit_explanation": score_res["explanation"]
        }).eq("id", job_id).execute()

        return {
            "job_id": job_id,
            "fit_score": score_res["score"],
            "fit_explanation": score_res["explanation"],
            "section_scores": score_res["section_scores"]
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{user_id}")
async def get_saved_jobs(user_id: str):
    """Fetch previously saved/scored jobs for a user from the database."""
    result = await supabase.table("jobs").select(
        "id, title, company, location, fit_score, fit_explanation, source, url"
    ).eq("user_id", user_id).order("fit_score", desc=True).execute()

    return {"jobs": result.data or []}
