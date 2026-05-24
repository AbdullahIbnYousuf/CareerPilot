"""
Dashboard Router — CareerPilot (Pillar 4: Progress Dashboard + AI Nudges)

Handles:
  GET  /dashboard/{user_id}          — weekly progress snapshot
  POST /dashboard/snapshot           — save a weekly progress snapshot
  GET  /dashboard/{user_id}/nudges   — fetch unseen AI nudges
  PATCH /dashboard/nudges/{nudge_id}/seen — mark nudge as seen
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from db.supabase import supabase

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


class SnapshotRequest(BaseModel):
    user_id: str
    week_start: str          # ISO date string e.g. "2026-05-18"
    applications_sent: int
    streak_days: int
    roadmap_pct: float       # 0.0 – 100.0


@router.get("/{user_id}")
async def get_dashboard(user_id: str):
    """
    Return the latest progress snapshot + application counts per status
    for the dashboard overview.
    """
    # Latest weekly snapshot
    snapshot_result = await supabase.table("progress_snapshots").select(
        "id, user_id, week_start, applications_sent, streak_days, roadmap_pct"
    ).eq("user_id", user_id).order("week_start", desc=True).limit(1).execute()

    # Application counts grouped by status (manual count, no raw SQL)
    apps_result = await supabase.table("applications").select(
        "status"
    ).eq("user_id", user_id).execute()

    status_counts: dict[str, int] = {
        "saved": 0, "applied": 0, "interviewing": 0, "offer": 0, "rejected": 0
    }
    for app in (apps_result.data or []):
        s = app.get("status", "")
        if s in status_counts:
            status_counts[s] += 1

    return {
        "snapshot":      snapshot_result.data[0] if snapshot_result.data else None,
        "status_counts": status_counts,
    }


@router.post("/snapshot")
async def save_snapshot(req: SnapshotRequest):
    """Save a weekly progress snapshot (called by pg_cron or frontend)."""
    result = await supabase.table("progress_snapshots").insert({
        "user_id":           req.user_id,
        "week_start":        req.week_start,
        "applications_sent": req.applications_sent,
        "streak_days":       req.streak_days,
        "roadmap_pct":       req.roadmap_pct,
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to save snapshot.")

    return {"snapshot": result.data[0]}


@router.get("/{user_id}/nudges")
async def get_nudges(user_id: str):
    """Fetch unseen AI nudges for the user."""
    result = await supabase.table("nudges").select(
        "id, message, job_ids, seen"
    ).eq("user_id", user_id).eq("seen", False).order(
        "created_at", desc=True
    ).execute()

    return {"nudges": result.data or []}


@router.patch("/nudges/{nudge_id}/seen")
async def mark_nudge_seen(nudge_id: str):
    """Mark an AI nudge as seen."""
    result = await supabase.table("nudges").update(
        {"seen": True}
    ).eq("id", nudge_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Nudge not found.")

    return {"status": "updated"}
