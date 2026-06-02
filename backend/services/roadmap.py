"""
Roadmap service — CareerPilot

Helper for bulk-creating a goal with its linked todos in one call.
This is NOT wired to an LLM yet — it is a pure data helper designed to
be called by future AI-planning routes or admin scripts.

Usage:
    from services.roadmap import create_goal_with_todos

    result = await create_goal_with_todos(
        user_id="uuid",
        goal_title="Get a backend internship",
        tasks=["Update CV", "Apply to 10 companies", "Prep for interviews"],
        target_date="2026-08-01",          # optional
    )
    # result == {"goal": {...}, "todos": [{...}, ...]}
"""

from typing import Optional
from db.supabase import supabase


async def create_goal_with_todos(
    user_id: str,
    goal_title: str,
    tasks: list[str],
    target_date: Optional[str] = None,
) -> dict:
    """
    Create one goal and all linked todos atomically (sequential inserts).

    Args:
        user_id:      UUID of the authenticated user.
        goal_title:   Human-readable goal title.
        tasks:        List of todo titles to create under this goal.
        target_date:  Optional ISO date string (YYYY-MM-DD).

    Returns:
        {"goal": <goal row>, "todos": [<todo row>, ...]}

    Raises:
        ValueError: if the goal insert fails.
    """
    # 1. Create the goal
    goal_result = await supabase.table("goals").insert({
        "user_id":     user_id,
        "title":       goal_title,
        "target_date": target_date,
        "completed":   False,
    }).execute()

    if not goal_result.data:
        raise ValueError("Failed to create goal.")

    goal = goal_result.data[0]
    goal_id: str = goal["id"]

    # 2. Create one todo per task title (preserve order via sequential inserts)
    todos: list[dict] = []
    for task_title in tasks:
        if not task_title.strip():
            continue
        todo_result = await supabase.table("todos").insert({
            "user_id":   user_id,
            "goal_id":   goal_id,
            "title":     task_title.strip(),
            "completed": False,
        }).execute()
        if todo_result.data:
            todos.append(todo_result.data[0])

    return {"goal": goal, "todos": todos}
