"""
Tracker Router — CareerPilot (Pillar 4: Productivity Tracker — Kanban)

Application status values (exactly these, no others):
  saved → applied → interviewing → offer → rejected
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Literal
from db.supabase import supabase

router = APIRouter(prefix="/tracker", tags=["tracker"])

ApplicationStatus = Literal["saved", "applied", "interviewing", "offer", "rejected"]


class CreateApplicationRequest(BaseModel):
    user_id: str
    job_id: str
    status: ApplicationStatus = "saved"


class UpdateStatusRequest(BaseModel):
    status: ApplicationStatus


@router.get("/{user_id}")
async def get_applications(user_id: str):
    """Fetch all applications for a user, ordered by status."""
    result = await supabase.table("applications").select(
        "id, user_id, job_id, status, applied_at"
    ).eq("user_id", user_id).order("applied_at", desc=True).execute()

    return {"applications": result.data or []}


@router.post("/")
async def create_application(req: CreateApplicationRequest):
    """Add a job to the tracker (Kanban board)."""
    result = await supabase.table("applications").insert({
        "user_id": req.user_id,
        "job_id":  req.job_id,
        "status":  req.status,
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create application.")

    return {"application": result.data[0]}


@router.patch("/{application_id}/status")
async def update_application_status(application_id: str, req: UpdateStatusRequest):
    """Update the Kanban status of an application (drag-and-drop)."""
    result = await supabase.table("applications").update({
        "status": req.status,
    }).eq("id", application_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Application not found.")

    return {"application": result.data[0]}


@router.delete("/{application_id}")
async def delete_application(application_id: str):
    """Remove an application from the tracker."""
    await supabase.table("applications").delete().eq("id", application_id).execute()
    return {"status": "deleted"}
