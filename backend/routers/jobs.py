"""
Jobs Router — CareerPilot (Pillar 1: Job Hunter Agent)

Handles:
  POST /jobs/hunt  — search jobs (JSearch → Remotive → Tavily), fit score, cache
  GET  /jobs/{user_id} — fetch saved jobs for a user from DB
"""

from datetime import datetime

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from db.supabase import supabase
from services.agent import hunt_jobs
from services.fit_score import FitScoreEvidenceError, compute_fit_score

router = APIRouter(prefix="/jobs", tags=["jobs"])


class JobHuntRequest(BaseModel):
    user_id: str
    query: str
    location: str = ""


def _is_missing_url_column_error(exc: Exception) -> bool:
    text = str(exc).lower()
    return "url" in text and "jobs" in text and (
        "schema cache" in text
        or "pgrst204" in text
        or "42703" in text
        or "does not exist" in text
    )


def _is_missing_provenance_columns_error(exc: Exception) -> bool:
    text = str(exc).lower()
    return "jobs" in text and (
        "scored_cv_id" in text or "fit_score_calculated_at" in text or "fit_score_version" in text
    ) and (
        "schema cache" in text
        or "pgrst204" in text
        or "42703" in text
        or "does not exist" in text
    )


@router.post("/hunt")
async def hunt_jobs_endpoint(req: JobHuntRequest):
    """
    Hunt jobs for the user. Checks Redis cache first.
    Priority: JSearch → Remotive → Tavily.
    Returns jobs with personalized fit scores when scoring is available.
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
        job_description = "\n".join(
            value for value in [job_data.get("title", ""), job_data.get("description", "")] if value
        )

        # Compute fit score
        score_res = await compute_fit_score(
            job_description=job_description,
            user_id=user_id,
            search_query=job_data.get("title") or "",
        )
        calculated_at = datetime.utcnow().isoformat()

        # Update fit_score and fit_explanation
        try:
            await supabase.table("jobs").update({
                "fit_score": score_res["score"],
                "fit_explanation": score_res["explanation"],
                "scored_cv_id": score_res["active_cv_id"],
                "fit_score_calculated_at": calculated_at,
                "fit_score_version": score_res["fit_score_version"],
            }).eq("id", job_id).execute()
        except Exception as exc:
            if not _is_missing_provenance_columns_error(exc):
                raise
            await supabase.table("jobs").update({
                "fit_score": score_res["score"],
                "fit_explanation": score_res["explanation"],
            }).eq("id", job_id).execute()

        return {
            "job_id": job_id,
            "fit_score": score_res["score"],
            "fit_explanation": score_res["explanation"],
            "section_scores": score_res["section_scores"],
            "scored_cv_id": score_res["active_cv_id"],
            "fit_score_calculated_at": calculated_at,
            "fit_score_version": score_res["fit_score_version"],
        }
    except HTTPException as he:
        raise he
    except FitScoreEvidenceError as fe:
        raise HTTPException(status_code=422, detail=str(fe))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/{job_id}/details")
async def get_job_details(job_id: str):
    """
    Fetch additional job details (description, salary_range, fit_explanation)
    for the Applications modal. These fields are not included in the Kanban
    applications list response to keep it light.
    """
    try:
        result = await supabase.table("jobs").select(
            "id, description, salary_range, fit_explanation"
        ).eq("id", job_id).limit(1).execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Job not found.")

        job = result.data[0]
        return {
            "description": job.get("description"),
            "salary_range": job.get("salary_range"),
            "fit_explanation": job.get("fit_explanation"),
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{user_id}")
async def get_saved_jobs(user_id: str):
    """Fetch previously saved/scored jobs for a user from the database."""
    try:
        try:
            result = await supabase.table("jobs").select(
                "id, title, company, location, fit_score, fit_explanation, source, url, scored_cv_id, fit_score_calculated_at, fit_score_version"
            ).eq("user_id", user_id).order("fit_score", desc=True).execute()
        except Exception as exc:
            if _is_missing_provenance_columns_error(exc):
                try:
                    result = await supabase.table("jobs").select(
                        "id, title, company, location, fit_score, fit_explanation, source, url"
                    ).eq("user_id", user_id).order("fit_score", desc=True).execute()
                except Exception as inner_exc:
                    if _is_missing_url_column_error(inner_exc):
                        result = await supabase.table("jobs").select(
                            "id, title, company, location, fit_score, fit_explanation, source"
                        ).eq("user_id", user_id).order("fit_score", desc=True).execute()
                        for job in result.data or []:
                            job["url"] = ""
                    else:
                        raise
                for job in result.data or []:
                    job["scored_cv_id"] = None
                    job["fit_score_calculated_at"] = None
                    job["fit_score_version"] = None
            elif _is_missing_url_column_error(exc):
                result = await supabase.table("jobs").select(
                    "id, title, company, location, fit_score, fit_explanation, source, scored_cv_id, fit_score_calculated_at, fit_score_version"
                ).eq("user_id", user_id).order("fit_score", desc=True).execute()
                for job in result.data or []:
                    job["url"] = ""
            else:
                raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {"jobs": result.data or []}
