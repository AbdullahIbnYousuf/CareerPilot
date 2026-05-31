"use client";

import { useState } from "react";
import { KanbanBoard } from "@/components/kanban-board";
import { ProgressDashboard } from "@/components/progress-dashboard";
import { CalendarView } from "@/components/calendar-view";
import { TodoList } from "@/components/todo-list";
import { NudgeBanner } from "@/components/nudge-banner";
import { LayoutGrid, BarChart3, Calendar, ListTodo, Compass } from "lucide-react";

type View = "kanban" | "dashboard" | "calendar" | "tasks";

export default function JourneyPage() {
  const [view, setView] = useState<View>("kanban");

  return (
    <div className="space-y-6">
      <NudgeBanner message="You've got 2 new job matches based on your updated skills. Check them out!" />

      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 border-b border-white/[0.04] pb-5">
        {/* Page header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-6 w-6 rounded-md bg-primary/20 flex items-center justify-center">
              <Compass className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="text-xs font-semibold text-primary uppercase tracking-widest">Productivity</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">My Journey</h1>
          <p className="text-white/40 text-sm mt-1">
            Manage your job applications, goals, and track your daily progress.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex p-1 gap-1 rounded-xl bg-[#0E0E12] border border-white/[0.06] shadow-md shrink-0 self-start md:self-auto">
          <button
            onClick={() => setView("kanban")}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all duration-200 ${
              view === "kanban"
                ? "bg-[#1E1B3A] text-[#AFA9EC] shadow-sm"
                : "text-white/60 hover:text-white hover:bg-white/[0.02]"
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Kanban
          </button>
          <button
            onClick={() => setView("dashboard")}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all duration-200 ${
              view === "dashboard"
                ? "bg-[#1E1B3A] text-[#AFA9EC] shadow-sm"
                : "text-white/60 hover:text-white hover:bg-white/[0.02]"
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5" /> Stats
          </button>
          <button
            onClick={() => setView("calendar")}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all duration-200 ${
              view === "calendar"
                ? "bg-[#1E1B3A] text-[#AFA9EC] shadow-sm"
                : "text-white/60 hover:text-white hover:bg-white/[0.02]"
            }`}
          >
            <Calendar className="h-3.5 w-3.5" /> Calendar
          </button>
          <button
            onClick={() => setView("tasks")}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all duration-200 ${
              view === "tasks"
                ? "bg-[#1E1B3A] text-[#AFA9EC] shadow-sm"
                : "text-white/60 hover:text-white hover:bg-white/[0.02]"
            }`}
          >
            <ListTodo className="h-3.5 w-3.5" /> Tasks
          </button>
        </div>
      </div>

      <div className="pt-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
        {view === "kanban" && <KanbanBoard />}
        {view === "dashboard" && <ProgressDashboard />}
        {view === "calendar" && <CalendarView />}
        {view === "tasks" && <TodoList />}
      </div>
    </div>
  );
}
