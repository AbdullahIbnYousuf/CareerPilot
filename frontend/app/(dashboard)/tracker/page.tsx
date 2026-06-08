"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { KanbanBoard } from "@/components/kanban-board";
import { ProgressDashboard } from "@/components/progress-dashboard";
import { CalendarView } from "@/components/calendar-view";
import { TodoList } from "@/components/todo-list";
import { GoalsSection } from "@/components/goals-section";
import { NudgeBanner } from "@/components/nudge-banner";
import { TodayView } from "@/components/today-view";
import { supabase } from "@/lib/supabase";
import type { Nudge, Goal, Todo } from "@/types";
import { takeGoalsTasksDraft, type CopilotGoalsTasksDraft } from "@/lib/copilot/drafts";
import {
  LayoutGrid,
  BarChart3,
  Calendar,
  ListTodo,
  Compass,
  SunMedium,
} from "lucide-react";

type View = "today" | "applications" | "progress" | "calendar" | "goals_tasks";

const QUERY_VIEW_VALUES: View[] = [
  "today",
  "applications",
  "goals_tasks",
  "calendar",
  "progress",
];

function isJourneyView(value: string | null): value is View {
  return Boolean(value && QUERY_VIEW_VALUES.includes(value as View));
}

function guideStepForView(value: View) {
  return value;
}

interface TodoRow {
  id: string;
  user_id: string;
  goal_id: string | null;
  title: string;
  due_date: string | null;
  completed: boolean | null;
  completed_at?: string | null;
}

function normalizeTodo(row: TodoRow): Todo {
  return {
    id: row.id,
    user_id: row.user_id,
    goal_id: row.goal_id ?? undefined,
    title: row.title,
    due_date: row.due_date ?? undefined,
    completed: Boolean(row.completed),
    completed_at: row.completed_at ?? null,
  };
}

function isMissingCompletedAtError(errorMessage: string): boolean {
  const normalized = errorMessage.toLowerCase();
  return (
    normalized.includes("completed_at") &&
    (normalized.includes("schema cache") ||
      normalized.includes("pgrst204") ||
      normalized.includes("does not exist"))
  );
}

function replaceTodosPreservingVisible(incomingTodos: Todo[]) {
  return (currentTodos: Todo[]) => {
    if (incomingTodos.length === 0 && currentTodos.length > 0) {
      return currentTodos;
    }
    return incomingTodos;
  };
}

function JourneyPageContent() {
  const searchParams = useSearchParams();
  const [view, setView] = useState<View>("today");
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  // ── Lifted goals + todos (shared between GoalsSection and TodoList) ────────
  const [goals, setGoals] = useState<Goal[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [dataLoadError, setDataLoadError] = useState<string | null>(null);
  const [copilotDraft, setCopilotDraft] = useState<CopilotGoalsTasksDraft | null>(null);
  // Incrementing this key re-triggers the data-fetch effect after mutations.
  const [refreshKey, setRefreshKey] = useState(0);

  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const routeView = searchParams.get("view");
  const shouldLoadDraft = searchParams.get("draft") === "1";

  useEffect(() => {
    if (isJourneyView(routeView)) {
      const timeoutId = window.setTimeout(() => setView(routeView), 0);
      return () => window.clearTimeout(timeoutId);
    }
  }, [routeView]);

  // When ?draft=1 is present, switch to goals_tasks AND consume the draft.
  // We intentionally depend only on shouldLoadDraft so this fires even when
  // the user is already on the goals_tasks view (routeView wouldn't change).
  useEffect(() => {
    if (!shouldLoadDraft) return;
    const timeoutId = window.setTimeout(() => {
      setView("goals_tasks");
      const draft = takeGoalsTasksDraft();
      if (draft) setCopilotDraft(draft);
    }, 50);
    return () => window.clearTimeout(timeoutId);
  }, [shouldLoadDraft]);

  useEffect(() => {
    if (!userId) return;
    void fetch(`${baseUrl}/copilot/state?user_id=${encodeURIComponent(userId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mark_step_complete: guideStepForView(view),
        feature_exposure: { feature: `tracker:${view}` },
      }),
    }).catch(() => undefined);
  }, [baseUrl, userId, view]);

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const loadUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data.user) setUserId(data.user.id);
    };
    void loadUser();
  }, []);

  // ── Fetch goals + todos ───────────────────────────────────────────────────
  // Defined as a local async function inside the effect so the linter does not
  // flag it under react-hooks/set-state-in-effect (the rule only traces
  // setState calls that appear in the effect body or in resolved useCallbacks).
  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      const encodedUserId = encodeURIComponent(userId);
      setDataLoadError(null);

      try {
        const goalsRes = await fetch(`${baseUrl}/tracker/goals?user_id=${encodedUserId}`);
        if (goalsRes.ok) {
          const d = await goalsRes.json();
          setGoals(d.goals ?? []);
        } else {
          setDataLoadError("Goals could not be loaded.");
        }
      } catch {
        setDataLoadError("Goals could not be loaded.");
      }

      try {
        const todosRes = await fetch(`${baseUrl}/tracker/todos?user_id=${encodedUserId}`);
        if (todosRes.ok) {
          const d = await todosRes.json();
          const apiTodos = (d.todos ?? []) as Todo[];
          if (apiTodos.length > 0) {
            setTodos(apiTodos);
            return;
          }
        }
      } catch {
        /* fall back to Supabase below */
      }

      try {
        const primary = await supabase
          .from("todos")
          .select("id, user_id, goal_id, title, due_date, completed, completed_at")
          .eq("user_id", userId)
          .order("due_date", { ascending: true });

        if (!primary.error) {
          const directTodos = ((primary.data ?? []) as TodoRow[]).map(normalizeTodo);
          setTodos(replaceTodosPreservingVisible(directTodos));
          return;
        }

        if (isMissingCompletedAtError(primary.error.message)) {
          const fallback = await supabase
            .from("todos")
            .select("id, user_id, goal_id, title, due_date, completed")
            .eq("user_id", userId)
            .order("due_date", { ascending: true });

          if (!fallback.error) {
            const directTodos = ((fallback.data ?? []) as TodoRow[]).map(normalizeTodo);
            setTodos(replaceTodosPreservingVisible(directTodos));
            return;
          }
        }

        setDataLoadError("Tasks could not be loaded.");
      } catch {
        setDataLoadError("Tasks could not be loaded.");
      }
    };
    void load();
  }, [userId, baseUrl, refreshKey]);

  /** Passed to GoalsSection + TodoList so mutations trigger a shared re-fetch. */
  const handleDataRefresh = useCallback(
    () => setRefreshKey((k) => k + 1),
    []
  );

  const handleGoalCreated = useCallback((goal: Goal) => {
    setDataLoadError(null);
    // Clear the copilot draft once the goal has been saved
    setCopilotDraft(null);
    setGoals((currentGoals) => {
      if (currentGoals.some((currentGoal) => currentGoal.id === goal.id)) {
        return currentGoals;
      }
      return [goal, ...currentGoals];
    });
  }, []);

  /** Called by GoalsSection / TodoList once the draft has been applied to the form. */
  const handleDraftConsumed = useCallback(() => {
    setCopilotDraft(null);
  }, []);

  const handleTodoCreated = useCallback((todo: Todo) => {
    setDataLoadError(null);
    setTodos((currentTodos) => {
      if (currentTodos.some((currentTodo) => currentTodo.id === todo.id)) {
        return currentTodos;
      }
      return [todo, ...currentTodos];
    });
  }, []);

  const handleTodosCreated = useCallback((createdTodos: Todo[]) => {
    if (createdTodos.length === 0) return;

    setDataLoadError(null);
    setTodos((currentTodos) => {
      const existingIds = new Set(currentTodos.map((todo) => todo.id));
      const nextTodos = createdTodos.filter((todo) => !existingIds.has(todo.id));
      return nextTodos.length === 0 ? currentTodos : [...nextTodos, ...currentTodos];
    });
  }, []);

  // ── Nudges + Realtime ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;

    // Initial fetch — setState lives inside the async callback, not directly
    // in the effect body, satisfying react-hooks/set-state-in-effect.
    const fetchInitialNudges = async () => {
      try {
        const res = await fetch(`${baseUrl}/dashboard/${userId}/nudges`);
        if (res.ok) {
          const data = await res.json();
          let currentNudges = data.nudges || [];
          if (currentNudges.length === 0) {
            const genRes = await fetch(`${baseUrl}/dashboard/${userId}/nudges/generate`, {
              method: "POST",
            });
            if (genRes.ok) {
              const res2 = await fetch(`${baseUrl}/dashboard/${userId}/nudges`);
              if (res2.ok) {
                const data2 = await res2.json();
                currentNudges = data2.nudges || [];
              }
            }
          }
          setNudges(currentNudges);
        }
      } catch {
        /* silently fail */
      }
    };
    void fetchInitialNudges();

    const channel = supabase
      .channel("journey-nudges")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "nudges",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setNudges((prev) => [payload.new as Nudge, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, baseUrl]);

  const dismissNudge = async (nudgeId: string) => {
    try {
      await fetch(`${baseUrl}/dashboard/nudges/${nudgeId}/seen`, {
        method: "PATCH",
      });
    } catch {
      /* silently fail */
    }
    setNudges((prev) => prev.filter((n) => n.id !== nudgeId));
  };

  const tabs: { key: View; label: string; icon: React.ElementType }[] = [
    { key: "today",       label: "Today",        icon: SunMedium },
    { key: "applications",label: "Applications", icon: LayoutGrid },
    { key: "goals_tasks", label: "Goals & Tasks", icon: ListTodo },
    { key: "calendar",    label: "Calendar",     icon: Calendar },
    { key: "progress",    label: "Progress",     icon: BarChart3 },
  ];

  return (
    <div className="space-y-6">
      {/* AI Nudge banners */}
      {nudges.map((nudge) => (
        <NudgeBanner
          key={nudge.id}
          message={nudge.message}
          jobs={nudge.jobs}
          onDismiss={() => dismissNudge(nudge.id)}
        />
      ))}

      <div className="flex min-w-0 flex-col md:flex-row md:items-end md:justify-between gap-6 border-b border-[var(--cp-border-soft)] pb-5">
        {/* Page header */}
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-6 w-6 rounded-md border border-[var(--cp-border-medium)] bg-[rgba(201,130,74,0.14)] flex items-center justify-center">
              <Compass className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="text-xs font-semibold text-[var(--cp-copper-strong)] uppercase tracking-widest">
              Productivity
            </span>
          </div>
          <h1 className="font-display text-4xl font-semibold tracking-normal text-[var(--cp-text-main)]">
            My Journey
          </h1>
          <p className="text-[var(--cp-text-muted)] text-sm mt-1">
            Manage your job applications, goals, and track your daily progress.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex max-w-full overflow-x-auto p-1 gap-1 rounded-xl border border-[var(--cp-border-soft)] bg-[var(--cp-bg-deep)]/70 shadow-md self-start md:self-auto">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              id={`journey-tab-${key}`}
              onClick={() => setView(key)}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-2 text-xs font-semibold rounded-lg transition-all duration-200 ${
                view === key
                  ? "cp-active-glow bg-[rgba(201,130,74,0.14)] text-[var(--cp-champagne)] shadow-sm"
                  : "text-[var(--cp-text-muted)] hover:text-[var(--cp-text-soft)] hover:bg-white/[0.02]"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="pt-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
        {view === "today" && userId && (
          <TodayView
            userId={userId}
            goals={goals}
            todos={todos}
            nudges={nudges}
            onRefresh={handleDataRefresh}
            onOpenApplications={() => setView("applications")}
            onOpenCalendar={() => setView("calendar")}
            onOpenProgress={() => setView("progress")}
            onOpenTasks={() => setView("goals_tasks")}
          />
        )}
        {view === "applications" && (
          <KanbanBoard
            onTodosCreated={handleTodosCreated}
            onTodosChange={handleDataRefresh}
          />
        )}
        {view === "progress"     && <ProgressDashboard />}
        {view === "calendar"     && <CalendarView />}

        {/* Goals & Tasks — GoalsSection above TodoList, single shared data source */}
        {view === "goals_tasks" && userId && (
          <div className="space-y-4">
            {dataLoadError && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {dataLoadError}
              </div>
            )}
            <GoalsSection
              userId={userId}
              goals={goals}
              todos={todos}
              draft={copilotDraft}
              onGoalsChange={handleDataRefresh}
              onGoalCreated={handleGoalCreated}
              onTodosChange={handleDataRefresh}
              onTodoCreated={handleTodoCreated}
              onDraftConsumed={handleDraftConsumed}
            />
            <TodoList
              userId={userId}
              todos={todos}
              draft={copilotDraft}
              onTodosChange={handleDataRefresh}
              onTodoCreated={handleTodoCreated}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function JourneyPage() {
  return (
    <Suspense fallback={<div className="text-sm text-white/40">Loading My Journey...</div>}>
      <JourneyPageContent />
    </Suspense>
  );
}
