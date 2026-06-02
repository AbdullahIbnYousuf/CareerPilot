"""
Nudge helpers — CareerPilot

Structured data helpers for AI-generated nudge preparation.
These functions return raw data only — they do NOT call an LLM,
generate nudge messages, or insert rows into the `nudges` table.

Intended to be called by a future AI nudge generation route or a
pg_cron job once the LLM nudge layer is built.

Usage:
    from services.nudges import (
        get_overdue_goals,
        get_goals_due_soon,
        get_incomplete_goals,
        get_inactive_users,
    )
"""

from datetime import date, timedelta
from db.supabase import supabase


async def get_overdue_goals(user_id: str) -> list[dict]:
    """
    Return all incomplete goals whose target_date is strictly in the past.

    Args:
        user_id: UUID of the user.

    Returns:
        List of goal dicts with keys: id, title, target_date, completed.
    """
    today = date.today().isoformat()
    result = await supabase.table("goals").select(
        "id, title, target_date, completed"
    ).eq("user_id", user_id).eq("completed", False).not_.is_(
        "target_date", "null"
    ).lt("target_date", today).execute()
    return result.data or []


async def get_goals_due_soon(user_id: str, days: int = 7) -> list[dict]:
    """
    Return all incomplete goals whose target_date falls within the next
    `days` days (inclusive of today and the cutoff date).

    Args:
        user_id: UUID of the user.
        days:    Look-ahead window in days (default 7).

    Returns:
        List of goal dicts with keys: id, title, target_date, completed.
    """
    today = date.today()
    cutoff = (today + timedelta(days=days)).isoformat()
    result = await supabase.table("goals").select(
        "id, title, target_date, completed"
    ).eq("user_id", user_id).eq("completed", False).not_.is_(
        "target_date", "null"
    ).gte("target_date", today.isoformat()).lte("target_date", cutoff).execute()
    return result.data or []


async def get_incomplete_goals(user_id: str) -> list[dict]:
    """
    Return all goals that have not yet been marked complete.

    Args:
        user_id: UUID of the user.

    Returns:
        List of goal dicts with keys: id, title, target_date, completed.
    """
    result = await supabase.table("goals").select(
        "id, title, target_date, completed"
    ).eq("user_id", user_id).eq("completed", False).execute()
    return result.data or []


async def get_inactive_users() -> list[dict]:
    """
    Return user_ids that have at least one incomplete goal but have not
    completed any todo in the last 7 days.

    Proxy for inactivity: no todo row with completed=True was created
    (by created_at) in the last 7 days.

    Returns:
        List of dicts [{"user_id": "..."}] for each inactive user.
    """
    cutoff = (date.today() - timedelta(days=7)).isoformat()

    # All user_ids with at least one incomplete goal
    goals_result = await supabase.table("goals").select(
        "user_id"
    ).eq("completed", False).execute()

    all_user_ids: set[str] = {
        g["user_id"] for g in (goals_result.data or []) if g.get("user_id")
    }

    if not all_user_ids:
        return []

    # User_ids who recently completed a todo (proxy for activity)
    active_result = await supabase.table("todos").select(
        "user_id"
    ).eq("completed", True).gte("created_at", cutoff).execute()

    active_user_ids: set[str] = {
        t["user_id"] for t in (active_result.data or []) if t.get("user_id")
    }

    return [
        {"user_id": uid}
        for uid in sorted(all_user_ids - active_user_ids)
    ]
