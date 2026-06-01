"use client";

import { useState, useEffect, useCallback } from "react";
import { KanbanBoard } from "@/components/kanban-board";
import { ProgressDashboard } from "@/components/progress-dashboard";
import { CalendarView } from "@/components/calendar-view";
import { TodoList } from "@/components/todo-list";
import { NudgeBanner } from "@/components/nudge-banner";
import { supabase } from "@/lib/supabase";
import type { Nudge } from "@/types";
import {
  LayoutGrid,
  BarChart3,
  Calendar,
  ListTodo,
  Compass,
} from "lucide-react";

type View = "kanban" | "dashboard" | "calendar" | "tasks";

export default function JourneyPage() {
  const [view, setView] = useState<View>("kanban");
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const loadUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data.user) setUserId(data.user.id);
    };
    loadUser();
  }, []);

  // ── Fetch + Realtime nudges ───────────────────────────────────────────────
  const fetchNudges = useCallback(async (uid: string) => {
    try {
      const res = await fetch(`${baseUrl}/dashboard/${uid}/nudges`);
      if (res.ok) {
        const data = await res.json();
        setNudges(data.nudges || []);
      }
    } catch { /* silently fail */ }
  }, [baseUrl]);

  useEffect(() => {
    if (!userId) return;
    fetchNudges(userId);

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

    return () => { supabase.removeChannel(channel); };
  }, [userId, fetchNudges]);

  const dismissNudge = async (nudgeId: string) => {
    try {
      await fetch(`${baseUrl}/dashboard/nudges/${nudgeId}/seen`, { method: "PATCH" });
    } catch { /* silently fail */ }
    setNudges((prev) => prev.filter((n) => n.id !== nudgeId));
  };

  const tabs: { key: View; label: string; icon: React.ElementType }[] = [
    { key: "kanban",    label: "Kanban",    icon: LayoutGrid },
    { key: "dashboard", label: "Stats",     icon: BarChart3 },
    { key: "calendar",  label: "Calendar",  icon: Calendar },
    { key: "tasks",     label: "Tasks",     icon: ListTodo },
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
          <h1 className="text-3xl font-bold tracking-tight text-white">My Journey</h1>
          <p className="text-white/40 text-sm mt-1">
            Manage your job applications, goals, and track your daily progress.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex p-1 gap-1 rounded-xl bg-[#0E0E12] border border-white/[0.06] shadow-md shrink-0 self-start md:self-auto">
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

      <div className="pt-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
        {view === "kanban"    && <KanbanBoard />}
        {view === "dashboard" && <ProgressDashboard />}
        {view === "calendar"  && <CalendarView />}
        {view === "tasks"     && <TodoList />}
      </div>
    </div>
  );
}
