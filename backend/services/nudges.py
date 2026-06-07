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

from datetime import date, timedelta, datetime, timezone
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


async def get_overdue_todos(user_id: str) -> list[dict]:
    """
    Return all incomplete todos whose due_date is strictly in the past.
    """
    today = date.today().isoformat()
    result = await supabase.table("todos").select(
        "id, title, due_date, completed"
    ).eq("user_id", user_id).eq("completed", False).not_.is_(
        "due_date", "null"
    ).lt("due_date", today).execute()
    return result.data or []


async def has_applications_this_week(user_id: str) -> bool:
    """
    Check if the user has applied to any jobs this week.
    Status must be beyond 'saved' (i.e. 'applied', 'interviewing', 'offer', 'rejected')
    and applied_at within current week (starting Monday UTC).
    """
    apps_sent_result = await supabase.table("applications").select(
        "id, status, applied_at"
    ).eq("user_id", user_id).in_("status", ["applied", "interviewing", "offer", "rejected"]).execute()

    now_utc = datetime.now(timezone.utc)
    # Start of current week (Monday 00:00:00 UTC)
    start_of_week = (now_utc - timedelta(days=now_utc.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)

    for app in (apps_sent_result.data or []):
        applied_at_str = app.get("applied_at")
        if applied_at_str:
            try:
                dt_str = applied_at_str.replace("Z", "+00:00")
                applied_at_dt = datetime.fromisoformat(dt_str)
                if applied_at_dt >= start_of_week:
                    return True
            except Exception:
                pass
    return False


async def get_high_fit_saved_jobs(user_id: str) -> list[dict]:
    """
    Return saved applications where the joined job has fit_score >= 70.
    """
    apps_res = await supabase.table("applications").select(
        "id, job_id"
    ).eq("user_id", user_id).eq("status", "saved").execute()
    apps = apps_res.data or []
    if not apps:
        return []

    job_ids = list({a["job_id"] for a in apps})
    jobs_res = await supabase.table("jobs").select(
        "id, title, fit_score"
    ).in_("id", job_ids).gte("fit_score", 70).execute()
    return jobs_res.data or []


async def check_interviewing_without_prep(user_id: str) -> bool:
    """
    Return True if user has any 'interviewing' application,
    but no incomplete todo contains 'interview' or 'prep' in title.
    """
    apps_res = await supabase.table("applications").select("id").eq("user_id", user_id).eq("status", "interviewing").execute()
    if not apps_res.data:
        return False

    todos_res = await supabase.table("todos").select("title").eq("user_id", user_id).eq("completed", False).execute()
    todos = todos_res.data or []

    for t in todos:
        title = t.get("title", "").lower()
        if "interview" in title or "prep" in title:
            return False

    return True


async def get_streak_days(user_id: str) -> int:
    """
    Compute task completion streak in days (consecutive days ending today or yesterday).
    """
    todos_completed_result = await supabase.table("todos").select(
        "completed_at"
    ).eq("user_id", user_id).eq("completed", True).execute()

    completed_dates = set()
    for t in (todos_completed_result.data or []):
        completed_at_str = t.get("completed_at")
        if completed_at_str:
            try:
                dt_str = completed_at_str.replace("Z", "+00:00")
                dt = datetime.fromisoformat(dt_str)
                dt_utc = dt.astimezone(timezone.utc)
                completed_dates.add(dt_utc.date())
            except Exception:
                pass

    today = datetime.now(timezone.utc).date()
    if today in completed_dates:
        check_date = today
    else:
        check_date = today - timedelta(days=1)

    live_streak = 0
    while check_date in completed_dates:
        live_streak += 1
        check_date -= timedelta(days=1)

    return live_streak


async def insert_nudge_if_new(user_id: str, message: str, job_ids: list[str] | None = None) -> dict | None:
    """
    Insert a nudge into database, unless the exact message exists as an unseen nudge.
    """
    unseen_res = await supabase.table("nudges").select(
        "id, message"
    ).eq("user_id", user_id).eq("seen", False).execute()
    unseen_nudges = unseen_res.data or []

    for n in unseen_nudges:
        if n["message"] == message:
            return None

    insert_payload = {
        "user_id": user_id,
        "message": message,
        "seen": False
    }
    if job_ids:
        insert_payload["job_ids"] = job_ids

    result = await supabase.table("nudges").insert(insert_payload).execute()
    if result.data:
        return result.data[0]
    return None


async def generate_nudge_for_user(user_id: str) -> dict | None:
    """
    Evaluates rule priority and generates at most one active new nudge.
    """
    # Rule 1: Overdue Goal
    overdue_goals = await get_overdue_goals(user_id)
    if overdue_goals:
        goal = overdue_goals[0]
        msg = f'Your goal "{goal["title"]}" is overdue. Finish one linked task today to get it moving again.'
        return await insert_nudge_if_new(user_id, msg)

    # Rule 2: Overdue Todo
    overdue_todos = await get_overdue_todos(user_id)
    if overdue_todos:
        todo = overdue_todos[0]
        msg = f'"{todo["title"]}" is overdue. Clear it now or move it to a realistic date.'
        return await insert_nudge_if_new(user_id, msg)

    # Rule 3: No Applications This Week
    has_apps = await has_applications_this_week(user_id)
    if not has_apps:
        high_fit_jobs = await get_high_fit_saved_jobs(user_id)
        if high_fit_jobs:
            msg = "You have not applied this week. Start with one of these high-fit saved roles today."
            job_ids = [job["id"] for job in high_fit_jobs]
            return await insert_nudge_if_new(user_id, msg, job_ids)
        else:
            msg = "You have not applied this week. Pick one saved role and send an application today."
            return await insert_nudge_if_new(user_id, msg)


    # Rule 4: High-Fit Saved Jobs
    high_fit_jobs = await get_high_fit_saved_jobs(user_id)
    if high_fit_jobs:
        count = len(high_fit_jobs)
        msg = f"You have {count} saved jobs above 70% fit. Apply to the strongest one before searching more."
        job_ids = [job["id"] for job in high_fit_jobs]
        return await insert_nudge_if_new(user_id, msg, job_ids)

    # Rule 5: Goal Due Soon
    due_soon_goals = await get_goals_due_soon(user_id, days=3)
    if due_soon_goals:
        goal = due_soon_goals[0]
        msg = f'"{goal["title"]}" is due soon. Complete one linked task today.'
        return await insert_nudge_if_new(user_id, msg)

    # Rule 6: Interviewing status without prep task
    needs_prep = await check_interviewing_without_prep(user_id)
    if needs_prep:
        msg = "You have an interview-stage application. Add prep tasks before the conversation gets close."
        return await insert_nudge_if_new(user_id, msg)

    # Rule 7: Positive streak reinforcement
    streak = await get_streak_days(user_id)
    if streak >= 3:
        msg = f"You are on a {streak}-day task streak. One small action today keeps your momentum."
        return await insert_nudge_if_new(user_id, msg)

    return None
