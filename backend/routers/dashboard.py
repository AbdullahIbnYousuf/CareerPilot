"""
Dashboard Router — CareerPilot (Pillar 4: Progress Dashboard + AI Nudges)

Handles:
  GET  /dashboard/{user_id}          — weekly progress snapshot + status counts
  GET  /dashboard/{user_id}/stats    — historical snapshots for charts (last 8 weeks)
  POST /dashboard/snapshot           — save a weekly progress snapshot
  GET  /dashboard/{user_id}/nudges   — fetch unseen AI nudges
  PATCH /dashboard/nudges/{nudge_id}/seen — mark nudge as seen
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from db.supabase import supabase
from datetime import date, timedelta

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

    roadmap_pct is computed dynamically from the todos table so it always
    reflects the user's current task completion rate:
        round(completed_todos / total_todos * 100)  — 0 when no todos exist.
    The saved snapshot row (if any) provides applications_sent and streak_days;
    its stored roadmap_pct column is intentionally ignored here.
    """
    # Latest weekly snapshot (for applications_sent + streak_days only)
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

    # New matches count from jobs table (fit_score >= 70)
    new_matches_result = await supabase.table("jobs").select(
        "id"
    ).eq("user_id", user_id).gte("fit_score", 70).execute()

    # ── Dynamic roadmap_pct from todos ──────────────────────────────────────
    todos_result = await supabase.table("todos").select(
        "completed"
    ).eq("user_id", user_id).execute()

    todos_data = todos_result.data or []
    total_todos = len(todos_data)
    completed_todos = sum(1 for t in todos_data if t.get("completed"))
    dynamic_roadmap_pct: int = (
        round(completed_todos / total_todos * 100) if total_todos > 0 else 0
    )

    # Merge: preserve saved snapshot fields, override roadmap_pct with live value
    raw_snapshot = snapshot_result.data[0] if snapshot_result.data else {}
    computed_snapshot: dict = {
        "applications_sent": raw_snapshot.get("applications_sent", 0),
        "streak_days":       raw_snapshot.get("streak_days", 0),
        "roadmap_pct":       dynamic_roadmap_pct,
    }
    # Carry through extra fields (id, user_id, week_start) if snapshot exists
    if raw_snapshot:
        computed_snapshot = {**raw_snapshot, "roadmap_pct": dynamic_roadmap_pct}

    return {
        "snapshot":      computed_snapshot,
        "status_counts": status_counts,
        "new_matches":   len(new_matches_result.data or []),
    }


@router.get("/{user_id}/stats")
async def get_stats_history(user_id: str):
    """
    Return the last 8 weekly progress snapshots for Recharts line/bar charts.
    Also returns fit score distribution from jobs table.
    """
    # Last 8 weekly snapshots ordered ascending (oldest first for charts)
    snapshots_result = await supabase.table("progress_snapshots").select(
        "week_start, applications_sent, streak_days, roadmap_pct"
    ).eq("user_id", user_id).order("week_start", desc=True).limit(8).execute()

    snapshots = list(reversed(snapshots_result.data or []))

    # Fit score distribution from jobs table
    jobs_result = await supabase.table("jobs").select(
        "fit_score"
    ).eq("user_id", user_id).not_.is_("fit_score", "null").execute()

    scores = [j["fit_score"] for j in (jobs_result.data or []) if j.get("fit_score") is not None]

    # Bucket into ranges: <40, 40-69, 70-84, 85-100
    distribution = [
        {"range": "<40",   "count": sum(1 for s in scores if s < 40)},
        {"range": "40–69", "count": sum(1 for s in scores if 40 <= s < 70)},
        {"range": "70–84", "count": sum(1 for s in scores if 70 <= s < 85)},
        {"range": "85+",   "count": sum(1 for s in scores if s >= 85)},
    ]

    return {
        "snapshots":    snapshots,
        "distribution": distribution,
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
