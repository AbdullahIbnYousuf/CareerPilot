"use client";

import { useState, useCallback, type FormEvent } from "react";
import {
  BookOpen,
  Briefcase,
  Calendar,
  CheckCircle2,
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
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Goal, Todo } from "@/types";

interface GoalsSectionProps {
  userId: string;
  goals: Goal[];
  todos: Todo[];
  onGoalsChange: () => void;
  onGoalCreated?: (goal: Goal) => void;
}

type GoalCategory =
  | "Applications"
  | "Learning"
  | "CV/Profile"
  | "Interview Prep"
  | "Roadmap";

type GoalStatus = "completed" | "overdue" | "due-soon" | "on-track";

const categoryConfig: Record<
  GoalCategory,
  {
    icon: typeof Briefcase;
    className: string;
  }
> = {
  Applications: {
    icon: Briefcase,
    className: "border-sky-400/20 bg-sky-400/10 text-sky-200",
  },
  Learning: {
    icon: GraduationCap,
    className: "border-amber-400/20 bg-amber-400/10 text-amber-200",
  },
  "CV/Profile": {
    icon: FileText,
    className: "border-cyan-400/20 bg-cyan-400/10 text-cyan-200",
  },
  "Interview Prep": {
    icon: Mic,
    className: "border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-200",
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
    cardClassName: "bg-white/[0.01] border-white/[0.03] opacity-60",
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
    className: "border-[#534AB7]/20 bg-[#534AB7]/10 text-[#AFA9EC]",
    cardClassName: "bg-[#0E0E12] border-white/[0.06]",
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

  if (/\b(apply|application|job|jobs)\b/.test(normalized)) {
    return "Applications";
  }
  if (/\b(interview|prep|assessment)\b/.test(normalized)) {
    return "Interview Prep";
  }
  if (/\b(cv|resume|portfolio|github|linkedin)\b/.test(normalized)) {
    return "CV/Profile";
  }
  if (/\b(learn|course|skill|dsa|sql|python|ml)\b/.test(normalized)) {
    return "Learning";
  }
  if (/\b(roadmap|week-by-week|weekly plan|month plan)\b/.test(normalized)) {
    return "Roadmap";
  }

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

export function GoalsSection({
  userId,
  goals,
  todos,
  onGoalsChange,
  onGoalCreated,
}: GoalsSectionProps) {
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newTargetDate, setNewTargetDate] = useState("");
  const [newTargetSkill, setNewTargetSkill] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [inlineMsg, setInlineMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  // Track which goal IDs have had their skill successfully added this session
  const [skillAddedGoalIds, setSkillAddedGoalIds] = useState<Set<string>>(new Set());
  const [pendingSkillGoal, setPendingSkillGoal] = useState<Goal | null>(null);

  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const flash = (type: "success" | "error", text: string) => {
    setInlineMsg({ type, text });
    window.setTimeout(() => setInlineMsg(null), 4000);
  };

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

      setNewTitle("");
      setNewTargetDate("");
      setNewTargetSkill("");
      setShowForm(false);
      flash("success", "Goal created.");
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
        flash(
          "success",
          `${data.skill} added to your profile skills.`
        );
      } catch {
        flash("error", "Failed to add skill to profile.");
      }
    },
    [userId, baseUrl, setPendingSkillGoal]
  );

  const totalGoals = goals.length;
  const completedGoals = goals.filter((goal) => goal.completed).length;
  const activeGoals = totalGoals - completedGoals;

  const getProgress = (goalId: string) => {
    const linked = todos.filter((todo) => todo.goal_id === goalId);
    const done = linked.filter((todo) => todo.completed).length;
    const pct =
      linked.length === 0 ? 0 : Math.round((done / linked.length) * 100);
    return { total: linked.length, done, pct };
  };

  const sortedGoals = [...goals].sort((a, b) => {
    const statusDiff =
      statusSortRank(getGoalStatus(a)) - statusSortRank(getGoalStatus(b));
    if (statusDiff !== 0) return statusDiff;
    return compareGoalDates(a, b);
  });

  return (
    <Card className="w-full rounded-2xl border border-white/[0.06] bg-[#0E0E12] shadow-xl shadow-black/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base font-bold text-white">
            <Target className="h-4 w-4 text-[#7C74DB]" />
            Goals
          </CardTitle>
          <Button
            id="add-goal-btn"
            type="button"
            size="sm"
            onClick={() => setShowForm((value) => !value)}
            className="bg-[#534AB7]/20 text-[#AFA9EC] hover:bg-[#534AB7]/30"
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
              { label: "Active", value: activeGoals, color: "text-[#AFA9EC]" },
              {
                label: "Completed",
                value: completedGoals,
                color: "text-emerald-400",
              },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-0.5 rounded-xl border border-white/[0.04] bg-white/[0.02] p-2.5"
              >
                <span className={`text-xl font-bold tracking-tight ${color}`}>
                  {value}
                </span>
                <span className="text-[10px] font-medium text-white/40">
                  {label}
                </span>
              </div>
            ))}
          </div>
        )}

        {pendingSkillGoal && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-300 rounded-xl border border-violet-500/30 bg-violet-500/10 p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 shrink-0 text-violet-300 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">Goal completed!</p>
                <p className="text-xs text-white/70 mt-1 leading-relaxed">
                  Congratulations on completing <span className="font-semibold text-violet-200">&ldquo;{pendingSkillGoal.title}&rdquo;</span>.
                  Would you like to add <span className="font-bold text-violet-300">{pendingSkillGoal.target_skill}</span> to your profile skills?
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <Button
                type="button"
                size="sm"
                onClick={() => addSkillToProfile(pendingSkillGoal)}
                className="bg-[#534AB7] hover:bg-[#6B63CC] text-white gap-1 text-xs px-3 h-8"
              >
                <Sparkles className="h-3 w-3" />
                Add {pendingSkillGoal.target_skill} to Profile
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPendingSkillGoal(null)}
                className="text-white/40 hover:bg-white/[0.04] hover:text-white text-xs px-3 h-8"
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
            className="animate-in fade-in slide-in-from-top-1 space-y-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 duration-200"
          >
            <input
              id="new-goal-title"
              type="text"
              placeholder="Apply to 5 jobs this week..."
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              required
              className="h-9 w-full rounded-xl border border-white/[0.06] bg-white/[0.04] px-3.5 text-sm text-white transition-all placeholder:text-white/20 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20"
            />
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/20" />
              <input
                id="new-goal-target-date"
                type="date"
                value={newTargetDate}
                onChange={(event) => setNewTargetDate(event.target.value)}
                className="h-9 w-full rounded-xl border border-white/[0.06] bg-white/[0.04] pl-9 pr-3 text-xs text-white/70 transition-all [color-scheme:dark] focus:border-primary/50 focus:outline-none"
              />
            </div>
            <div className="relative">
              <Zap className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/20" />
              <input
                id="new-goal-target-skill"
                type="text"
                placeholder="Target skill (optional) — e.g. SQL, Docker, LangGraph"
                value={newTargetSkill}
                onChange={(event) => setNewTargetSkill(event.target.value)}
                className="h-9 w-full rounded-xl border border-white/[0.06] bg-white/[0.04] pl-9 pr-3 text-xs text-white/70 transition-all placeholder:text-white/20 focus:border-primary/50 focus:outline-none"
              />
            </div>
            <div className="flex gap-2">
              <Button
                id="submit-goal-btn"
                type="submit"
                disabled={submitting || !newTitle.trim()}
                className="flex-1 bg-[#534AB7] text-white hover:bg-[#6B63CC]"
              >
                {submitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "Create"
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowForm(false)}
                className="text-white/50 hover:bg-white/[0.04] hover:text-white"
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
                  goal={goal}
                  totalTodos={total}
                  doneTodos={done}
                  pct={pct}
                  isToggling={togglingId === goal.id}
                  skillAdded={skillAddedGoalIds.has(goal.id)}
                  onToggle={() => toggleGoal(goal)}
                  onAddSkill={() => addSkillToProfile(goal)}
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
  goal,
  totalTodos,
  doneTodos,
  pct,
  isToggling,
  skillAdded,
  onToggle,
  onAddSkill,
}: {
  goal: Goal;
  totalTodos: number;
  doneTodos: number;
  pct: number;
  isToggling: boolean;
  skillAdded: boolean;
  onToggle: () => void;
  onAddSkill: () => void;
}) {
  const category = inferGoalCategory(goal.title);
  const CategoryIcon = categoryConfig[category].icon;
  const status = getGoalStatus(goal);
  const statusDetails = statusConfig[status];
  const progressColor =
    pct === 100
      ? "[&_[data-slot=progress-indicator]]:bg-emerald-400"
      : "[&_[data-slot=progress-indicator]]:bg-[#7C74DB]";

  // Show the "Add to Profile" button only when:
  //   - the goal has a target_skill
  //   - the skill hasn't been added this session already
  //   - the goal is completed OR all linked tasks are done (pct === 100 and totalTodos > 0)
  const showAddSkillButton =
    !!goal.target_skill &&
    !skillAdded &&
    (goal.completed || (totalTodos > 0 && pct === 100));

  // If the goal is completed, it usually gets opacity-60.
  // Keep opacity-100 (prominent) if there is a pending skill that hasn't been added yet.
  const isCompletedPendingSkill = goal.completed && !!goal.target_skill && !skillAdded;
  const cardClassName =
    status === "completed" && isCompletedPendingSkill
      ? "bg-white/[0.01] border-white/[0.03] opacity-100"
      : statusDetails.cardClassName;

  return (
    <div
      className={`rounded-xl border p-3.5 transition-all duration-200 hover:border-white/[0.10] ${cardClassName}`}
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
            <Circle className="h-4 w-4 text-white/20 hover:text-[#7C74DB]" />
          )}
        </button>

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
            <Badge
              variant="outline"
              className={categoryConfig[category].className}
            >
              <CategoryIcon className="h-3 w-3" />
              {category}
            </Badge>

            {/* Target skill badge */}
            {goal.target_skill && (
              <Badge
                variant="outline"
                className="border-violet-400/20 bg-violet-400/10 text-violet-300 gap-1"
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

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-white/25">Linked task progress</span>
              <span className="text-[10px] font-semibold text-white/45">
                {pct}%
              </span>
            </div>
            <Progress
              value={pct}
              className={`gap-1 [&_[data-slot=progress-track]]:bg-white/[0.06] ${progressColor}`}
            />
            {totalTodos === 0 && (
              <div className="flex items-center gap-1 text-[10px] text-white/25">
                <BookOpen className="h-2.5 w-2.5" />
                Add tasks to start moving this goal.
              </div>
            )}
          </div>

          {/* Add skill to profile CTA — only shown when all tasks done */}
          {showAddSkillButton && (
            <button
              id={`add-skill-btn-${goal.id}`}
              type="button"
              onClick={onAddSkill}
              className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg border border-violet-400/20 bg-violet-400/10 px-3 py-1.5 text-xs font-semibold text-violet-300 transition-all hover:bg-violet-400/20 hover:border-violet-400/40"
            >
              <Sparkles className="h-3 w-3" />
              Add {goal.target_skill} to Profile
            </button>
          )}

          {/* Already added indicator */}
          {skillAdded && goal.target_skill && (
            <div className="mt-1 flex items-center gap-1.5 text-[10px] text-emerald-400">
              <CheckCircle2 className="h-3 w-3" />
              {goal.target_skill} added to your profile skills.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
