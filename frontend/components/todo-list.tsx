"use client";

import { useState, type FormEvent } from "react";
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock3,
  Loader2,
  ListTodo,
  Plus,
  Tag,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Goal, Todo } from "@/types";

interface TodoListProps {
  userId: string;
  goals: Goal[];
  todos: Todo[];
  onTodosChange: () => void;
  onTodoCreated?: (todo: Todo) => void;
}

type TodoBucket = "overdue" | "today" | "future" | "no-date" | "completed";

const bucketMeta: Record<
  TodoBucket,
  {
    label: string;
    description: string;
    className: string;
  }
> = {
  overdue: {
    label: "Overdue",
    description: "Needs attention first",
    className: "text-red-300",
  },
  today: {
    label: "Today",
    description: "Good daily action queue",
    className: "text-amber-200",
  },
  future: {
    label: "Upcoming",
    description: "Planned next steps",
    className: "text-sky-200",
  },
  "no-date": {
    label: "Someday",
    description: "No due date yet",
    className: "text-white/40",
  },
  completed: {
    label: "Completed",
    description: "Finished work",
    className: "text-emerald-300",
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
  });
}

function daysUntil(value?: string | null): number | null {
  const date = parseDateOnly(value);
  if (!date) return null;
  const diff = date.getTime() - todayStart().getTime();
  return Math.round(diff / 86_400_000);
}

function getTodoBucket(todo: Todo): TodoBucket {
  if (todo.completed) return "completed";

  const remainingDays = daysUntil(todo.due_date);
  if (remainingDays === null) return "no-date";
  if (remainingDays < 0) return "overdue";
  if (remainingDays === 0) return "today";
  return "future";
}

function bucketRank(bucket: TodoBucket): number {
  return {
    overdue: 0,
    today: 1,
    future: 2,
    "no-date": 3,
    completed: 4,
  }[bucket];
}

function compareTodoDates(a: Todo, b: Todo): number {
  const aTime = parseDateOnly(a.due_date)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const bTime = parseDateOnly(b.due_date)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  if (aTime !== bTime) return aTime - bTime;
  return a.title.localeCompare(b.title);
}

function sortTodos(todos: Todo[]): Todo[] {
  return [...todos].sort((a, b) => {
    const bucketDiff = bucketRank(getTodoBucket(a)) - bucketRank(getTodoBucket(b));
    if (bucketDiff !== 0) return bucketDiff;
    return compareTodoDates(a, b);
  });
}

export function TodoList({
  userId,
  goals,
  todos,
  onTodosChange,
  onTodoCreated,
}: TodoListProps) {
  const [newTitle, setNewTitle] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newGoalId, setNewGoalId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [inlineMsg, setInlineMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const pendingCount = todos.filter((todo) => !todo.completed).length;
  const goalMap = Object.fromEntries(goals.map((goal) => [goal.id, goal.title]));

  const flash = (type: "success" | "error", text: string) => {
    setInlineMsg({ type, text });
    window.setTimeout(() => setInlineMsg(null), 3000);
  };

  const addTodo = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newTitle.trim()) return;

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

      if (!res.ok) {
        flash("error", "Failed to add task.");
        return;
      }

      const data = (await res.json()) as { todo?: Todo };

      setNewTitle("");
      setNewDueDate("");
      setNewGoalId("");
      setShowForm(false);
      flash("success", "Task added.");
      if (data.todo) {
        onTodoCreated?.(data.todo);
        return;
      }
      onTodosChange();
    } catch {
      flash("error", "Failed to add task.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleTodo = async (todo: Todo) => {
    setTogglingId(todo.id);
    try {
      const res = await fetch(`${baseUrl}/tracker/todos/${todo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !todo.completed }),
      });

      if (!res.ok) {
        flash("error", "Failed to update task.");
        return;
      }

      onTodosChange();
    } catch {
      flash("error", "Failed to update task.");
    } finally {
      setTogglingId(null);
    }
  };

  const deleteTodo = async (todoId: string) => {
    setDeletingId(todoId);
    try {
      const res = await fetch(`${baseUrl}/tracker/todos/${todoId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        flash("error", "Failed to delete task.");
        return;
      }

      flash("success", "Task deleted.");
      onTodosChange();
    } catch {
      flash("error", "Failed to delete task.");
    } finally {
      setDeletingId(null);
    }
  };

  const sortedTodos = sortTodos(todos);
  const groupedTodos = sortedTodos.reduce<Record<TodoBucket, Todo[]>>(
    (groups, todo) => {
      groups[getTodoBucket(todo)].push(todo);
      return groups;
    },
    {
      overdue: [],
      today: [],
      future: [],
      "no-date": [],
      completed: [],
    }
  );

  return (
    <Card className="w-full rounded-2xl border border-white/[0.06] bg-[#0E0E12] shadow-xl shadow-black/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base font-bold text-white">
            <ListTodo className="h-4 w-4 text-[#7C74DB]" />
            Tasks
            {pendingCount > 0 && (
              <span className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#534AB7]/20 px-1.5 text-[10px] font-bold text-[#AFA9EC]">
                {pendingCount}
              </span>
            )}
          </CardTitle>
          <Button
            id="add-todo-btn"
            type="button"
            size="sm"
            onClick={() => setShowForm((value) => !value)}
            className="bg-[#534AB7]/20 text-[#AFA9EC] hover:bg-[#534AB7]/30"
          >
            <Plus className="h-3.5 w-3.5" />
            Add task
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
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
            onSubmit={addTodo}
            className="animate-in fade-in slide-in-from-top-1 space-y-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 duration-200"
          >
            <input
              id="new-todo-title"
              type="text"
              placeholder="Complete one cover letter..."
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              required
              className="h-9 w-full rounded-xl border border-white/[0.06] bg-white/[0.04] px-3.5 text-sm text-white transition-all placeholder:text-white/20 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20"
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Calendar className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/20" />
                <input
                  id="new-todo-due-date"
                  type="date"
                  value={newDueDate}
                  onChange={(event) => setNewDueDate(event.target.value)}
                  className="h-9 w-full rounded-xl border border-white/[0.06] bg-white/[0.04] pl-9 pr-3 text-xs text-white/70 transition-all [color-scheme:dark] focus:border-primary/50 focus:outline-none"
                />
              </div>

              {goals.length > 0 && (
                <div className="relative flex-1">
                  <Tag className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/20" />
                  <select
                    id="new-todo-goal"
                    value={newGoalId}
                    onChange={(event) => setNewGoalId(event.target.value)}
                    className="h-9 w-full appearance-none rounded-xl border border-white/[0.06] bg-[#0E0E12]/80 pl-9 pr-8 text-xs text-white/70 transition-all focus:border-primary/50 focus:outline-none"
                  >
                    <option value="" className="bg-[#0E0E12] text-white">
                      No goal
                    </option>
                    {goals.map((goal) => (
                      <option
                        key={goal.id}
                        value={goal.id}
                        className="bg-[#0E0E12] text-white"
                      >
                        {goal.title}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 text-white/20" />
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                id="submit-todo-btn"
                type="submit"
                disabled={submitting || !newTitle.trim()}
                className="flex-1 bg-[#534AB7] text-white hover:bg-[#6B63CC]"
              >
                {submitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "Add"
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

        {todos.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <ListTodo className="h-8 w-8 text-white/10" />
            <p className="max-w-[260px] text-sm text-white/35">
              Break a goal into one small action for today.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {(
              ["overdue", "today", "future", "no-date", "completed"] as const
            ).map((bucket) => {
              const items = groupedTodos[bucket];
              if (items.length === 0) return null;
              const meta = bucketMeta[bucket];

              return (
                <section key={bucket} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-3 px-1">
                    <div className="flex items-center gap-2">
                      <p
                        className={`text-[10px] font-semibold uppercase tracking-widest ${meta.className}`}
                      >
                        {meta.label}
                      </p>
                      <span className="text-[10px] text-white/20">
                        {items.length}
                      </span>
                    </div>
                    <p className="hidden text-[10px] text-white/25 sm:block">
                      {meta.description}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    {items.map((todo) => (
                      <TodoItem
                        key={todo.id}
                        todo={todo}
                        bucket={bucket}
                        goalName={
                          todo.goal_id ? goalMap[todo.goal_id] : undefined
                        }
                        isDeleting={deletingId === todo.id}
                        isToggling={togglingId === todo.id}
                        onToggle={() => toggleTodo(todo)}
                        onDelete={() => deleteTodo(todo.id)}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TodoItem({
  todo,
  bucket,
  goalName,
  isDeleting,
  isToggling,
  onToggle,
  onDelete,
}: {
  todo: Todo;
  bucket: TodoBucket;
  goalName?: string;
  isDeleting: boolean;
  isToggling: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const isOverdue = bucket === "overdue";
  const isToday = bucket === "today";
  const cardClassName = todo.completed
    ? "border-white/[0.03] bg-white/[0.01] opacity-55"
    : isOverdue
      ? "border-red-400/20 bg-red-500/[0.04]"
      : isToday
        ? "border-amber-400/20 bg-amber-400/[0.04]"
        : "border-white/[0.06] bg-[#0E0E12] hover:border-white/[0.10] hover:bg-white/[0.01]";

  return (
    <div
      className={`group flex items-start gap-2.5 rounded-xl border p-3 transition-all duration-200 ${cardClassName}`}
    >
      <button
        id={`todo-toggle-${todo.id}`}
        type="button"
        onClick={onToggle}
        disabled={isToggling || isDeleting}
        aria-label={todo.completed ? "Mark task incomplete" : "Mark task complete"}
        className="mt-0.5 shrink-0 transition-colors disabled:opacity-50"
      >
        {isToggling ? (
          <Loader2 className="h-4 w-4 animate-spin text-white/30" />
        ) : todo.completed ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
        ) : (
          <Circle className="h-4 w-4 text-white/20 hover:text-[#7C74DB]" />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <p
          className={`text-sm font-medium leading-snug ${
            todo.completed ? "line-through text-white/30" : "text-white/85"
          }`}
        >
          {todo.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {todo.due_date && (
            <span
              className={`flex items-center gap-1 text-[10px] ${
                isOverdue
                  ? "text-red-300"
                  : isToday
                    ? "text-amber-200"
                    : "text-white/35"
              }`}
            >
              {isToday ? (
                <Clock3 className="h-2.5 w-2.5" />
              ) : (
                <Calendar className="h-2.5 w-2.5" />
              )}
              {formatDate(todo.due_date)}
            </span>
          )}
          {goalName && (
            <Badge
              variant="outline"
              className="max-w-full border-[#534AB7]/20 bg-[#534AB7]/10 text-[#AFA9EC]"
            >
              <Tag className="h-3 w-3" />
              <span className="truncate">{goalName}</span>
            </Badge>
          )}
        </div>
      </div>

      <Button
        id={`todo-delete-${todo.id}`}
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={onDelete}
        disabled={isDeleting || isToggling}
        aria-label="Delete task"
        className="shrink-0 text-white/25 opacity-100 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50 sm:opacity-0 sm:group-hover:opacity-100"
      >
        {isDeleting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Trash2 className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  );
}
