"""
Copilot V2 router.

Provides persistent preferences plus server-side validation/execution for
confirmed Copilot actions.
"""

from typing import Any, Literal, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from services.copilot import (
    execute_action,
    get_copilot_state,
    get_context_snapshot,
    get_preferences,
    list_action_events,
    patch_copilot_state,
    patch_preferences,
    validate_action,
)

router = APIRouter(prefix="/copilot", tags=["copilot"])


class CareerPreferencesPatch(BaseModel):
    preferred_name: Optional[str] = None
    target_roles: Optional[list[str]] = None
    preferred_locations: Optional[list[str]] = None
    work_modes: Optional[list[str]] = None
    seniority: Optional[str] = None
    weekly_capacity_hours: Optional[int] = None
    target_start_date: Optional[str] = None
    industries: Optional[list[str]] = None


class CopilotGoalDraft(BaseModel):
    title: str = ""
    target_date: Optional[str] = None


class CopilotTodoDraft(BaseModel):
    title: str = ""
    due_date: Optional[str] = None


class CopilotRoadmapGoalDraft(CopilotGoalDraft):
    todos: list[CopilotTodoDraft] = Field(default_factory=list)


class CopilotActionInput(BaseModel):
    type: str
    label: Optional[str] = None
    href: Optional[str] = None
    query: Optional[str] = None
    location: Optional[str] = None
    auto: Optional[bool] = None
    goal: Optional[CopilotGoalDraft] = None
    goals: list[CopilotRoadmapGoalDraft] = Field(default_factory=list)
    todos: list[CopilotTodoDraft] = Field(default_factory=list)
    todo: Optional[CopilotTodoDraft] = None
    job_id: Optional[str] = None
    application_id: Optional[str] = None
    status: Optional[Literal["saved", "applied", "interviewing", "offer", "rejected"]] = None
    note: Optional[str] = None
    feature: Optional[str] = None
    body: Optional[str] = None

    class Config:
        extra = "ignore"


class CopilotActionRequest(BaseModel):
    user_id: str
    action: CopilotActionInput
    source: str = "widget"


class CopilotStatePatch(BaseModel):
    onboarding: Optional[dict[str, Any]] = None
    completed_steps: Optional[list[str]] = None
    mark_step_complete: Optional[str] = None
    feature_exposure: Optional[dict[str, Any]] = None
    guidance_level: Optional[Literal["first_run", "guided", "light", "minimal"]] = None
    last_suggested_step: Optional[str] = None


def _action_payload(action: CopilotActionInput) -> dict[str, Any]:
    return action.model_dump(exclude_none=True)


@router.get("/preferences")
async def read_preferences(user_id: str = Query(...)):
    return {"preferences": await get_preferences(user_id)}


@router.get("/context")
async def read_context(user_id: str = Query(...)):
    return {"context": await get_context_snapshot(user_id)}


@router.get("/state")
async def read_state(user_id: str = Query(...)):
    return {"state": await get_copilot_state(user_id)}


@router.patch("/state")
async def update_state(
    request: CopilotStatePatch,
    user_id: str = Query(...),
):
    try:
        payload = request.model_dump(exclude_unset=True)
        return {"state": await patch_copilot_state(user_id, payload)}
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to save Copilot state: {str(exc)}")


@router.patch("/preferences")
async def update_preferences(
    request: CareerPreferencesPatch,
    user_id: str = Query(...),
):
    try:
        payload = request.model_dump(exclude_unset=True)
        return {"preferences": await patch_preferences(user_id, payload)}
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to save preferences: {str(exc)}")


@router.post("/actions/validate")
async def validate_copilot_action(request: CopilotActionRequest):
    try:
        return await validate_action(
            user_id=request.user_id,
            action=_action_payload(request.action),
            source=request.source,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to validate action: {str(exc)}")


@router.post("/actions/execute")
async def execute_copilot_action(request: CopilotActionRequest):
    try:
        return await execute_action(
            user_id=request.user_id,
            action=_action_payload(request.action),
            source=request.source,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to execute action: {str(exc)}")


@router.get("/actions/events")
async def read_action_events(user_id: str = Query(...)):
    return {"events": await list_action_events(user_id)}
