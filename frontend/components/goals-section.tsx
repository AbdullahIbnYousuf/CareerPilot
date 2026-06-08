"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  BookOpen,
  Briefcase,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Circle,
  FileText,
  GraduationCap,
  Loader2,
  Map,
  Mic,
  Plus,
  Sparkles,
  Target,
  TrendingUp,
  Trash2,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Goal, Todo } from "@/types";
import type { CopilotGoalsTasksDraft } from "@/lib/copilot/drafts";

interface GoalsSectionProps {
  userId: string;
  goals: Goal[];
  todos: Todo[];
  onGoalsChange: () => void;
  onTodosChange: () => void;
  draft?: CopilotGoalsTasksDraft | null;
  onGoalCreated?: (goal: Goal) => void;
  onTodoCreated?: (todo: Todo) => void;
  /** Called once the draft has been applied to the form so the parent can clear draft state. */
  onDraftConsumed?: () => void;
}

type GoalCategory =
  | "Applications"
  | "Learning"
  | "CV/Profile"
  | "Interview Prep"
  | "Roadmap";

type GoalStatus = "completed" | "overdue" | "due-soon" | "on-track";
type TodoBucket = "overdue" | "today" | "future" | "no-date" | "completed";

const categoryConfig: Record<
  GoalCategory,
  {
    icon: typeof Briefcase;
    className: string;
  }
> = {
  Applications: {
    icon: Briefcase,
    className:
      "border-[var(--cp-border-medium)] bg-[rgba(224,164,106,0.10)] text-[var(--cp-champagne)]",
  },
  Learning: {
    icon: GraduationCap,
    className: "border-amber-400/20 bg-amber-400/10 text-amber-200",
  },
  "CV/Profile": {
    icon: FileText,
    className:
      "border-[var(--cp-border-soft)] bg-[rgba(242,214,162,0.08)] text-[var(--cp-text-soft)]",
  },
  "Interview Prep": {
    icon: Mic,
    className:
      "border-[var(--cp-border-medium)] bg-[rgba(201,130,74,0.12)] text-[var(--cp-copper-strong)]",
  },
  Roadmap: {
    icon: Map,
    className: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
  },
};

const statusConfig: Record<
  GoalStatus,
  {
    label: string;
    className: string;
    cardClassName: string;
  }
> = {
  completed: {
    label: "Completed",
    className: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
    cardClassName:
      "bg-[rgba(24,23,22,0.68)] border-[var(--cp-border-soft)] opacity-65",
  },
  overdue: {
    label: "Overdue",
    className: "border-red-400/20 bg-red-500/10 text-red-300",
    cardClassName: "bg-red-500/[0.04] border-red-400/20",
  },
  "due-soon": {
    label: "Due soon",
    className: "border-amber-400/20 bg-amber-400/10 text-amber-200",
    cardClassName: "bg-amber-400/[0.04] border-amber-400/20",
  },
  "on-track": {
    label: "On track",
    className:
      "border-[var(--cp-border-medium)] bg-[rgba(224,164,106,0.10)] text-[var(--cp-champagne)]",
    cardClassName:
      "bg-[var(--cp-surface-elevated)] border-[var(--cp-border-soft)]",
  },
};

function todayStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function parseDateOnly(value?: string | null): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function formatDate(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function daysUntil(value?: string | null): number | null {
  const date = parseDateOnly(value);
  if (!date) return null;
  const diff = date.getTime() - todayStart().getTime();
  return Math.round(diff / 86_400_000);
}

function inferGoalCategory(title: string): GoalCategory {
  const normalized = title.toLowerCase();

  if (/\b(apply|application|job|jobs)\b/.test(normalized)) return "Applications";
  if (/\b(interview|prep|assessment)\b/.test(normalized)) return "Interview Prep";
  if (/\b(cv|resume|portfolio|github|linkedin)\b/.test(normalized)) return "CV/Profile";
  if (/\b(learn|course|skill|dsa|sql|python|ml)\b/.test(normalized)) return "Learning";
  if (/\b(roadmap|week-by-week|weekly plan|month plan)\b/.test(normalized)) return "Roadmap";
  return "Roadmap";
}

function getGoalStatus(goal: Goal): GoalStatus {
  if (goal.completed) return "completed";

  const remainingDays = daysUntil(goal.target_date);
  if (remainingDays === null) return "on-track";
  if (remainingDays < 0) return "overdue";
  if (remainingDays <= 3) return "due-soon";
  return "on-track";
}

function statusSortRank(status: GoalStatus): number {
  return {
    overdue: 0,
    "due-soon": 1,
    "on-track": 2,
    completed: 3,
  }[status];
}

function compareGoalDates(a: Goal, b: Goal): number {
  const aTime = parseDateOnly(a.target_date)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const bTime = parseDateOnly(b.target_date)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  return aTime - bTime;
}

function getTodoBucket(todo: Todo): TodoBucket {
  if (todo.completed) return "completed";

  const remainingDays = daysUntil(todo.due_date);
  if (remainingDays === null) return "no-date";
  if (remainingDays < 0) return "overdue";
  if (remainingDays === 0) return "today";
  return "future";
}

function bucketRank(bucket: TodoBucket): number {
  return {
    overdue: 0,
    today: 1,
    future: 2,
    "no-date": 3,
    completed: 4,
  }[bucket];
}

function compareTodoDates(a: Todo, b: Todo): number {
  const aTime = parseDateOnly(a.due_date)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const bTime = parseDateOnly(b.due_date)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  if (aTime !== bTime) return aTime - bTime;
  return a.title.localeCompare(b.title);
}

function sortTodos(todos: Todo[]): Todo[] {
  return [...todos].sort((a, b) => {
    const bucketDiff = bucketRank(getTodoBucket(a)) - bucketRank(getTodoBucket(b));
    if (bucketDiff !== 0) return bucketDiff;
    return compareTodoDates(a, b);
  });
}

export function GoalsSection({
  userId,
  goals,
  todos,
  onGoalsChange,
  onTodosChange,
  draft,
  onGoalCreated,
  onTodoCreated,
  onDraftConsumed,
}: GoalsSectionProps) {
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newTargetDate, setNewTargetDate] = useState("");
  const [newTargetSkill, setNewTargetSkill] = useState("");
  const [draftTodos, setDraftTodos] = useState<{ title: string; due_date?: string | null }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingGoalId, setDeletingGoalId] = useState<string | null>(null);
  const [inlineMsg, setInlineMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [skillAddedGoalIds, setSkillAddedGoalIds] = useState<Set<string>>(new Set());
  const [pendingSkillGoal, setPendingSkillGoal] = useState<Goal | null>(null);

  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const flash = useCallback((type: "success" | "error", text: string) => {
    setInlineMsg({ type, text });
    window.setTimeout(() => setInlineMsg(null), 4000);
  }, []);

  useEffect(() => {
    if (draft?.type !== "goal_with_todos") return;

    const timeoutId = window.setTimeout(() => {
      setShowForm(true);
      setNewTitle(draft.goal.title);
      setNewTargetDate(draft.goal.target_date ?? "");
      setDraftTodos(draft.todos);
      flash("success", "CareerPilot filled a goal draft. Review it, then click Create.");
      // Signal to the parent that the draft has been consumed so it won't re-fire
      onDraftConsumed?.();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [draft, flash, onDraftConsumed]);

  const createGoal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newTitle.trim()) return;

    setSubmitting(true);
    try {
      const body: Record<string, string | null> = {
        user_id: userId,
        title: newTitle.trim(),
        target_date: newTargetDate || null,
      };
      if (newTargetSkill.trim()) {
        body.target_skill = newTargetSkill.trim();
      }

      const res = await fetch(`${baseUrl}/tracker/goals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        flash("error", "Failed to create goal.");
        return;
      }

      const data = (await res.json()) as { goal?: Goal };
      if (data.goal && draftTodos.length > 0) {
        const createdTodos = await Promise.all(
          draftTodos.map(async (todo) => {
            const todoRes = await fetch(`${baseUrl}/tracker/todos`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                user_id: userId,
                goal_id: data.goal?.id,
                title: todo.title,
                due_date: todo.due_date || null,
              }),
            });

            if (!todoRes.ok) return null;
            const todoData = (await todoRes.json()) as { todo?: Todo };
            return todoData.todo ?? null;
          }),
        );
        createdTodos.filter(Boolean).forEach((todo) => onTodoCreated?.(todo as Todo));
      }
      setNewTitle("");
      setNewTargetDate("");
      setNewTargetSkill("");
      setDraftTodos([]);
      setShowForm(false);
      flash("success", draftTodos.length > 0 ? "Goal and tasks created." : "Goal created.");
      if (data.goal) {
        onGoalCreated?.(data.goal);
      }
      onGoalsChange();
    } catch {
      flash("error", "Failed to create goal.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleGoal = async (goal: Goal) => {
    setTogglingId(goal.id);
    try {
      const nextCompleted = !goal.completed;
      const res = await fetch(`${baseUrl}/tracker/goals/${goal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: nextCompleted }),
      });

      if (!res.ok) {
        flash("error", "Failed to update goal.");
        return;
      }

      if (nextCompleted && goal.target_skill && !skillAddedGoalIds.has(goal.id)) {
        setPendingSkillGoal(goal);
      }

      onGoalsChange();
    } catch {
      flash("error", "Failed to update goal.");
    } finally {
      setTogglingId(null);
    }
  };

  const deleteGoal = async (goal: Goal) => {
    setDeletingGoalId(goal.id);
    try {
      const res = await fetch(`${baseUrl}/tracker/goals/${goal.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        flash("error", "Failed to delete goal.");
        return;
      }

      flash("success", "Goal deleted.");
      onGoalsChange();
      onTodosChange();
    } catch {
      flash("error", "Failed to delete goal.");
    } finally {
      setDeletingGoalId(null);
    }
  };

  const addSkillToProfile = useCallback(
    async (goal: Goal) => {
      try {
        const encodedUserId = encodeURIComponent(userId);
        const res = await fetch(
          `${baseUrl}/tracker/goals/${goal.id}/add-skill?user_id=${encodedUserId}`,
          { method: "POST" }
        );

        if (!res.ok) {
          const errData = (await res.json().catch(() => ({}))) as { detail?: string };
          flash("error", errData.detail ?? "Failed to add skill.");
          return;
        }

        const data = (await res.json()) as {
          skill: string;
          added_to_profile: boolean;
          event_created: boolean;
        };

        setSkillAddedGoalIds((prev) => new Set([...prev, goal.id]));
        setPendingSkillGoal((curr) => (curr?.id === goal.id ? null : curr));
        flash("success", `${data.skill} added to your profile skills.`);
      } catch {
        flash("error", "Failed to add skill to profile.");
      }
    },
    [baseUrl, flash, userId]
  );

  const totalGoals = goals.length;
  const completedGoals = goals.filter((goal) => goal.completed).length;
  const activeGoals = totalGoals - completedGoals;

  const getProgress = (goalId: string) => {
    const linked = todos.filter((todo) => todo.goal_id === goalId);
    const done = linked.filter((todo) => todo.completed).length;
    const pct = linked.length === 0 ? 0 : Math.round((done / linked.length) * 100);
    return { total: linked.length, done, pct };
  };

  const sortedGoals = [...goals].sort((a, b) => {
    const statusDiff = statusSortRank(getGoalStatus(a)) - statusSortRank(getGoalStatus(b));
    if (statusDiff !== 0) return statusDiff;
    return compareGoalDates(a, b);
  });

  return (
    <Card className="w-full rounded-2xl border border-[var(--cp-border-soft)] bg-[var(--cp-surface)] shadow-xl shadow-black/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base font-bold text-white">
            <Target className="h-4 w-4 text-[var(--cp-copper-strong)]" />
            Goals
          </CardTitle>
          <Button
            id="add-goal-btn"
            type="button"
            size="sm"
            onClick={() => setShowForm((value) => !value)}
            variant="outline"
          >
            <Plus className="h-3.5 w-3.5" />
            Add goal
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {totalGoals > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Total", value: totalGoals, color: "text-white" },
              { label: "Active", value: activeGoals, color: "text-[var(--cp-champagne)]" },
              {
                label: "Completed",
                value: completedGoals,
                color: "text-emerald-400",
              },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-0.5 rounded-xl border border-[var(--cp-border-soft)] bg-[var(--cp-surface-elevated)] p-2.5"
              >
                <span className={`text-xl font-bold tracking-tight ${color}`}>{value}</span>
                <span className="text-[10px] font-medium text-white/40">{label}</span>
              </div>
            ))}
          </div>
        )}

        {pendingSkillGoal && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-300 rounded-xl border border-[var(--cp-border-medium)] bg-[rgba(201,130,74,0.12)] p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-[var(--cp-champagne)]" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">Goal completed!</p>
                <p className="mt-1 text-xs leading-relaxed text-white/70">
                  Congratulations on completing{" "}
                  <span className="font-semibold text-[var(--cp-champagne)]">
                    &ldquo;{pendingSkillGoal.title}&rdquo;
                  </span>
                  . Would you like to add{" "}
                  <span className="font-bold text-[var(--cp-copper-strong)]">
                    {pendingSkillGoal.target_skill}
                  </span>{" "}
                  to your profile skills?
                </p>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => addSkillToProfile(pendingSkillGoal)}
                className="h-8 gap-1 px-3 text-xs"
              >
                <Sparkles className="h-3 w-3" />
                Add {pendingSkillGoal.target_skill} to Profile
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPendingSkillGoal(null)}
                className="h-8 px-3 text-xs text-white/45 hover:bg-[rgba(201,130,74,0.08)] hover:text-white"
              >
                Skip
              </Button>
            </div>
          </div>
        )}

        {inlineMsg && (
          <div
            className={`rounded-lg border px-3 py-2 text-xs ${
              inlineMsg.type === "success"
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                : "border-red-500/20 bg-red-500/10 text-red-400"
            }`}
          >
            {inlineMsg.text}
          </div>
        )}

        {showForm && (
          <form
            onSubmit={createGoal}
            className="animate-in fade-in slide-in-from-top-1 space-y-2.5 rounded-xl border border-[var(--cp-border-soft)] bg-[var(--cp-surface-elevated)] p-3.5 duration-200"
          >
            <input
              id="new-goal-title"
              type="text"
              placeholder="Apply to 5 jobs this week..."
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              required
              className="h-9 w-full rounded-xl border border-[var(--cp-border-soft)] bg-[rgba(255,255,255,0.035)] px-3.5 text-sm text-white transition-all placeholder:text-white/25 focus:border-[var(--cp-border-strong)] focus:outline-none focus:ring-1 focus:ring-[var(--cp-glow-copper)]"
            />
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/20" />
              <input
                id="new-goal-target-date"
                type="date"
                value={newTargetDate}
                onChange={(event) => setNewTargetDate(event.target.value)}
                className="h-9 w-full rounded-xl border border-[var(--cp-border-soft)] bg-[rgba(255,255,255,0.035)] pl-9 pr-3 text-xs text-white/70 transition-all [color-scheme:dark] focus:border-[var(--cp-border-strong)] focus:outline-none"
              />
            </div>
            <div className="relative">
              <Zap className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/20" />
              <input
                id="new-goal-target-skill"
                type="text"
                placeholder="Target skill (optional) - e.g. SQL, Docker, LangGraph"
                value={newTargetSkill}
                onChange={(event) => setNewTargetSkill(event.target.value)}
                className="h-9 w-full rounded-xl border border-[var(--cp-border-soft)] bg-[rgba(255,255,255,0.035)] pl-9 pr-3 text-xs text-white/70 transition-all placeholder:text-white/25 focus:border-[var(--cp-border-strong)] focus:outline-none"
              />
            </div>
            {draftTodos.length > 0 && (
              <div className="rounded-xl border border-[var(--cp-border-soft)] bg-white/[0.025] p-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-white/30">
                  CareerPilot task draft
                </p>
                <ul className="space-y-1.5 text-xs text-white/55">
                  {draftTodos.map((todo) => (
                    <li key={`${todo.title}-${todo.due_date}`} className="flex gap-1.5">
                      <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-[var(--cp-champagne)]" />
                      <span>{todo.title}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex gap-2">
              <Button
                id="submit-goal-btn"
                type="submit"
                disabled={submitting || !newTitle.trim()}
                className="flex-1"
              >
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Create"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowForm(false)}
                className="text-white/50 hover:bg-[rgba(201,130,74,0.08)] hover:text-white"
              >
                Cancel
              </Button>
            </div>
          </form>
        )}

        {goals.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <Target className="h-8 w-8 text-white/10" />
            <p className="max-w-[260px] text-sm text-white/35">
              Create one weekly target to keep your job search moving.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedGoals.map((goal) => {
              const { total, done, pct } = getProgress(goal.id);
              return (
                <GoalCard
                  key={goal.id}
                  baseUrl={baseUrl}
                  userId={userId}
                  goal={goal}
                  todos={todos}
                  totalTodos={total}
                  doneTodos={done}
                  pct={pct}
                  isToggling={togglingId === goal.id}
                  isDeletingGoal={deletingGoalId === goal.id}
                  skillAdded={skillAddedGoalIds.has(goal.id)}
                  onToggle={() => toggleGoal(goal)}
                  onAddSkill={() => addSkillToProfile(goal)}
                  onDeleteGoal={() => deleteGoal(goal)}
                  onTodosChange={onTodosChange}
                  onTodoCreated={onTodoCreated}
                />
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function GoalCard({
  baseUrl,
  userId,
  goal,
  todos,
  totalTodos,
  doneTodos,
  pct,
  isToggling,
  isDeletingGoal,
  skillAdded,
  onToggle,
  onAddSkill,
  onDeleteGoal,
  onTodosChange,
  onTodoCreated,
}: {
  baseUrl: string;
  userId: string;
  goal: Goal;
  todos: Todo[];
  totalTodos: number;
  doneTodos: number;
  pct: number;
  isToggling: boolean;
  isDeletingGoal: boolean;
  skillAdded: boolean;
  onToggle: () => void;
  onAddSkill: () => void;
  onDeleteGoal: () => void;
  onTodosChange?: () => void;
  onTodoCreated?: (todo: Todo) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [submittingTask, setSubmittingTask] = useState(false);
  const [taskInlineMsg, setTaskInlineMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [togglingTodoId, setTogglingTodoId] = useState<string | null>(null);
  const [deletingTodoId, setDeletingTodoId] = useState<string | null>(null);

  const category = inferGoalCategory(goal.title);
  const CategoryIcon = categoryConfig[category].icon;
  const status = getGoalStatus(goal);
  const statusDetails = statusConfig[status];
  const progressColor =
    pct === 100
      ? "[&_[data-slot=progress-indicator]]:bg-emerald-400"
      : "[&_[data-slot=progress-indicator]]:bg-[var(--cp-copper-strong)]";
  const linkedTodos = sortTodos((todos ?? []).filter((todo) => todo.goal_id === goal.id));
  const taskSectionId = `goal-tasks-${goal.id}`;
  const currentUserId = userId ?? goal.user_id;
  const currentBaseUrl = baseUrl || "http://localhost:8000";

  const canAddSkillToProfile = goal.completed || (totalTodos > 0 && pct === 100);
  const showSkillAction = Boolean(goal.target_skill) && !skillAdded;

  const isCompletedPendingSkill = goal.completed && !!goal.target_skill && !skillAdded;
  const cardClassName =
    status === "completed" && isCompletedPendingSkill
      ? "bg-[var(--cp-surface-elevated)] border-[var(--cp-border-soft)] opacity-100"
      : statusDetails.cardClassName;

  const flashTask = (type: "success" | "error", text: string) => {
    setTaskInlineMsg({ type, text });
    window.setTimeout(() => setTaskInlineMsg(null), 3000);
  };

  const createLinkedTodo = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newTaskTitle.trim()) return;

    setSubmittingTask(true);
    try {
      const res = await fetch(`${currentBaseUrl}/tracker/todos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: currentUserId,
          goal_id: goal.id,
          title: newTaskTitle.trim(),
          due_date: newTaskDueDate || null,
        }),
      });

      if (!res.ok) {
        flashTask("error", "Failed to add task.");
        return;
      }

      const data = (await res.json()) as { todo?: Todo };
      setNewTaskTitle("");
      setNewTaskDueDate("");
      setShowTaskForm(false);
      flashTask("success", "Task added.");
      if (data.todo) {
        onTodoCreated?.(data.todo);
        return;
      }
      onTodosChange?.();
    } catch {
      flashTask("error", "Failed to add task.");
    } finally {
      setSubmittingTask(false);
    }
  };

  const toggleTodo = async (todo: Todo) => {
    setTogglingTodoId(todo.id);
    try {
      const res = await fetch(`${currentBaseUrl}/tracker/todos/${todo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !todo.completed }),
      });

      if (!res.ok) {
        flashTask("error", "Failed to update task.");
        return;
      }

      onTodosChange?.();
    } catch {
      flashTask("error", "Failed to update task.");
    } finally {
      setTogglingTodoId(null);
    }
  };

  const deleteTodo = async (todoId: string) => {
    setDeletingTodoId(todoId);
    try {
      const res = await fetch(`${currentBaseUrl}/tracker/todos/${todoId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        flashTask("error", "Failed to delete task.");
        return;
      }

      flashTask("success", "Task deleted.");
      onTodosChange?.();
    } catch {
      flashTask("error", "Failed to delete task.");
    } finally {
      setDeletingTodoId(null);
    }
  };

  return (
    <div
      className={`rounded-xl border p-3.5 transition-all duration-200 hover:border-[var(--cp-border-medium)] ${cardClassName}`}
    >
      <div className="flex items-start gap-2.5">
        <button
          id={`goal-toggle-${goal.id}`}
          type="button"
          onClick={onToggle}
          disabled={isToggling}
          aria-label={goal.completed ? "Mark goal active" : "Mark goal completed"}
          className="mt-0.5 shrink-0 transition-colors disabled:opacity-50"
        >
          {isToggling ? (
            <Loader2 className="h-4 w-4 animate-spin text-white/30" />
          ) : goal.completed ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          ) : (
            <Circle className="h-4 w-4 text-white/20 hover:text-[var(--cp-copper-strong)]" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <button
            id={`goal-disclosure-${goal.id}`}
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            aria-controls={taskSectionId}
            className="flex w-full items-start justify-between gap-3 text-left"
          >
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p
                  className={`text-sm font-semibold leading-snug ${
                    goal.completed ? "line-through text-white/30" : "text-white/90"
                  }`}
                >
                  {goal.title}
                </p>
                <Badge variant="outline" className={statusDetails.className}>
                  {statusDetails.label}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={categoryConfig[category].className}>
                  <CategoryIcon className="h-3 w-3" />
                  {category}
                </Badge>

                {goal.target_skill && (
                  <Badge
                    variant="outline"
                    className="gap-1 border-[var(--cp-border-medium)] bg-[rgba(201,130,74,0.10)] text-[var(--cp-champagne)]"
                  >
                    <Sparkles className="h-2.5 w-2.5" />
                    {goal.target_skill}
                  </Badge>
                )}

                {goal.target_date && (
                  <span className="flex items-center gap-1 text-[10px] text-white/35">
                    <Calendar className="h-2.5 w-2.5" />
                    {formatDate(goal.target_date)}
                  </span>
                )}
                <span className="flex items-center gap-1 text-[10px] text-white/35">
                  <TrendingUp className="h-2.5 w-2.5" />
                  {doneTodos}/{totalTodos} tasks
                </span>
              </div>
            </div>

            <ChevronDown
              className={`mt-0.5 h-4 w-4 shrink-0 text-white/25 transition-transform ${
                expanded ? "rotate-180" : ""
              }`}
            />
          </button>

          <div className="mt-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-white/25">Linked task progress</span>
              <span className="text-[10px] font-semibold text-white/45">{pct}%</span>
            </div>
            <Progress
              value={pct}
              className={`gap-1 [&_[data-slot=progress-track]]:bg-[rgba(242,214,162,0.08)] ${progressColor}`}
            />
            {totalTodos === 0 && (
              <div className="flex items-center gap-1 text-[10px] text-white/25">
                <BookOpen className="h-2.5 w-2.5" />
                Add tasks to start moving this goal.
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {showSkillAction && (
              <Button
                id={`add-skill-btn-${goal.id}`}
                type="button"
                size="sm"
                variant="outline"
                onClick={onAddSkill}
                disabled={!canAddSkillToProfile}
                title={
                  canAddSkillToProfile
                    ? `Add ${goal.target_skill} to Profile`
                    : "Complete the goal first to add this skill to Profile"
                }
                className="h-8 gap-1.5 text-xs"
              >
                <Sparkles className="h-3 w-3" />
                Add {goal.target_skill} to Profile
              </Button>
            )}
            <Button
              id={`goal-delete-${goal.id}`}
              type="button"
              variant="ghost"
              size="sm"
              onClick={onDeleteGoal}
              disabled={isDeletingGoal || isToggling}
              aria-label={`Delete goal ${goal.title}`}
              className="h-8 gap-1.5 text-xs text-white/35 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
            >
              {isDeletingGoal ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              Delete
            </Button>
          </div>

          {skillAdded && goal.target_skill && (
            <div className="mt-1 flex items-center gap-1.5 text-[10px] text-emerald-400">
              <CheckCircle2 className="h-3 w-3" />
              {goal.target_skill} added to your profile skills.
            </div>
          )}

          {expanded && (
            <div id={taskSectionId} className="mt-4 space-y-3 border-t border-[var(--cp-border-soft)] pt-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">
                    Linked tasks
                  </p>
                  <p className="text-[10px] text-white/20">
                    {linkedTodos.length === 0
                      ? "No linked tasks yet."
                      : `${linkedTodos.length} task${linkedTodos.length === 1 ? "" : "s"}`}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowTaskForm((value) => !value)}
                  className="h-8"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {showTaskForm ? "Hide form" : "Add task"}
                </Button>
              </div>

              {taskInlineMsg && (
                <div
                  className={`rounded-lg border px-3 py-2 text-xs ${
                    taskInlineMsg.type === "success"
                      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                      : "border-red-500/20 bg-red-500/10 text-red-400"
                  }`}
                >
                  {taskInlineMsg.text}
                </div>
              )}

              {showTaskForm && (
                <form
                  onSubmit={createLinkedTodo}
                  className="animate-in fade-in slide-in-from-top-1 space-y-2.5 rounded-xl border border-[var(--cp-border-soft)] bg-[var(--cp-surface-elevated)] p-3.5 duration-200"
                >
                  <input
                    id={`goal-task-title-${goal.id}`}
                    type="text"
                    placeholder="Break this goal into one action..."
                    value={newTaskTitle}
                    onChange={(event) => setNewTaskTitle(event.target.value)}
                    required
                    className="h-9 w-full rounded-xl border border-[var(--cp-border-soft)] bg-[rgba(255,255,255,0.035)] px-3.5 text-sm text-white transition-all placeholder:text-white/25 focus:border-[var(--cp-border-strong)] focus:outline-none focus:ring-1 focus:ring-[var(--cp-glow-copper)]"
                  />
                  <div className="relative">
                    <Calendar className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/20" />
                    <input
                      id={`goal-task-due-date-${goal.id}`}
                      type="date"
                      value={newTaskDueDate}
                      onChange={(event) => setNewTaskDueDate(event.target.value)}
                      className="h-9 w-full rounded-xl border border-[var(--cp-border-soft)] bg-[rgba(255,255,255,0.035)] pl-9 pr-3 text-xs text-white/70 transition-all [color-scheme:dark] focus:border-[var(--cp-border-strong)] focus:outline-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      disabled={submittingTask || !newTaskTitle.trim()}
                      className="flex-1"
                    >
                      {submittingTask ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        "Add"
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setShowTaskForm(false)}
                      className="text-white/50 hover:bg-[rgba(201,130,74,0.08)] hover:text-white"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              )}

              {linkedTodos.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--cp-border-soft)] px-3 py-4 text-center text-xs text-white/30">
                  Open the form above to add the first task for this goal.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {linkedTodos.map((todo) => (
                    <GoalTodoItem
                      key={todo.id}
                      todo={todo}
                      isDeleting={deletingTodoId === todo.id}
                      isToggling={togglingTodoId === todo.id}
                      onToggle={() => toggleTodo(todo)}
                      onDelete={() => deleteTodo(todo.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function GoalTodoItem({
  todo,
  isDeleting,
  isToggling,
  onToggle,
  onDelete,
}: {
  todo: Todo;
  isDeleting: boolean;
  isToggling: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const bucket = getTodoBucket(todo);
  const isOverdue = bucket === "overdue";
  const isToday = bucket === "today";
  const cardClassName = todo.completed
    ? "border-[var(--cp-border-soft)] bg-[rgba(24,23,22,0.68)] opacity-55"
    : isOverdue
      ? "border-red-400/20 bg-red-500/[0.04]"
      : isToday
        ? "border-amber-400/20 bg-amber-400/[0.04]"
        : "border-[var(--cp-border-soft)] bg-[var(--cp-surface-elevated)] hover:border-[var(--cp-border-medium)] hover:bg-[rgba(201,130,74,0.06)]";

  return (
    <div
      className={`group flex items-start gap-2.5 rounded-xl border p-3 transition-all duration-200 ${cardClassName}`}
    >
      <button
        id={`goal-todo-toggle-${todo.id}`}
        type="button"
        onClick={onToggle}
        disabled={isToggling || isDeleting}
        aria-label={todo.completed ? "Mark task incomplete" : "Mark task complete"}
        className="mt-0.5 shrink-0 transition-colors disabled:opacity-50"
      >
        {isToggling ? (
          <Loader2 className="h-4 w-4 animate-spin text-white/30" />
        ) : todo.completed ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
        ) : (
          <Circle className="h-4 w-4 text-white/20 hover:text-[var(--cp-copper-strong)]" />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <p
          className={`text-sm font-medium leading-snug ${
            todo.completed ? "line-through text-white/30" : "text-white/85"
          }`}
        >
          {todo.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {todo.due_date && (
            <span
              className={`flex items-center gap-1 text-[10px] ${
                isOverdue ? "text-red-300" : isToday ? "text-amber-200" : "text-white/35"
              }`}
            >
              <Calendar className="h-2.5 w-2.5" />
              {formatDate(todo.due_date)}
            </span>
          )}
        </div>
      </div>

      <Button
        id={`goal-todo-delete-${todo.id}`}
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={onDelete}
        disabled={isDeleting || isToggling}
        aria-label="Delete task"
        className="shrink-0 text-white/25 opacity-100 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50 sm:opacity-0 sm:group-hover:opacity-100"
      >
        {isDeleting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Trash2 className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  );
}
