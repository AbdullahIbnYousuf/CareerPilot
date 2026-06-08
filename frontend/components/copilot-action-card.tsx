"use client";

import {
  Calendar,
  CheckCircle2,
  ExternalLink,
  Loader2,
  MapPin,
  Navigation,
  Search,
  Target,
} from "lucide-react";
import type { CopilotAction } from "@/types";

export type CopilotActionState = {
  status: "idle" | "loading" | "success" | "error";
  message?: string;
  href?: string;
};

type CopilotActionCardProps = {
  action: CopilotAction;
  state?: CopilotActionState;
  onExecute: () => void;
  onOpenHref: (href: string) => void;
};

function formatDraftDate(date?: string | null): string {
  if (!date) return "No date";
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ActionSummary({ action }: { action: CopilotAction }) {
  if (action.type === "open_route") {
    return (
      <p className="mt-1 flex items-center gap-1 text-white/45">
        <ExternalLink className="h-3 w-3" />
        {action.href}
      </p>
    );
  }

  if (action.type === "prefill_job_search") {
    return (
      <p className="mt-1 flex items-center gap-1 text-white/45">
        <MapPin className="h-3 w-3" />
        {action.query}
        {action.location ? ` in ${action.location}` : ""}
      </p>
    );
  }

  if (action.type === "create_todo") {
    return (
      <p className="mt-1 text-white/45">
        {action.todo.title} - {formatDraftDate(action.todo.due_date)}
      </p>
    );
  }

  if (action.type === "create_roadmap_with_tasks") {
    const todoCount = action.goals.reduce((count, goal) => count + goal.todos.length, 0);
    return (
      <div className="mt-1 space-y-1 text-white/45">
        <p>
          {action.goals.length} goals - {todoCount} tasks
        </p>
        <ul className="space-y-1">
          {action.goals.map((goal) => (
            <li key={`${goal.title}-${goal.target_date}`} className="flex gap-1.5">
              <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-[var(--cp-champagne)]" />
              <span>
                {goal.title} - {formatDraftDate(goal.target_date)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (action.type === "save_application") {
    return (
      <p className="mt-1 text-white/45">
        Save job to Applications{action.status ? ` as ${action.status}` : ""}
      </p>
    );
  }

  if (action.type === "update_application_status") {
    return (
      <p className="mt-1 text-white/45">
        Move application to {action.status}
      </p>
    );
  }

  if (action.type === "save_application_note") {
    return (
      <p className="mt-1 text-white/45">
        Save note: {action.note}
      </p>
    );
  }

  return (
    <div className="mt-1 space-y-1 text-white/45">
      <p>
        {action.goal.title} - {formatDraftDate(action.goal.target_date)}
      </p>
      {action.todos.length > 0 && (
        <ul className="space-y-1">
          {action.todos.map((todo) => (
            <li key={`${todo.title}-${todo.due_date}`} className="flex gap-1.5">
              <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-[var(--cp-champagne)]" />
              <span>
                {todo.title} - {formatDraftDate(todo.due_date)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CopilotActionCard({
  action,
  state = { status: "idle" },
  onExecute,
  onOpenHref,
}: CopilotActionCardProps) {
  const isApplicationAction =
    action.type === "save_application" ||
    action.type === "update_application_status" ||
    action.type === "save_application_note";
  const isMutation =
    action.type === "create_goal_with_todos" ||
    action.type === "create_roadmap_with_tasks" ||
    action.type === "create_todo" ||
    isApplicationAction;
  const isLoading = state.status === "loading";
  const successHref =
    state.href ?? (isApplicationAction ? "/tracker?view=applications" : "/tracker?view=goals_tasks");
  const Icon =
    action.type === "open_route"
      ? Navigation
      : action.type === "prefill_job_search"
        ? Search
        : action.type === "create_todo"
          ? Calendar
          : isApplicationAction
            ? CheckCircle2
            : Target;

  return (
    <div className="mt-2 rounded-xl border border-[var(--cp-border-medium)] bg-[rgba(201,130,74,0.08)] p-3 text-xs text-[var(--cp-text-soft)]">
      <div className="flex items-start gap-2">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[rgba(201,130,74,0.14)] text-[var(--cp-champagne)]">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="font-semibold text-[var(--cp-text-main)]">{action.label}</p>
            <ActionSummary action={action} />
          </div>

          {state.message && (
            <p
              className={`rounded-lg border px-2 py-1.5 ${
                state.status === "error"
                  ? "border-red-500/20 bg-red-500/10 text-red-300"
                  : "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
              }`}
            >
              {state.message}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {state.status === "success" && isMutation ? (
              <button
                type="button"
                onClick={() => onOpenHref(successHref)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--cp-border-strong)] bg-gradient-to-r from-[var(--cp-copper-deep)] to-[var(--cp-copper-strong)] px-3 py-1.5 font-semibold text-[var(--cp-bg-deep)] hover:brightness-110"
              >
                {isApplicationAction ? "Open Applications" : "Open Goals & Tasks"}
                <ExternalLink className="h-3 w-3" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onExecute}
                disabled={isLoading || state.status === "success"}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--cp-border-strong)] bg-gradient-to-r from-[var(--cp-copper-deep)] to-[var(--cp-copper-strong)] px-3 py-1.5 font-semibold text-[var(--cp-bg-deep)] hover:brightness-110 disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                {isMutation ? "Confirm" : "Open"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
