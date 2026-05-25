"use client";

import { useState } from "react";
import { KanbanBoard } from "@/components/kanban-board";
import { ProgressDashboard } from "@/components/progress-dashboard";
import { CalendarView } from "@/components/calendar-view";
import { TodoList } from "@/components/todo-list";
import { NudgeBanner } from "@/components/nudge-banner";
import { Button } from "@/components/ui/button";
import { LayoutGrid, BarChart3, Calendar, ListTodo } from "lucide-react";

type View = "kanban" | "dashboard" | "calendar" | "tasks";

export default function TrackerPage() {
  const [view, setView] = useState<View>("kanban");

  return (
    <div className="space-y-6">
      <NudgeBanner message="You've got 2 new job matches based on your updated skills. Check them out!" />
      
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Productivity Tracker
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage your job applications, goals, and track your daily progress.
          </p>
        </div>

        <div className="flex gap-1 bg-muted p-1 rounded-lg">
          <Button
            variant={view === "kanban" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setView("kanban")}
            className="gap-1.5"
          >
            <LayoutGrid className="h-4 w-4" /> Kanban
          </Button>
          <Button
            variant={view === "dashboard" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setView("dashboard")}
            className="gap-1.5"
          >
            <BarChart3 className="h-4 w-4" /> Dashboard
          </Button>
          <Button
            variant={view === "calendar" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setView("calendar")}
            className="gap-1.5"
          >
            <Calendar className="h-4 w-4" /> Calendar
          </Button>
          <Button
            variant={view === "tasks" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setView("tasks")}
            className="gap-1.5"
          >
            <ListTodo className="h-4 w-4" /> Tasks
          </Button>
        </div>
      </div>

      {view === "kanban" && <KanbanBoard />}
      {view === "dashboard" && <ProgressDashboard />}
      {view === "calendar" && <CalendarView />}
      {view === "tasks" && <TodoList />}
    </div>
  );
}
