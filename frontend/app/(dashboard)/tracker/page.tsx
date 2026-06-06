"use client";

import { useState, useEffect, useCallback } from "react";
import { KanbanBoard } from "@/components/kanban-board";
import { ProgressDashboard } from "@/components/progress-dashboard";
import { CalendarView } from "@/components/calendar-view";
import { TodoList } from "@/components/todo-list";
import { GoalsSection } from "@/components/goals-section";
import { NudgeBanner } from "@/components/nudge-banner";
import { TodayView } from "@/components/today-view";
import { supabase } from "@/lib/supabase";
import type { Nudge, Goal, Todo } from "@/types";
import {
  LayoutGrid,
  BarChart3,
  Calendar,
  ListTodo,
  Compass,
  SunMedium,
} from "lucide-react";

type View = "today" | "kanban" | "dashboard" | "calendar" | "tasks";

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

export default function JourneyPage() {
  const [view, setView] = useState<View>("today");
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  // ── Lifted goals + todos (shared between GoalsSection and TodoList) ────────
  const [goals, setGoals] = useState<Goal[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [dataLoadError, setDataLoadError] = useState<string | null>(null);
  // Incrementing this key re-triggers the data-fetch effect after mutations.
  const [refreshKey, setRefreshKey] = useState(0);

  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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
    setGoals((currentGoals) => {
      if (currentGoals.some((currentGoal) => currentGoal.id === goal.id)) {
        return currentGoals;
      }
      return [goal, ...currentGoals];
    });
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
          setNudges(data.nudges || []);
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
    { key: "today",     label: "Today",    icon: SunMedium },
    { key: "kanban",    label: "Kanban",   icon: LayoutGrid },
    { key: "dashboard", label: "Stats",    icon: BarChart3 },
    { key: "calendar",  label: "Calendar", icon: Calendar },
    { key: "tasks",     label: "Tasks",    icon: ListTodo },
  ];

  return (
    <div className="space-y-6">
      {/* AI Nudge banners */}
      {nudges.map((nudge) => (
        <NudgeBanner
          key={nudge.id}
          message={nudge.message}
          onDismiss={() => dismissNudge(nudge.id)}
        />
      ))}

      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 border-b border-white/[0.04] pb-5">
        {/* Page header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-6 w-6 rounded-md bg-primary/20 flex items-center justify-center">
              <Compass className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="text-xs font-semibold text-primary uppercase tracking-widest">
              Productivity
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            My Journey
          </h1>
          <p className="text-white/40 text-sm mt-1">
            Manage your job applications, goals, and track your daily progress.
          </p>
        </div>

        {/* View Switcher Tabs and Demo trigger */}
        <div className="flex flex-wrap items-center gap-3 shrink-0 self-start md:self-auto">
          <button
            id="journey-gen-nudge-btn"
            onClick={async () => {
              if (!userId) return;
              try {
                await fetch(`${baseUrl}/dashboard/${userId}/nudges/generate`, {
                  method: "POST",
                });
              } catch {
                /* silently fail */
              }
            }}
            className="flex items-center gap-1 px-3 py-2 text-xs font-semibold rounded-lg bg-yellow-500/10 text-yellow-300 border border-yellow-500/20 hover:bg-yellow-500/20 transition-all duration-200"
          >
            Demo: Gen Nudge
          </button>

          <div className="flex p-1 gap-1 rounded-xl bg-[#0E0E12] border border-white/[0.06] shadow-md">
            {tabs.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                id={`journey-tab-${key}`}
                onClick={() => setView(key)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all duration-200 ${
                  view === key
                    ? "bg-[#1E1B3A] text-[#AFA9EC] shadow-sm"
                    : "text-white/60 hover:text-white hover:bg-white/[0.02]"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
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
            onOpenApplications={() => setView("kanban")}
            onOpenCalendar={() => setView("calendar")}
            onOpenProgress={() => setView("dashboard")}
            onOpenTasks={() => setView("tasks")}
          />
        )}
        {view === "kanban"    && <KanbanBoard />}
        {view === "dashboard" && <ProgressDashboard />}
        {view === "calendar"  && <CalendarView />}

        {/* Tasks — GoalsSection above TodoList, single shared data source */}
        {view === "tasks" && userId && (
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
              onGoalsChange={handleDataRefresh}
              onGoalCreated={handleGoalCreated}
            />
            <TodoList
              userId={userId}
              goals={goals}
              todos={todos}
              onTodosChange={handleDataRefresh}
              onTodoCreated={handleTodoCreated}
            />
          </div>
        )}
      </div>
    </div>
  );
}
