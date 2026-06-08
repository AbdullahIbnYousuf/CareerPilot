"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Goal, Nudge, Snapshot, StatusCounts, Todo } from "@/types";
import {
  AlertCircle,
  ArrowRight,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  Circle,
  Flame,
  ListPlus,
  ListTodo,
  MessageCircle,
  Plus,
  Search,
  Sparkles,
  Target,
} from "lucide-react";

interface TodayViewProps {
  userId: string;
  goals: Goal[];
  todos: Todo[];
  nudges: Nudge[];
  onRefresh: () => void;
  onOpenApplications?: () => void;
  onOpenCalendar?: () => void;
  onOpenProgress?: () => void;
  onOpenTasks?: () => void;
}

interface DashboardSummary {
  snapshot: Snapshot;
  status_counts: StatusCounts;
  new_matches: number;
}

type NextAction =
  | {
      kind: "todo";
      title: string;
      description: string;
      buttonLabel: string;
      todo: Todo;
      urgent: boolean;
    }
  | {
      kind: "nudge";
      title: string;
      description: string;
      buttonLabel: string;
      nudge: Nudge;
    }
  | {
      kind: "applications";
      title: string;
      description: string;
      buttonLabel: string;
    }
  | {
      kind: "goal";
      title: string;
      description: string;
      buttonLabel: string;
      goal: Goal;
    }
  | {
      kind: "default";
      title: string;
      description: string;
      buttonLabel: string;
    };

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseDateKey(dateKey?: string): Date | null {
  if (!dateKey) return null;
  return new Date(`${dateKey}T12:00:00`);
}

function formatShortDate(dateKey?: string): string {
  const parsed = parseDateKey(dateKey);
  if (!parsed) return "No date";
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatRelativeDate(dateKey?: string): string {
  if (!dateKey) return "No date";
  const todayKey = toDateKey(new Date());
  if (dateKey === todayKey) return "Today";
  if (dateKey < todayKey) return "Overdue";
  return formatShortDate(dateKey);
}

export function TodayView({
  userId,
  goals,
  todos,
  nudges,
  onRefresh,
  onOpenApplications,
  onOpenCalendar,
  onOpenProgress,
  onOpenTasks,
}: TodayViewProps) {
  const router = useRouter();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [completingTodoId, setCompletingTodoId] = useState<string | null>(null);
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  useEffect(() => {
    const loadSummary = async () => {
      try {
        const res = await fetch(`${baseUrl}/dashboard/${userId}`);
        if (res.ok) {
          const data = (await res.json()) as DashboardSummary;
          setSummary(data);
        }
      } catch {
        /* silently fail */
      }
    };
    void loadSummary();
  }, [baseUrl, userId]);

  const todayKey = useMemo(() => toDateKey(new Date()), []);
  const goalMap = useMemo(
    () => Object.fromEntries(goals.map((goal) => [goal.id, goal.title])),
    [goals]
  );

  const activeGoals = useMemo(
    () => goals.filter((goal) => !goal.completed),
    [goals]
  );

  const incompleteTodos = useMemo(
    () => todos.filter((todo) => !todo.completed),
    [todos]
  );

  const overdueTodos = useMemo(
    () =>
      incompleteTodos
        .filter((todo) => todo.due_date && todo.due_date < todayKey)
        .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? "")),
    [incompleteTodos, todayKey]
  );

  const dueTodayTodos = useMemo(
    () =>
      incompleteTodos
        .filter((todo) => todo.due_date === todayKey)
        .sort((a, b) => a.title.localeCompare(b.title)),
    [incompleteTodos, todayKey]
  );

  const urgentTodos = useMemo(
    () => [...overdueTodos, ...dueTodayTodos].slice(0, 5),
    [overdueTodos, dueTodayTodos]
  );

  const emptyActiveGoal = useMemo(
    () =>
      activeGoals.find(
        (goal) =>
          todos.filter((todo) => todo.goal_id === goal.id && !todo.completed)
            .length === 0
      ),
    [activeGoals, todos]
  );

  const nextAction: NextAction = useMemo(() => {
    if (overdueTodos.length > 0) {
      return {
        kind: "todo",
        title: overdueTodos[0].title,
        description: "Oldest overdue task waiting for attention.",
        buttonLabel: "Mark done",
        todo: overdueTodos[0],
        urgent: true,
      };
    }

    if (dueTodayTodos.length > 0) {
      return {
        kind: "todo",
        title: dueTodayTodos[0].title,
        description: "Due today. Finish this to keep momentum.",
        buttonLabel: "Mark done",
        todo: dueTodayTodos[0],
        urgent: false,
      };
    }

    const unseenNudge = nudges.find((nudge) => !nudge.seen) ?? nudges[0];
    if (unseenNudge) {
      return {
        kind: "nudge",
        title: "CareerPilot guide",
        description: unseenNudge.message,
        buttonLabel: "View details",
        nudge: unseenNudge,
      };
    }

    if ((summary?.snapshot.applications_sent ?? 0) === 0) {
      return {
        kind: "applications",
        title: "Apply to a saved high-fit job",
        description: "No applications sent this week yet.",
        buttonLabel: "Open applications",
      };
    }

    if (emptyActiveGoal) {
      return {
        kind: "goal",
        title: emptyActiveGoal.title,
        description: "This active goal needs at least one linked next task.",
        buttonLabel: "Add task",
        goal: emptyActiveGoal,
      };
    }

    return {
      kind: "default",
      title: "Review saved jobs",
      description: "Choose one promising role and move it forward.",
      buttonLabel: "Find jobs",
    };
  }, [dueTodayTodos, emptyActiveGoal, nudges, overdueTodos, summary]);

  const upcomingDeadlines = useMemo(() => {
    const todoDeadlines = todos
      .filter((todo) => !todo.completed && todo.due_date && todo.due_date >= todayKey)
      .map((todo) => ({
        id: `todo-${todo.id}`,
        title: todo.title,
        date: todo.due_date ?? "",
        type: "Task",
        meta: todo.goal_id ? goalMap[todo.goal_id] : undefined,
      }));

    const goalDeadlines = activeGoals
      .filter((goal) => goal.target_date && goal.target_date >= todayKey)
      .map((goal) => ({
        id: `goal-${goal.id}`,
        title: goal.title,
        date: goal.target_date ?? "",
        type: "Goal",
        meta: undefined,
      }));

    return [...todoDeadlines, ...goalDeadlines]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5);
  }, [activeGoals, goalMap, todayKey, todos]);

  const isStarterState =
    goals.length === 0 && todos.length === 0 && nudges.length === 0;

  const markTodoDone = async (todo: Todo) => {
    setCompletingTodoId(todo.id);
    try {
      const res = await fetch(`${baseUrl}/tracker/todos/${todo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: true }),
      });
      if (res.ok) onRefresh();
    } catch {
      /* silently fail */
    } finally {
      setCompletingTodoId(null);
    }
  };

  const runPrimaryAction = () => {
    if (nextAction.kind === "todo") {
      void markTodoDone(nextAction.todo);
      return;
    }
    if (nextAction.kind === "nudge") {
      onOpenProgress?.();
      return;
    }
    if (nextAction.kind === "applications") {
      onOpenApplications?.();
      return;
    }
    if (nextAction.kind === "goal") {
      onOpenTasks?.();
      return;
    }
    router.push("/jobs");
  };

  if (isStarterState) {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_0.8fr] gap-5">
        <Card className="cp-map-lines cp-surface-elevated rounded-2xl">
          <CardContent className="flex flex-col items-start gap-5 p-6 sm:p-8">
            <div className="h-10 w-10 rounded-xl bg-[rgba(201,130,74,0.14)] border border-[var(--cp-border-medium)] flex items-center justify-center">
              <Target className="h-5 w-5 text-[var(--cp-champagne)]" />
            </div>
            <div className="space-y-2 max-w-2xl">
              <h2 className="font-display text-3xl font-semibold tracking-normal text-[var(--cp-text-main)]">
                Start with one career goal.
              </h2>
              <p className="text-sm leading-6 text-[var(--cp-text-muted)]">
                Add a weekly target, then break it into tasks so Today can show
                the next useful action each time you return.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={onOpenTasks}
              >
                <Plus className="h-4 w-4" />
                Create goal
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push("/jobs")}
              >
                <Search className="h-4 w-4" />
                Find jobs
              </Button>
            </div>
          </CardContent>
        </Card>

        <QuickActions
          onFindJobs={() => router.push("/jobs")}
          onAddTask={onOpenTasks}
          onCreateGoal={onOpenTasks}
          onOpenCalendar={onOpenCalendar}
          onAskAssistant={() => router.push("/chat")}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-5">
        <NextBestActionCard
          action={nextAction}
          completingTodoId={completingTodoId}
          onPrimaryAction={runPrimaryAction}
        />

        <WeeklyProgressStrip
          applicationsThisWeek={summary?.snapshot.applications_sent ?? 0}
          activeGoals={activeGoals.length}
          streakDays={summary?.snapshot.streak_days ?? 0}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr] gap-5">
        <DueTasksCard
          todos={urgentTodos}
          goalMap={goalMap}
          completingTodoId={completingTodoId}
          onComplete={markTodoDone}
          onOpenTasks={onOpenTasks}
        />

        <ActiveGoalsCard
          goals={activeGoals.slice(0, 3)}
          todos={todos}
          onCreateGoal={onOpenTasks}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_0.85fr] gap-5">
        <UpcomingDeadlinesCard
          deadlines={upcomingDeadlines}
          onOpenCalendar={onOpenCalendar}
        />

        <QuickActions
          onFindJobs={() => router.push("/jobs")}
          onAddTask={onOpenTasks}
          onCreateGoal={onOpenTasks}
          onOpenCalendar={onOpenCalendar}
          onAskAssistant={() => router.push("/chat")}
        />
      </div>
    </div>
  );
}

function NextBestActionCard({
  action,
  completingTodoId,
  onPrimaryAction,
}: {
  action: NextAction;
  completingTodoId: string | null;
  onPrimaryAction: () => void;
}) {
  const isTodo = action.kind === "todo";
  const isBusy = isTodo && completingTodoId === action.todo.id;

  return (
    <Card
      className={`cp-map-lines cp-surface-elevated rounded-2xl ${
        isTodo && action.urgent
          ? "border-red-400/20"
          : "border-[var(--cp-border-medium)]"
      }`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-xs font-bold flex items-center gap-2 text-[var(--cp-copper-strong)] uppercase tracking-widest">
            <Sparkles className="h-4 w-4 text-[var(--cp-champagne)]" />
            Next discovery
          </CardTitle>
          {isTodo && action.urgent && (
            <Badge className="bg-red-500/10 border-red-500/20 text-red-300">
              Overdue
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <h2 className="font-display text-3xl font-semibold tracking-normal text-[var(--cp-text-main)]">
            {action.title}
          </h2>
          <p className="text-sm leading-6 text-[var(--cp-text-muted)]">
            {action.description}
          </p>
        </div>
        <Button
          onClick={onPrimaryAction}
          disabled={isBusy}
        >
          {isTodo ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <ArrowRight className="h-4 w-4" />
          )}
          {isBusy ? "Updating..." : action.buttonLabel}
        </Button>
      </CardContent>
    </Card>
  );
}

function DueTasksCard({
  todos,
  goalMap,
  completingTodoId,
  onComplete,
  onOpenTasks,
}: {
  todos: Todo[];
  goalMap: Record<string, string>;
  completingTodoId: string | null;
  onComplete: (todo: Todo) => void;
  onOpenTasks?: () => void;
}) {
  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base font-bold flex items-center gap-2 text-[var(--cp-text-main)]">
            <ListTodo className="h-4 w-4 text-[var(--cp-copper-strong)]" />
            Due today and overdue
          </CardTitle>
          <Button
            size="sm"
            variant="ghost"
            onClick={onOpenTasks}
          >
            Open tasks
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {todos.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <CheckCircle2 className="h-8 w-8 text-[var(--cp-fit-high)]/35" />
            <p className="text-sm font-semibold text-[var(--cp-text-soft)]">
              All clear for today.
            </p>
            <p className="text-xs text-[var(--cp-text-muted)]">
              Nothing urgent due today.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {todos.map((todo) => {
              const dueDate = todo.due_date;
              const isOverdue = dueDate ? dueDate < toDateKey(new Date()) : false;
              const isBusy = completingTodoId === todo.id;
              return (
                <div
                  key={todo.id}
                  className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                    isOverdue
                      ? "bg-red-500/5 border-red-500/15"
                      : "bg-amber-400/5 border-amber-400/15"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onComplete(todo)}
                    disabled={isBusy}
                    className="mt-0.5 shrink-0 text-white/25 hover:text-emerald-300 disabled:opacity-50"
                    aria-label={`Mark ${todo.title} complete`}
                  >
                    {isBusy ? (
                      <CheckCircle2 className="h-4 w-4 animate-pulse" />
                    ) : (
                      <Circle className="h-4 w-4" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-snug text-white/85">
                      {todo.title}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span
                        className={`text-[10px] font-semibold ${
                          isOverdue ? "text-red-300" : "text-amber-300"
                        }`}
                      >
                        {formatRelativeDate(dueDate)}
                      </span>
                      {todo.goal_id && goalMap[todo.goal_id] && (
                        <span className="rounded-md border border-[var(--cp-border-medium)] bg-[rgba(201,130,74,0.10)] px-1.5 py-0.5 text-[10px] text-[var(--cp-champagne)]">
                          {goalMap[todo.goal_id]}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function WeeklyProgressStrip({
  applicationsThisWeek,
  activeGoals,
  streakDays,
}: {
  applicationsThisWeek: number;
  activeGoals: number;
  streakDays: number;
}) {
  const metrics = [
    {
      label: "Applications",
      value: applicationsThisWeek,
      helper: "this week",
      icon: Briefcase,
      color: "text-[var(--cp-copper-strong)]",
      bg: "bg-[rgba(201,130,74,0.12)]",
    },
    {
      label: "Active goals",
      value: activeGoals,
      helper: "in progress",
      icon: Target,
      color: "text-[var(--cp-champagne)]",
      bg: "bg-[rgba(242,214,162,0.10)]",
    },
    {
      label: "Streak",
      value: streakDays,
      helper: streakDays === 1 ? "day" : "days",
      icon: Flame,
      color: "text-orange-300",
      bg: "bg-orange-400/10",
    },
  ] as const;

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold flex items-center gap-2 text-[var(--cp-text-main)]">
          <AlertCircle className="h-4 w-4 text-[var(--cp-fit-high)]" />
          Weekly progress
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2">
          {metrics.map(({ label, value, helper, icon: Icon, color, bg }) => (
            <div
              key={label}
              className="rounded-xl border border-[var(--cp-border-soft)] bg-[var(--cp-surface-elevated)] p-3 shadow-inner shadow-black/20"
            >
              <div
                className={`mb-2 flex h-7 w-7 items-center justify-center rounded-lg ${bg}`}
              >
                <Icon className={`h-3.5 w-3.5 ${color}`} />
              </div>
              <div className="text-2xl font-bold tracking-tight text-[var(--cp-text-main)]">
                {value}
              </div>
              <div className="mt-0.5 text-[10px] font-medium text-[var(--cp-text-muted)]">
                {label}
              </div>
              <div className="text-[10px] text-[var(--cp-text-subtle)]">{helper}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ActiveGoalsCard({
  goals,
  todos,
  onCreateGoal,
}: {
  goals: Goal[];
  todos: Todo[];
  onCreateGoal?: () => void;
}) {
  const getProgress = (goalId: string) => {
    const linked = todos.filter((todo) => todo.goal_id === goalId);
    const done = linked.filter((todo) => todo.completed).length;
    const pct =
      linked.length === 0 ? 0 : Math.round((done / linked.length) * 100);
    return { total: linked.length, done, pct };
  };

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base font-bold flex items-center gap-2 text-[var(--cp-text-main)]">
            <Target className="h-4 w-4 text-[var(--cp-copper-strong)]" />
            Active goals
          </CardTitle>
          <Button
            size="sm"
            variant="ghost"
            onClick={onCreateGoal}
          >
            Create goal
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {goals.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <Target className="h-8 w-8 text-[var(--cp-text-subtle)]" />
            <p className="text-sm text-[var(--cp-text-muted)]">No active goals yet.</p>
            <Button
              size="sm"
              onClick={onCreateGoal}
            >
              <Plus className="h-3.5 w-3.5" />
              Create goal
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {goals.map((goal) => {
              const { total, done, pct } = getProgress(goal.id);
              return (
                <div
                  key={goal.id}
                  className="rounded-xl border border-[var(--cp-border-soft)] bg-[var(--cp-surface-elevated)] p-3.5 shadow-inner shadow-black/20"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-snug text-[var(--cp-text-main)]">
                        {goal.title}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-[var(--cp-text-muted)]">
                        {goal.target_date && (
                          <span>{formatShortDate(goal.target_date)}</span>
                        )}
                        <span>
                          {done}/{total} tasks
                        </span>
                      </div>
                    </div>
                    <span className="shrink-0 text-xs font-bold text-[var(--cp-champagne)]">
                      {pct}%
                    </span>
                  </div>
                  <Progress className="mt-3" value={pct} />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function UpcomingDeadlinesCard({
  deadlines,
  onOpenCalendar,
}: {
  deadlines: {
    id: string;
    title: string;
    date: string;
    type: string;
    meta?: string;
  }[];
  onOpenCalendar?: () => void;
}) {
  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base font-bold flex items-center gap-2 text-[var(--cp-text-main)]">
            <CalendarDays className="h-4 w-4 text-[var(--cp-copper-strong)]" />
            Upcoming deadlines
          </CardTitle>
          <Button
            size="sm"
            variant="ghost"
            onClick={onOpenCalendar}
          >
            Open calendar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {deadlines.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <CalendarDays className="h-8 w-8 text-[var(--cp-text-subtle)]" />
            <p className="text-sm text-[var(--cp-text-muted)]">
              No upcoming task or goal dates.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {deadlines.map((deadline) => (
              <div
                key={deadline.id}
                className="flex items-start gap-3 rounded-xl border border-[var(--cp-border-soft)] bg-[var(--cp-surface-elevated)] p-3 shadow-inner shadow-black/20"
              >
                <div className="flex h-10 w-12 shrink-0 flex-col items-center justify-center rounded-lg border border-[var(--cp-border-soft)] bg-white/[0.03]">
                  <span className="text-[10px] font-semibold uppercase text-[var(--cp-text-muted)]">
                    {formatShortDate(deadline.date).split(" ")[0]}
                  </span>
                  <span className="text-sm font-bold leading-none text-[var(--cp-text-main)]">
                    {formatShortDate(deadline.date).split(" ")[1]}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-snug text-[var(--cp-text-main)]">
                    {deadline.title}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className="h-5 border-white/[0.07] text-white/40"
                    >
                      {deadline.type}
                    </Badge>
                    {deadline.meta && (
                      <span className="text-[10px] text-white/25">
                        {deadline.meta}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function QuickActions({
  onFindJobs,
  onAddTask,
  onCreateGoal,
  onOpenCalendar,
  onAskAssistant,
}: {
  onFindJobs: () => void;
  onAddTask?: () => void;
  onCreateGoal?: () => void;
  onOpenCalendar?: () => void;
  onAskAssistant: () => void;
}) {
  const actions = [
    { label: "Find jobs", icon: Search, onClick: onFindJobs },
    { label: "Add task", icon: ListPlus, onClick: onAddTask },
    { label: "Create goal", icon: Target, onClick: onCreateGoal },
    { label: "Open calendar", icon: CalendarDays, onClick: onOpenCalendar },
    { label: "Ask assistant", icon: MessageCircle, onClick: onAskAssistant },
  ] as const;

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold flex items-center gap-2 text-[var(--cp-text-main)]">
          <Plus className="h-4 w-4 text-[var(--cp-copper-strong)]" />
          Quick actions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {actions.map(({ label, icon: Icon, onClick }) => (
            <Button
              key={label}
              variant="outline"
              onClick={onClick}
              className="justify-start"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
