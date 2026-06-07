"""
Tracker Router — CareerPilot (Pillar 4: Productivity Tracker — Kanban)

Application status values (exactly these, no others):
  saved → applied → interviewing → offer → rejected

Endpoints:
  GET    /tracker/applications                    — fetch all applications for user (with job metadata)
  POST   /tracker/applications                    — create new application
  PATCH  /tracker/applications/:id                — update status (drag-and-drop)
  DELETE /tracker/applications/:id                — delete application
  GET    /tracker/goals                           — fetch goals
  POST   /tracker/goals                           — create goal
  POST   /tracker/goals/:id/add-skill             — add target_skill to profile
  GET    /tracker/todos                           — fetch todos
  POST   /tracker/todos                           — create todo
  PATCH  /tracker/todos/:id                       — mark complete/incomplete
  DELETE /tracker/todos/:id                       — delete todo
  PATCH  /tracker/goals/:id                       — mark goal complete/incomplete
"""

from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Literal, Optional
from db.supabase import supabase

router = APIRouter(prefix="/tracker", tags=["tracker"])


def _is_missing_url_column_error(exc: Exception) -> bool:
    text = str(exc).lower()
    return "url" in text and "jobs" in text and (
        "schema cache" in text
        or "pgrst204" in text
        or "42703" in text
        or "does not exist" in text
    )


def _is_missing_deadline_column_error(exc: Exception) -> bool:
    text = str(exc).lower()
    return "deadline" in text and "jobs" in text and (
        "schema cache" in text
        or "pgrst204" in text
        or "42703" in text
        or "does not exist" in text
    )


def _is_missing_completed_at_column_error(exc: Exception) -> bool:
    text = str(exc).lower()
    return "completed_at" in text and "todos" in text and (
        "schema cache" in text
        or "pgrst204" in text
        or "42703" in text
        or "does not exist" in text
    )


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


class UpdateNotesRequest(BaseModel):
    notes: str


class CreateGoalRequest(BaseModel):
    user_id: str
    title: str
    target_date: Optional[str] = None
    target_skill: Optional[str] = None


class CreateTodoRequest(BaseModel):
    user_id: str
    goal_id: Optional[str] = None
    title: str
    due_date: Optional[str] = None


class UpdateTodoRequest(BaseModel):
    completed: bool


class UpdateGoalRequest(BaseModel):
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
        "id, user_id, job_id, status, applied_at, notes"
    ).eq("user_id", user_id).order("applied_at", desc=True).execute()

    applications = apps_result.data or []

    if not applications:
        return {"applications": []}

    # Fetch job metadata for all job_ids in one query
    job_ids = list({a["job_id"] for a in applications})
    try:
        jobs_result = await supabase.table("jobs").select(
            "id, title, company, location, url, fit_score, deadline"
        ).in_("id", job_ids).execute()
    except Exception as exc:
        if _is_missing_url_column_error(exc):
            try:
                jobs_result = await supabase.table("jobs").select(
                    "id, title, company, location, fit_score, deadline"
                ).in_("id", job_ids).execute()
                for job in jobs_result.data or []:
                    job["url"] = ""
            except Exception:
                jobs_result = None
        elif _is_missing_deadline_column_error(exc):
            try:
                jobs_result = await supabase.table("jobs").select(
                    "id, title, company, location, url, fit_score"
                ).in_("id", job_ids).execute()
                for job in jobs_result.data or []:
                    job["deadline"] = None
            except Exception:
                jobs_result = None
        else:
            jobs_result = None

    jobs_map = {j["id"]: j for j in ((jobs_result.data if jobs_result else []) or [])}

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
            "deadline": job.get("deadline"),
        })

    return {"applications": enriched}


@router.post("/applications")
async def create_application(req: CreateApplicationRequest):
    """Add a job to the tracker (Kanban board)."""
    # Check for duplicate
    existing = await supabase.table("applications").select("id, user_id, job_id, status, applied_at").eq(
        "user_id", req.user_id
    ).eq("job_id", req.job_id).execute()

    if existing.data:
        duplicate = existing.data[0]
        return {
            "application": {
                "id": duplicate["id"],
                "user_id": duplicate["user_id"],
                "job_id": duplicate["job_id"],
                "status": duplicate["status"],
                "applied_at": duplicate.get("applied_at"),
            },
            "duplicate": True,
        }

    result = await supabase.table("applications").insert({
        "user_id": req.user_id,
        "job_id":  req.job_id,
        "status":  req.status,
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create application.")

    # Write created event to audit log (best-effort — don't fail if table missing)
    app_data = result.data[0]
    try:
        await supabase.table("application_events").insert({
            "user_id": req.user_id,
            "application_id": app_data["id"],
            "event_type": "created",
            "to_status": req.status,
        }).execute()
    except Exception:
        pass  # Event logging is non-critical

    return {"application": app_data, "duplicate": False}


@router.patch("/applications/{application_id}")
async def update_application_status(application_id: str, req: UpdateStatusRequest):
    """Update the Kanban status of an application (drag-and-drop) and set applied_at appropriately."""
    # Fetch existing application to check current applied_at and status
    existing_app = await supabase.table("applications").select("user_id, status, applied_at").eq("id", application_id).execute()
    if not existing_app.data:
        raise HTTPException(status_code=404, detail="Application not found.")
    
    user_id = existing_app.data[0].get("user_id")
    current_status = existing_app.data[0].get("status")
    current_applied_at = existing_app.data[0].get("applied_at")

    update_data = {
        "status": req.status,
    }

    if req.status == "saved":
        update_data["applied_at"] = None
    elif req.status == "applied":
        if not current_applied_at:
            update_data["applied_at"] = datetime.now(timezone.utc).isoformat()
    elif req.status in ["interviewing", "offer", "rejected"]:
        if not current_applied_at:
            update_data["applied_at"] = datetime.now(timezone.utc).isoformat()

    result = await supabase.table("applications").update(update_data).eq("id", application_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Application not found.")

    # Write status changed event to audit log (best-effort)
    if current_status != req.status:
        try:
            await supabase.table("application_events").insert({
                "user_id": user_id,
                "application_id": application_id,
                "event_type": "status_changed",
                "from_status": current_status,
                "to_status": req.status,
            }).execute()
        except Exception:
            pass  # Event logging is non-critical

    return {"application": result.data[0]}


@router.delete("/applications/{application_id}")
async def delete_application(application_id: str):
    """Remove an application from the tracker."""
    await supabase.table("applications").delete().eq("id", application_id).execute()
    return {"status": "deleted"}


@router.patch("/applications/{application_id}/notes")
async def update_application_notes(application_id: str, req: UpdateNotesRequest):
    """Update notes for an application and record notes updated audit event."""
    # Fetch user_id for logging event
    existing_app = await supabase.table("applications").select("user_id").eq("id", application_id).execute()
    if not existing_app.data:
        raise HTTPException(status_code=404, detail="Application not found.")

    user_id = existing_app.data[0]["user_id"]

    # Try with updated_at first; fall back if column doesn't exist
    try:
        result = await supabase.table("applications").update({
            "notes": req.notes,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", application_id).execute()
    except Exception as exc:
        text = str(exc).lower()
        if "updated_at" in text and ("42703" in text or "does not exist" in text or "schema cache" in text):
            result = await supabase.table("applications").update({
                "notes": req.notes,
            }).eq("id", application_id).execute()
        else:
            raise

    if not result.data:
        raise HTTPException(status_code=404, detail="Application not found.")

    # Write note updated event to audit log (best-effort)
    try:
        await supabase.table("application_events").insert({
            "user_id": user_id,
            "application_id": application_id,
            "event_type": "note_updated",
            "note": req.notes[:500] if req.notes else "",  # truncate for storage
        }).execute()
    except Exception:
        pass  # Event logging is non-critical

    return {"application": result.data[0]}


@router.get("/applications/{application_id}/events")
async def get_application_events(application_id: str):
    """Fetch recent audit log history events for a single application."""
    try:
        result = await supabase.table("application_events").select(
            "id, event_type, from_status, to_status, note, created_at"
        ).eq("application_id", application_id).order("created_at", desc=True).execute()
        return {"events": result.data or []}
    except Exception:
        # Table may not exist yet — return empty list gracefully
        return {"events": []}


# ─── Goals ───────────────────────────────────────────────────────────────────

@router.get("/goals")
async def get_goals(user_id: str = Query(...)):
    """Fetch all goals for a user."""
    try:
        result = await supabase.table("goals").select(
            "id, user_id, title, target_date, completed, target_skill"
        ).eq("user_id", user_id).order("target_date", desc=False).execute()
        return {"goals": result.data or []}
    except Exception as exc:
        exc_str = str(exc).lower()
        if "target_skill" in exc_str or "42703" in exc_str or "does not exist" in exc_str:
            result = await supabase.table("goals").select(
                "id, user_id, title, target_date, completed"
            ).eq("user_id", user_id).order("target_date", desc=False).execute()
            data = result.data or []
            for g in data:
                g["target_skill"] = None
            return {"goals": data}
        else:
            raise


@router.post("/goals")
async def create_goal(req: CreateGoalRequest):
    """Create a new goal."""
    insert_payload: dict = {
        "user_id": req.user_id,
        "title": req.title,
        "target_date": req.target_date,
        "completed": False,
    }
    if req.target_skill:
        insert_payload["target_skill"] = req.target_skill.strip()

    try:
        result = await supabase.table("goals").insert(insert_payload).execute()
    except Exception as exc:
        exc_str = str(exc).lower()
        if "target_skill" in exc_str or "42703" in exc_str or "does not exist" in exc_str:
            insert_payload.pop("target_skill", None)
            result = await supabase.table("goals").insert(insert_payload).execute()
            if result.data:
                result.data[0]["target_skill"] = None
        else:
            raise

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create goal.")

    return {"goal": result.data[0]}


@router.post("/goals/{goal_id}/add-skill")
async def add_skill_from_goal(goal_id: str, user_id: str = Query(...)):
    """
    Add the target_skill of a completed goal to the user's profile skills.

    Steps:
      1. Fetch the goal and validate it has a target_skill.
      2. Fetch the user's profile.
      3. Add the skill to profiles.skills (case-insensitive dedup).
      4. Insert a profile_skill_events row (unique index prevents dups).
    Returns: {skill, added_to_profile, event_created}
    """
    # 1. Fetch goal
    try:
        goal_res = await supabase.table("goals").select(
            "id, user_id, title, target_skill"
        ).eq("id", goal_id).execute()
    except Exception as exc:
        exc_str = str(exc).lower()
        if "target_skill" in exc_str or "42703" in exc_str or "does not exist" in exc_str:
            raise HTTPException(
                status_code=400,
                detail="Your database schema is out of date. Please run the SQL migrations in Supabase.",
            )
        else:
            raise

    if not goal_res.data:
        raise HTTPException(status_code=404, detail="Goal not found.")

    goal = goal_res.data[0]

    if goal.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Not authorised.")

    target_skill: str | None = goal.get("target_skill")
    if not target_skill:
        raise HTTPException(
            status_code=400, detail="This goal has no target_skill set."
        )

    skill = target_skill.strip()

    # 2. Fetch profile
    profile_res = await supabase.table("profiles").select(
        "user_id, skills"
    ).eq("user_id", user_id).execute()

    if not profile_res.data:
        raise HTTPException(
            status_code=404,
            detail="Profile not found. Upload your CV first to create a profile.",
        )

    profile = profile_res.data[0]
    current_skills: list = profile.get("skills") or []

    # 3. Add skill to profile if not already present (case-insensitive)
    existing_lower = {s.lower() for s in current_skills if isinstance(s, str)}
    added_to_profile = False
    if skill.lower() not in existing_lower:
        updated_skills = current_skills + [skill]
        await supabase.table("profiles").update(
            {"skills": updated_skills}
        ).eq("user_id", user_id).execute()
        added_to_profile = True

    # 4. Insert skill event (unique index silently prevents duplicates)
    event_created = False
    try:
        event_res = await supabase.table("profile_skill_events").insert({
            "user_id": user_id,
            "skill": skill,
            "event_type": "added",
            "source_goal_id": goal_id,
        }).execute()
        if event_res.data:
            event_created = True
    except Exception:
        # Unique constraint violation means event already exists — that is fine
        pass

    return {
        "skill": skill,
        "added_to_profile": added_to_profile,
        "event_created": event_created,
    }


@router.patch("/goals/{goal_id}")
async def update_goal(goal_id: str, req: UpdateGoalRequest):
    """Mark a goal complete or incomplete."""
    result = await supabase.table("goals").update({
        "completed": req.completed,
    }).eq("id", goal_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Goal not found.")

    return {"goal": result.data[0]}


# ─── Todos ───────────────────────────────────────────────────────────────────

@router.get("/todos")
async def get_todos(
    user_id: str = Query(...),
    due_date: Optional[str] = Query(None),
):
    """Fetch todos for a user, optionally filtered by due date."""
    select_columns = "id, user_id, goal_id, title, due_date, completed, completed_at"
    query = supabase.table("todos").select(select_columns).eq("user_id", user_id)

    if due_date:
        query = query.eq("due_date", due_date)

    try:
        result = await query.order("due_date", desc=False).execute()
    except Exception as exc:
        if not _is_missing_completed_at_column_error(exc):
            raise

        fallback_query = supabase.table("todos").select(
            "id, user_id, goal_id, title, due_date, completed"
        ).eq("user_id", user_id)
        if due_date:
            fallback_query = fallback_query.eq("due_date", due_date)
        result = await fallback_query.order("due_date", desc=False).execute()
        for todo in result.data or []:
            todo["completed_at"] = None

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


@router.delete("/todos/{todo_id}")
async def delete_todo(todo_id: str):
    """Delete a todo without deleting any linked goal."""
    await supabase.table("todos").delete().eq("id", todo_id).execute()
    return {"status": "deleted"}


@router.patch("/todos/{todo_id}")
async def update_todo(todo_id: str, req: UpdateTodoRequest):
    """Mark a todo complete or incomplete and set completed_at."""
    update_data = {
        "completed": req.completed,
    }
    if req.completed:
        update_data["completed_at"] = datetime.now(timezone.utc).isoformat()
    else:
        update_data["completed_at"] = None

    try:
        result = await supabase.table("todos").update(update_data).eq("id", todo_id).execute()
    except Exception as exc:
        if not _is_missing_completed_at_column_error(exc):
            raise
        result = await supabase.table("todos").update({
            "completed": req.completed,
        }).eq("id", todo_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Todo not found.")

    return {"todo": result.data[0]}
