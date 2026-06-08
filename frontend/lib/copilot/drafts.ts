import type {
  CopilotPrefillApplicationNoteAction,
  CopilotPrefillGoalWithTodosAction,
  CopilotPrefillTodoAction,
} from "@/types";

export const COPILOT_GOALS_TASKS_DRAFT_KEY = "careerpilot:goals-tasks-draft:v1";
export const COPILOT_APPLICATION_NOTE_DRAFT_KEY = "careerpilot:application-note-draft:v1";

export type CopilotGoalsTasksDraft =
  | {
      type: "goal_with_todos";
      goal: CopilotPrefillGoalWithTodosAction["goal"];
      todos: CopilotPrefillGoalWithTodosAction["todos"];
    }
  | {
      type: "todo";
      todo: CopilotPrefillTodoAction["todo"];
    };

export type CopilotApplicationNoteDraft = {
  application_id: string;
  note: CopilotPrefillApplicationNoteAction["note"];
};

export function saveGoalsTasksDraft(draft: CopilotGoalsTasksDraft): void {
  window.localStorage.setItem(
    COPILOT_GOALS_TASKS_DRAFT_KEY,
    JSON.stringify({ ...draft, created_at: new Date().toISOString() }),
  );
}

export function takeGoalsTasksDraft(): CopilotGoalsTasksDraft | null {
  const raw = window.localStorage.getItem(COPILOT_GOALS_TASKS_DRAFT_KEY);
  if (!raw) return null;
  window.localStorage.removeItem(COPILOT_GOALS_TASKS_DRAFT_KEY);

  try {
    const parsed = JSON.parse(raw) as CopilotGoalsTasksDraft;
    return parsed;
  } catch {
    return null;
  }
}

export function saveApplicationNoteDraft(draft: CopilotApplicationNoteDraft): void {
  window.localStorage.setItem(
    COPILOT_APPLICATION_NOTE_DRAFT_KEY,
    JSON.stringify({ ...draft, created_at: new Date().toISOString() }),
  );
}

export function takeApplicationNoteDraft(): CopilotApplicationNoteDraft | null {
  const raw = window.localStorage.getItem(COPILOT_APPLICATION_NOTE_DRAFT_KEY);
  if (!raw) return null;
  window.localStorage.removeItem(COPILOT_APPLICATION_NOTE_DRAFT_KEY);

  try {
    const parsed = JSON.parse(raw) as CopilotApplicationNoteDraft;
    if (!parsed.application_id || !parsed.note) return null;
    return parsed;
  } catch {
    return null;
  }
}
