"""
Tracker Router — CareerPilot (Pillar 4: Productivity Tracker — Kanban)

Application status values (exactly these, no others):
  saved → applied → interviewing → offer → rejected

Endpoints:
  GET    /tracker/applications          — fetch all applications for user (with job metadata)
  POST   /tracker/applications          — create new application
  PATCH  /tracker/applications/:id      — update status (drag-and-drop)
  DELETE /tracker/applications/:id      — delete application
  GET    /tracker/goals                 — fetch goals
  POST   /tracker/goals                 — create goal
  GET    /tracker/todos                 — fetch todos
  POST   /tracker/todos                 — create todo
  PATCH  /tracker/todos/:id             — mark complete/incomplete
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Literal, Optional
from db.supabase import supabase

router = APIRouter(prefix="/tracker", tags=["tracker"])

ApplicationStatus = Literal["saved", "applied", "interviewing", "offer", "rejected"]


# ─── Request Models ───────────────────────────────────────────────────────────

class CreateApplicationRequest(BaseModel):
    user_id: str
    job_id: str
    status: ApplicationStatus = "saved"
    # Optional snapshot fields for display (stored in jobs table)
    title: Optional[str] = None
    company: Optional[str] = None
    location: Optional[str] = None
    url: Optional[str] = None
    fit_score: Optional[int] = None


class UpdateStatusRequest(BaseModel):
    status: ApplicationStatus


class CreateGoalRequest(BaseModel):
    user_id: str
    title: str
    target_date: Optional[str] = None


class CreateTodoRequest(BaseModel):
    user_id: str
    goal_id: Optional[str] = None
    title: str
    due_date: Optional[str] = None


class UpdateTodoRequest(BaseModel):
    completed: bool


# ─── Applications (Kanban) ────────────────────────────────────────────────────

@router.get("/applications")
async def get_applications(user_id: str = Query(...)):
    """
    Fetch all applications for a user, joined with job metadata.
    Returns applications ordered by applied_at desc.
    """
    # Fetch applications
    apps_result = await supabase.table("applications").select(
        "id, user_id, job_id, status, applied_at"
    ).eq("user_id", user_id).order("applied_at", desc=True).execute()

    applications = apps_result.data or []

    if not applications:
        return {"applications": []}

    # Fetch job metadata for all job_ids in one query
    job_ids = list({a["job_id"] for a in applications})
    jobs_result = await supabase.table("jobs").select(
        "id, title, company, location, url, fit_score"
    ).in_("id", job_ids).execute()

    jobs_map = {j["id"]: j for j in (jobs_result.data or [])}

    # Merge job metadata into each application
    enriched = []
    for app in applications:
        job = jobs_map.get(app["job_id"], {})
        enriched.append({
            **app,
            "title": job.get("title", "Unknown Role"),
            "company": job.get("company", "Unknown Company"),
            "location": job.get("location", ""),
            "url": job.get("url", ""),
            "fit_score": job.get("fit_score"),
        })

    return {"applications": enriched}


@router.post("/applications")
async def create_application(req: CreateApplicationRequest):
    """Add a job to the tracker (Kanban board)."""
    # Check for duplicate
    existing = await supabase.table("applications").select("id").eq(
        "user_id", req.user_id
    ).eq("job_id", req.job_id).execute()

    if existing.data:
        return {"application": existing.data[0], "duplicate": True}

    result = await supabase.table("applications").insert({
        "user_id": req.user_id,
        "job_id":  req.job_id,
        "status":  req.status,
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create application.")

    return {"application": result.data[0]}


@router.patch("/applications/{application_id}")
async def update_application_status(application_id: str, req: UpdateStatusRequest):
    """Update the Kanban status of an application (drag-and-drop)."""
    result = await supabase.table("applications").update({
        "status": req.status,
    }).eq("id", application_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Application not found.")

    return {"application": result.data[0]}


@router.delete("/applications/{application_id}")
async def delete_application(application_id: str):
    """Remove an application from the tracker."""
    await supabase.table("applications").delete().eq("id", application_id).execute()
    return {"status": "deleted"}


# ─── Goals ───────────────────────────────────────────────────────────────────

@router.get("/goals")
async def get_goals(user_id: str = Query(...)):
    """Fetch all goals for a user."""
    result = await supabase.table("goals").select(
        "id, user_id, title, target_date, completed"
    ).eq("user_id", user_id).order("target_date", desc=False).execute()
    return {"goals": result.data or []}


@router.post("/goals")
async def create_goal(req: CreateGoalRequest):
    """Create a new goal."""
    result = await supabase.table("goals").insert({
        "user_id": req.user_id,
        "title": req.title,
        "target_date": req.target_date,
        "completed": False,
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create goal.")

    return {"goal": result.data[0]}


# ─── Todos ───────────────────────────────────────────────────────────────────

@router.get("/todos")
async def get_todos(
    user_id: str = Query(...),
    due_date: Optional[str] = Query(None),
):
    """Fetch todos for a user, optionally filtered by due date."""
    query = supabase.table("todos").select(
        "id, user_id, goal_id, title, due_date, completed"
    ).eq("user_id", user_id)

    if due_date:
        query = query.eq("due_date", due_date)

    result = await query.order("due_date", desc=False).execute()
    return {"todos": result.data or []}


@router.post("/todos")
async def create_todo(req: CreateTodoRequest):
    """Create a new todo."""
    result = await supabase.table("todos").insert({
        "user_id": req.user_id,
        "goal_id": req.goal_id,
        "title": req.title,
        "due_date": req.due_date,
        "completed": False,
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create todo.")

    return {"todo": result.data[0]}


@router.patch("/todos/{todo_id}")
async def update_todo(todo_id: str, req: UpdateTodoRequest):
    """Mark a todo complete or incomplete."""
    result = await supabase.table("todos").update({
        "completed": req.completed,
    }).eq("id", todo_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Todo not found.")

    return {"todo": result.data[0]}
