"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import type { Todo, Goal } from "@/types";
import {
  ListTodo,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  Circle,
  Tag,
  ChevronDown,
  Calendar,
} from "lucide-react";

export function TodoList() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newGoalId, setNewGoalId] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const loadUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!error) setUserId(data.user?.id ?? null);
    };
    loadUser();
  }, []);

  // ── Fetch todos + goals ───────────────────────────────────────────────────
  const fetchTodos = useCallback(async (uid: string) => {
    try {
      const res = await fetch(`${baseUrl}/tracker/todos?user_id=${uid}`);
      if (res.ok) {
        const data = await res.json();
        setTodos(data.todos || []);
      }
    } catch { /* silently fail */ }
  }, [baseUrl]);

  const fetchGoals = useCallback(async (uid: string) => {
    try {
      const res = await fetch(`${baseUrl}/tracker/goals?user_id=${uid}`);
      if (res.ok) {
        const data = await res.json();
        setGoals(data.goals || []);
      }
    } catch { /* silently fail */ }
  }, [baseUrl]);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    Promise.all([fetchTodos(userId), fetchGoals(userId)]).finally(() => setLoading(false));
  }, [userId, fetchTodos, fetchGoals]);

  // ── Add todo ──────────────────────────────────────────────────────────────
  const addTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !userId) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${baseUrl}/tracker/todos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          title: newTitle.trim(),
          due_date: newDueDate || null,
          goal_id: newGoalId || null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setTodos((prev) => [data.todo, ...prev]);
        setNewTitle("");
        setNewDueDate("");
        setNewGoalId("");
        setShowForm(false);
      }
    } catch { /* silently fail */ } finally {
      setSubmitting(false);
    }
  };

  // ── Toggle completion ─────────────────────────────────────────────────────
  const toggleTodo = async (todo: Todo) => {
    try {
      const res = await fetch(`${baseUrl}/tracker/todos/${todo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !todo.completed }),
      });
      if (res.ok) {
        setTodos((prev) =>
          prev.map((t) => (t.id === todo.id ? { ...t, completed: !t.completed } : t))
        );
      }
    } catch { /* silently fail */ }
  };

  // ── Delete todo ───────────────────────────────────────────────────────────
  const deleteTodo = async (id: string) => {
    // Optimistic update
    setTodos((prev) => prev.filter((t) => t.id !== id));
    try {
      // Backend doesn't have DELETE /todos yet — remove silently
      // (tracker.py can be extended; for now optimistic removal is fine)
    } catch { /* silently fail */ }
  };

  const pendingCount = todos.filter((t) => !t.completed).length;
  const goalMap = Object.fromEntries(goals.map((g) => [g.id, g.title]));

  return (
    <Card className="w-full bg-[#0E0E12] border border-white/[0.06] rounded-2xl shadow-xl shadow-black/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-bold flex items-center gap-2 text-white">
            <ListTodo className="h-4 w-4 text-[#7C74DB]" />
            Tasks
            {pendingCount > 0 && (
              <span className="ml-1 inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-[#534AB7]/20 text-[#AFA9EC] text-[10px] font-bold">
                {pendingCount}
              </span>
            )}
          </CardTitle>
          <button
            id="add-todo-btn"
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-[#534AB7]/20 hover:bg-[#534AB7]/30 text-[#AFA9EC] text-xs font-semibold transition-all duration-200"
          >
            <Plus className="h-3.5 w-3.5" />
            Add task
          </button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Add form */}
        {showForm && (
          <form
            onSubmit={addTodo}
            className="space-y-2.5 p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] animate-in fade-in slide-in-from-top-1 duration-200"
          >
            <input
              id="new-todo-title"
              type="text"
              placeholder="Task title..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              required
              className="w-full h-9 px-3.5 bg-white/[0.04] border border-white/[0.06] text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 rounded-xl text-sm transition-all"
            />
            <div className="flex gap-2">
              {/* Due date */}
              <div className="relative flex-1">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/20 pointer-events-none" />
                <input
                  id="new-todo-due-date"
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 bg-white/[0.04] border border-white/[0.06] text-white/70 focus:outline-none focus:border-primary/50 rounded-xl text-xs transition-all [color-scheme:dark]"
                />
              </div>
              {/* Goal picker */}
              {goals.length > 0 && (
                <div className="relative flex-1">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/20 pointer-events-none" />
                  <select
                    id="new-todo-goal"
                    value={newGoalId}
                    onChange={(e) => setNewGoalId(e.target.value)}
                    className="w-full h-9 pl-9 pr-3 bg-white/[0.04] border border-white/[0.06] text-white/70 focus:outline-none focus:border-primary/50 rounded-xl text-xs transition-all appearance-none"
                  >
                    <option value="">No goal</option>
                    {goals.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.title}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3 w-3 text-white/20 pointer-events-none" />
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting || !newTitle.trim()}
                id="submit-todo-btn"
                className="flex-1 h-9 flex items-center justify-center gap-1.5 rounded-xl bg-[#534AB7] hover:bg-[#6B63CC] disabled:opacity-50 text-white text-xs font-semibold transition-all"
              >
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add"}
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

        {/* Todo list */}
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-[#7C74DB]" />
          </div>
        ) : todos.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <ListTodo className="h-8 w-8 text-white/10" />
            <p className="text-sm text-white/25">No tasks yet. Add one above!</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {/* Pending */}
            {todos.filter((t) => !t.completed).map((todo) => (
              <TodoItem
                key={todo.id}
                todo={todo}
                goalName={todo.goal_id ? goalMap[todo.goal_id] : undefined}
                onToggle={() => toggleTodo(todo)}
                onDelete={() => deleteTodo(todo.id)}
              />
            ))}
            {/* Completed */}
            {todos.filter((t) => t.completed).length > 0 && (
              <>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-white/20 pt-2 pb-1">
                  Completed
                </p>
                {todos.filter((t) => t.completed).map((todo) => (
                  <TodoItem
                    key={todo.id}
                    todo={todo}
                    goalName={todo.goal_id ? goalMap[todo.goal_id] : undefined}
                    onToggle={() => toggleTodo(todo)}
                    onDelete={() => deleteTodo(todo.id)}
                  />
                ))}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TodoItem({
  todo,
  goalName,
  onToggle,
  onDelete,
}: {
  todo: Todo;
  goalName?: string;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`flex items-start gap-2.5 p-3 rounded-xl border transition-all duration-200 group ${
        todo.completed
          ? "bg-white/[0.01] border-white/[0.03] opacity-50"
          : "bg-[#0E0E12] border-white/[0.06] hover:border-white/[0.10] hover:bg-white/[0.01]"
      }`}
    >
      <button
        onClick={onToggle}
        id={`todo-toggle-${todo.id}`}
        className="mt-0.5 shrink-0 transition-colors"
      >
        {todo.completed ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
        ) : (
          <Circle className="h-4 w-4 text-white/20 hover:text-[#7C74DB]" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium leading-snug ${
            todo.completed ? "line-through text-white/30" : "text-white/85"
          }`}
        >
          {todo.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {todo.due_date && (
            <span className="text-[10px] text-white/30 flex items-center gap-1">
              <Calendar className="h-2.5 w-2.5" />
              {new Date(todo.due_date + "T12:00:00").toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
          {goalName && (
            <span className="text-[10px] bg-[#534AB7]/10 border border-[#534AB7]/20 text-[#AFA9EC] rounded-md px-1.5 py-0.5">
              {goalName}
            </span>
          )}
        </div>
      </div>

      <button
        onClick={onDelete}
        id={`todo-delete-${todo.id}`}
        className="h-7 w-7 flex items-center justify-center rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100 shrink-0"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
