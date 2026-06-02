"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Goal, Todo } from "@/types";
import {
  Target,
  Plus,
  CheckCircle2,
  Circle,
  Calendar,
  Loader2,
  TrendingUp,
} from "lucide-react";

// ─── Props ────────────────────────────────────────────────────────────────────

interface GoalsSectionProps {
  userId: string;
  goals: Goal[];
  todos: Todo[];
  onGoalsChange: () => void;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function GoalsSection({
  userId,
  goals,
  todos,
  onGoalsChange,
}: GoalsSectionProps) {
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newTargetDate, setNewTargetDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [inlineMsg, setInlineMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  // ── Inline feedback ────────────────────────────────────────────────────────
  const flash = (type: "success" | "error", text: string) => {
    setInlineMsg({ type, text });
    setTimeout(() => setInlineMsg(null), 3000);
  };

  // ── Create goal ────────────────────────────────────────────────────────────
  const createGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${baseUrl}/tracker/goals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          title: newTitle.trim(),
          target_date: newTargetDate || null,
        }),
      });
      if (res.ok) {
        setNewTitle("");
        setNewTargetDate("");
        setShowForm(false);
        flash("success", "Goal created!");
        onGoalsChange();
      } else {
        flash("error", "Failed to create goal.");
      }
    } catch {
      flash("error", "Failed to create goal.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Toggle goal completion ─────────────────────────────────────────────────
  const toggleGoal = async (goal: Goal) => {
    setTogglingId(goal.id);
    try {
      const res = await fetch(`${baseUrl}/tracker/goals/${goal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !goal.completed }),
      });
      if (res.ok) {
        onGoalsChange();
      }
    } catch {
      /* silently fail */
    } finally {
      setTogglingId(null);
    }
  };

  // ── Derived stats ──────────────────────────────────────────────────────────
  const totalGoals = goals.length;
  const completedGoals = goals.filter((g) => g.completed).length;
  const activeGoals = totalGoals - completedGoals;

  const getProgress = (goalId: string) => {
    const linked = todos.filter((t) => t.goal_id === goalId);
    const done = linked.filter((t) => t.completed).length;
    const pct =
      linked.length === 0 ? 0 : Math.round((done / linked.length) * 100);
    return { total: linked.length, done, pct };
  };

  // Active goals first, then completed
  const sorted = [
    ...goals.filter((g) => !g.completed),
    ...goals.filter((g) => g.completed),
  ];

  return (
    <Card className="w-full bg-[#0E0E12] border border-white/[0.06] rounded-2xl shadow-xl shadow-black/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-bold flex items-center gap-2 text-white">
            <Target className="h-4 w-4 text-[#7C74DB]" />
            Goals
          </CardTitle>
          <button
            id="add-goal-btn"
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-[#534AB7]/20 hover:bg-[#534AB7]/30 text-[#AFA9EC] text-xs font-semibold transition-all duration-200"
          >
            <Plus className="h-3.5 w-3.5" />
            Add goal
          </button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Summary stats */}
        {totalGoals > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { label: "Total", value: totalGoals, color: "text-white" },
                { label: "Active", value: activeGoals, color: "text-[#AFA9EC]" },
                {
                  label: "Completed",
                  value: completedGoals,
                  color: "text-emerald-400",
                },
              ] as const
            ).map(({ label, value, color }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-0.5 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]"
              >
                <span
                  className={`text-xl font-bold tracking-tight ${color}`}
                >
                  {value}
                </span>
                <span className="text-[10px] text-white/40 font-medium">
                  {label}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Inline feedback */}
        {inlineMsg && (
          <div
            className={`text-xs px-3 py-2 rounded-lg border ${
              inlineMsg.type === "success"
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-red-500/10 text-red-400 border-red-500/20"
            }`}
          >
            {inlineMsg.text}
          </div>
        )}

        {/* Creation form */}
        {showForm && (
          <form
            onSubmit={createGoal}
            className="space-y-2.5 p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] animate-in fade-in slide-in-from-top-1 duration-200"
          >
            <input
              id="new-goal-title"
              type="text"
              placeholder="Goal title..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              required
              className="w-full h-9 px-3.5 bg-white/[0.04] border border-white/[0.06] text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 rounded-xl text-sm transition-all"
            />
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/20 pointer-events-none" />
              <input
                id="new-goal-target-date"
                type="date"
                value={newTargetDate}
                onChange={(e) => setNewTargetDate(e.target.value)}
                className="w-full h-9 pl-9 pr-3 bg-white/[0.04] border border-white/[0.06] text-white/70 focus:outline-none focus:border-primary/50 rounded-xl text-xs transition-all [color-scheme:dark]"
              />
            </div>
            <div className="flex gap-2">
              <button
                id="submit-goal-btn"
                type="submit"
                disabled={submitting || !newTitle.trim()}
                className="flex-1 h-9 flex items-center justify-center gap-1.5 rounded-xl bg-[#534AB7] hover:bg-[#6B63CC] disabled:opacity-50 text-white text-xs font-semibold transition-all"
              >
                {submitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "Create"
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="h-9 px-3 rounded-xl bg-white/[0.04] text-white/40 hover:text-white text-xs transition-all"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Goal list */}
        {goals.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <Target className="h-8 w-8 text-white/10" />
            <p className="text-sm text-white/25">
              No goals yet. Add one above!
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {sorted.map((goal) => {
              const { total, done, pct } = getProgress(goal.id);
              return (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  totalTodos={total}
                  doneTodos={done}
                  pct={pct}
                  isToggling={togglingId === goal.id}
                  onToggle={() => toggleGoal(goal)}
                />
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Goal card ─────────────────────────────────────────────────────────────────

function GoalCard({
  goal,
  totalTodos,
  doneTodos,
  pct,
  isToggling,
  onToggle,
}: {
  goal: Goal;
  totalTodos: number;
  doneTodos: number;
  pct: number;
  isToggling: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`p-3.5 rounded-xl border transition-all duration-200 ${
        goal.completed
          ? "bg-white/[0.01] border-white/[0.03] opacity-60"
          : "bg-[#0E0E12] border-white/[0.06] hover:border-white/[0.10] hover:bg-white/[0.01]"
      }`}
    >
      <div className="flex items-start gap-2.5">
        {/* Toggle button */}
        <button
          id={`goal-toggle-${goal.id}`}
          onClick={onToggle}
          disabled={isToggling}
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

        <div className="flex-1 min-w-0 space-y-2">
          {/* Title + status badge */}
          <div className="flex items-start justify-between gap-2">
            <p
              className={`text-sm font-semibold leading-snug ${
                goal.completed
                  ? "line-through text-white/30"
                  : "text-white/90"
              }`}
            >
              {goal.title}
            </p>
            {goal.completed ? (
              <span className="shrink-0 text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-md px-1.5 py-0.5 font-medium">
                Done
              </span>
            ) : (
              <span className="shrink-0 text-[10px] bg-[#534AB7]/10 border border-[#534AB7]/20 text-[#AFA9EC] rounded-md px-1.5 py-0.5 font-medium">
                Active
              </span>
            )}
          </div>

          {/* Meta: target date + task count */}
          <div className="flex items-center gap-3 flex-wrap">
            {goal.target_date && (
              <span className="text-[10px] text-white/30 flex items-center gap-1">
                <Calendar className="h-2.5 w-2.5" />
                {new Date(
                  goal.target_date + "T12:00:00"
                ).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            )}
            {totalTodos > 0 && (
              <span className="text-[10px] text-white/30 flex items-center gap-1">
                <TrendingUp className="h-2.5 w-2.5" />
                {doneTodos}/{totalTodos} tasks
              </span>
            )}
          </div>

          {/* Progress bar (only when linked todos exist) */}
          {totalTodos > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-white/20">Progress</span>
                <span className="text-[10px] font-semibold text-white/40">
                  {pct}%
                </span>
              </div>
              <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    pct === 100
                      ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                      : "bg-gradient-to-r from-[#534AB7] to-[#7C74DB]"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
