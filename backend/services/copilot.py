"""
Copilot V2 service.

Validates and executes confirmed CareerPilot actions. The chat model may propose
actions, but this service is the authority before anything is shown or mutated.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any, Literal
from urllib.parse import parse_qs, urlencode, urlparse

from db.supabase import supabase

ApplicationStatus = Literal["saved", "applied", "interviewing", "offer", "rejected"]

APPLICATION_STATUSES: set[str] = {"saved", "applied", "interviewing", "offer", "rejected"}
TRACKER_VIEWS: set[str] = {"today", "applications", "goals_tasks", "calendar", "progress"}
ROUTES: set[str] = {"/tracker", "/jobs", "/chat", "/cv"}
CV_PARAMS: set[str] = {"upload", "build", "preview"}
JOB_PARAMS: set[str] = {"query", "location", "auto"}
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _clean_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _clean_list(value: Any, limit: int = 8) -> list[str]:
    if not isinstance(value, list):
        return []
    cleaned: list[str] = []
    for item in value:
        text = _clean_text(item)
        if text:
            cleaned.append(text)
    return cleaned[:limit]


def _valid_date(value: Any) -> str | None:
    if value is None or value == "":
        return None
    text = _clean_text(value)
    if not DATE_RE.match(text):
        raise ValueError("Dates must use YYYY-MM-DD format.")
    return text


def _is_allowed_href(href: str) -> bool:
    if not href.startswith("/") or href.startswith("//"):
        return False

    parsed = urlparse(href)
    if parsed.scheme or parsed.netloc:
        return False
    if parsed.path not in ROUTES:
        return False

    params = parse_qs(parsed.query, keep_blank_values=True)
    param_keys = set(params.keys())

    if parsed.path == "/tracker":
        if not param_keys:
            return True
        return param_keys == {"view"} and params.get("view", [""])[0] in TRACKER_VIEWS

    if parsed.path == "/cv":
        if not param_keys:
            return True
        return param_keys.issubset(CV_PARAMS) and all(values == ["1"] for values in params.values())

    if parsed.path == "/jobs":
        return param_keys.issubset(JOB_PARAMS)

    return not param_keys


def _job_search_href(query: str, location: str | None, auto: bool) -> str:
    params = {"query": query}
    if location:
        params["location"] = location
    if auto:
        params["auto"] = "1"
    return f"/jobs?{urlencode(params)}"


async def get_preferences(user_id: str) -> dict[str, Any]:
    result = await supabase.table("career_preferences").select(
        "user_id, preferred_name, target_roles, preferred_locations, work_modes, "
        "seniority, weekly_capacity_hours, target_start_date, industries, updated_at"
    ).eq("user_id", user_id).limit(1).execute()

    if result.data:
        return result.data[0]

    return {
        "user_id": user_id,
        "preferred_name": None,
        "target_roles": [],
        "preferred_locations": [],
        "work_modes": [],
        "seniority": None,
        "weekly_capacity_hours": None,
        "target_start_date": None,
        "industries": [],
        "updated_at": None,
    }


async def patch_preferences(user_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    row: dict[str, Any] = {
        "user_id": user_id,
        "updated_at": _now_iso(),
    }

    if "preferred_name" in payload:
        row["preferred_name"] = _clean_text(payload.get("preferred_name")) or None
    if "target_roles" in payload:
        row["target_roles"] = _clean_list(payload.get("target_roles"), limit=6)
    if "preferred_locations" in payload:
        row["preferred_locations"] = _clean_list(payload.get("preferred_locations"), limit=6)
    if "work_modes" in payload:
        row["work_modes"] = _clean_list(payload.get("work_modes"), limit=4)
    if "seniority" in payload:
        row["seniority"] = _clean_text(payload.get("seniority")) or None
    if "weekly_capacity_hours" in payload:
        capacity = payload.get("weekly_capacity_hours")
        row["weekly_capacity_hours"] = int(capacity) if capacity is not None else None
    if "target_start_date" in payload:
        row["target_start_date"] = _valid_date(payload.get("target_start_date"))
    if "industries" in payload:
        row["industries"] = _clean_list(payload.get("industries"), limit=8)

    result = await supabase.table("career_preferences").upsert(
        row,
        on_conflict="user_id",
    ).execute()
    return result.data[0] if result.data else await get_preferences(user_id)


async def _log_action_event(
    user_id: str,
    action_type: str,
    status: str,
    source: str,
    summary: str,
    action: dict[str, Any],
    created_records: dict[str, Any] | None = None,
    error: str | None = None,
) -> None:
    try:
        await supabase.table("copilot_action_events").insert({
            "user_id": user_id,
            "action_type": action_type,
            "status": status,
            "source": source,
            "summary": summary,
            "action": action,
            "created_records": created_records or {},
            "error": error,
        }).execute()
    except Exception:
        pass


async def _application_for_user(user_id: str, application_id: str) -> dict[str, Any]:
    result = await supabase.table("applications").select(
        "id, user_id, job_id, status, applied_at, notes"
    ).eq("id", application_id).eq("user_id", user_id).limit(1).execute()
    if not result.data:
        raise ValueError("Application not found.")
    return result.data[0]


async def _job_for_user(user_id: str, job_id: str) -> dict[str, Any]:
    result = await supabase.table("jobs").select(
        "id, user_id, title, company, location, url, fit_score"
    ).eq("id", job_id).eq("user_id", user_id).limit(1).execute()
    if not result.data:
        raise ValueError("Job not found.")
    return result.data[0]


def _base_response(action: dict[str, Any], summary: str, is_mutating: bool) -> dict[str, Any]:
    return {
        "valid": True,
        "action": action,
        "action_type": action["type"],
        "label": action.get("label") or summary,
        "summary": summary,
        "is_mutating": is_mutating,
        "confirmation_label": "Confirm" if is_mutating else "Open",
    }


async def validate_action(user_id: str, action: dict[str, Any], source: str = "widget") -> dict[str, Any]:
    action_type = _clean_text(action.get("type"))
    if not action_type:
        raise ValueError("Action type is required.")

    label = _clean_text(action.get("label"))

    if action_type == "open_route":
        href = _clean_text(action.get("href"))
        if not label or not href or not _is_allowed_href(href):
            raise ValueError("That route is not available.")
        normalized = {"type": action_type, "label": label, "href": href}
        return _base_response(normalized, label, False)

    if action_type == "prefill_job_search":
        query = _clean_text(action.get("query"))
        if not label or not query:
            raise ValueError("A job search needs a query.")
        location = _clean_text(action.get("location")) or None
        auto = action.get("auto") is True
        href = _job_search_href(query, location, auto)
        if not _is_allowed_href(href):
            raise ValueError("That job search is not available.")
        normalized = {
            "type": action_type,
            "label": label,
            "query": query,
            "location": location or "",
            "auto": auto,
        }
        response = _base_response(normalized, label, False)
        response["href"] = href
        return response

    if action_type == "create_todo":
        todo = action.get("todo") if isinstance(action.get("todo"), dict) else {}
        title = _clean_text(todo.get("title"))
        if not label or not title:
            raise ValueError("A task needs a title.")
        normalized = {
            "type": action_type,
            "label": label,
            "todo": {"title": title, "due_date": _valid_date(todo.get("due_date"))},
        }
        return _base_response(normalized, f"Add task: {title}", True)

    if action_type == "create_goal_with_todos":
        goal = action.get("goal") if isinstance(action.get("goal"), dict) else {}
        title = _clean_text(goal.get("title"))
        todos_in = action.get("todos") if isinstance(action.get("todos"), list) else []
        if not label or not title:
            raise ValueError("A goal needs a title.")
        if len(todos_in) > 5:
            raise ValueError("A plan can include at most five tasks.")
        todos = []
        for todo in todos_in:
            if not isinstance(todo, dict):
                raise ValueError("Each task must be an object.")
            todo_title = _clean_text(todo.get("title"))
            if not todo_title:
                raise ValueError("Each task needs a title.")
            todos.append({"title": todo_title, "due_date": _valid_date(todo.get("due_date"))})
        normalized = {
            "type": action_type,
            "label": label,
            "goal": {"title": title, "target_date": _valid_date(goal.get("target_date"))},
            "todos": todos,
        }
        return _base_response(normalized, f"Create goal: {title}", True)

    if action_type == "save_application":
        job_id = _clean_text(action.get("job_id"))
        status = _clean_text(action.get("status")) or "saved"
        if status not in APPLICATION_STATUSES:
            raise ValueError("Application status is not valid.")
        job = await _job_for_user(user_id, job_id)
        normalized = {
            "type": action_type,
            "label": label or f"Save {job.get('title', 'job')}",
            "job_id": job_id,
            "status": status,
        }
        return _base_response(normalized, f"Save {job.get('title', 'job')} to Applications", True)

    if action_type == "update_application_status":
        application_id = _clean_text(action.get("application_id"))
        status = _clean_text(action.get("status"))
        if status not in APPLICATION_STATUSES:
            raise ValueError("Application status is not valid.")
        await _application_for_user(user_id, application_id)
        normalized = {
            "type": action_type,
            "label": label or "Update application",
            "application_id": application_id,
            "status": status,
        }
        return _base_response(normalized, f"Move application to {status}", True)

    if action_type == "save_application_note":
        application_id = _clean_text(action.get("application_id"))
        note = _clean_text(action.get("note"))
        if not note:
            raise ValueError("A note cannot be empty.")
        await _application_for_user(user_id, application_id)
        normalized = {
            "type": action_type,
            "label": label or "Save note",
            "application_id": application_id,
            "note": note,
        }
        return _base_response(normalized, "Save note to application", True)

    raise ValueError("Action type is not supported.")


async def execute_action(user_id: str, action: dict[str, Any], source: str = "widget") -> dict[str, Any]:
    try:
        validated = await validate_action(user_id, action, source)
    except ValueError as exc:
        await _log_action_event(
            user_id=user_id,
            action_type=_clean_text(action.get("type")) or "unknown",
            status="rejected",
            source=source,
            summary="Rejected unsafe Copilot action",
            action=action,
            error=str(exc),
        )
        raise

    normalized = validated["action"]
    action_type = validated["action_type"]
    summary = validated["summary"]
    created_records: dict[str, Any] = {}
    href = "/tracker"

    try:
        if action_type == "create_todo":
            todo = normalized["todo"]
            result = await supabase.table("todos").insert({
                "user_id": user_id,
                "goal_id": None,
                "title": todo["title"],
                "due_date": todo.get("due_date"),
                "completed": False,
            }).execute()
            created_records = {"todo": result.data[0] if result.data else None}
            href = "/tracker?view=goals_tasks"

        elif action_type == "create_goal_with_todos":
            goal = normalized["goal"]
            goal_result = await supabase.table("goals").insert({
                "user_id": user_id,
                "title": goal["title"],
                "target_date": goal.get("target_date"),
                "completed": False,
            }).execute()
            if not goal_result.data:
                raise ValueError("Failed to create goal.")
            goal_row = goal_result.data[0]
            todo_rows = []
            for todo in normalized["todos"]:
                todo_result = await supabase.table("todos").insert({
                    "user_id": user_id,
                    "goal_id": goal_row["id"],
                    "title": todo["title"],
                    "due_date": todo.get("due_date"),
                    "completed": False,
                }).execute()
                if todo_result.data:
                    todo_rows.append(todo_result.data[0])
            created_records = {"goal": goal_row, "todos": todo_rows}
            href = "/tracker?view=goals_tasks"

        elif action_type == "save_application":
            job_id = normalized["job_id"]
            existing = await supabase.table("applications").select(
                "id, user_id, job_id, status, applied_at"
            ).eq("user_id", user_id).eq("job_id", job_id).limit(1).execute()
            if existing.data:
                created_records = {"application": existing.data[0], "duplicate": True}
            else:
                result = await supabase.table("applications").insert({
                    "user_id": user_id,
                    "job_id": job_id,
                    "status": normalized["status"],
                }).execute()
                created_records = {"application": result.data[0] if result.data else None, "duplicate": False}
            href = "/tracker?view=applications"

        elif action_type == "update_application_status":
            application = await _application_for_user(user_id, normalized["application_id"])
            update_data: dict[str, Any] = {"status": normalized["status"]}
            if normalized["status"] == "saved":
                update_data["applied_at"] = None
            elif not application.get("applied_at"):
                update_data["applied_at"] = _now_iso()
            result = await supabase.table("applications").update(
                update_data
            ).eq("id", normalized["application_id"]).eq("user_id", user_id).execute()
            created_records = {"application": result.data[0] if result.data else None}
            href = "/tracker?view=applications"

        elif action_type == "save_application_note":
            result = await supabase.table("applications").update({
                "notes": normalized["note"],
            }).eq("id", normalized["application_id"]).eq("user_id", user_id).execute()
            created_records = {"application": result.data[0] if result.data else None}
            href = "/tracker?view=applications"

        else:
            raise ValueError("Only mutating actions should be executed.")

        await _log_action_event(
            user_id=user_id,
            action_type=action_type,
            status="executed",
            source=source,
            summary=summary,
            action=normalized,
            created_records=created_records,
        )
        return {
            "status": "executed",
            "message": "Confirmed.",
            "href": href,
            "created_records": created_records,
            "validated_action": validated,
        }
    except Exception as exc:
        await _log_action_event(
            user_id=user_id,
            action_type=action_type,
            status="failed",
            source=source,
            summary=summary,
            action=normalized,
            error=str(exc),
        )
        raise


async def list_action_events(user_id: str) -> list[dict[str, Any]]:
    result = await supabase.table("copilot_action_events").select(
        "id, user_id, action_type, status, source, summary, created_records, error, created_at"
    ).eq("user_id", user_id).order("created_at", desc=True).limit(50).execute()
    return result.data or []
