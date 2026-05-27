"use client";

import { ProgressDashboard } from "@/components/progress-dashboard";
import { TodoList } from "@/components/todo-list";
import { LayoutDashboard } from "lucide-react";

export default function HomePage() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-6 w-6 rounded-md bg-primary/20 flex items-center justify-center">
            <LayoutDashboard className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="text-xs font-semibold text-primary uppercase tracking-widest">Overview</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Dashboard</h1>
        <p className="text-white/40 text-sm mt-1">
          Welcome back! Here is a summary of your career progression and tasks.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ProgressDashboard />
        </div>
        <div>
          <TodoList />
        </div>
      </div>
    </div>
  );
}
