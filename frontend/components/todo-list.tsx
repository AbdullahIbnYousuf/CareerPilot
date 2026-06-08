"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  Calendar,
  CheckCircle2,
  Circle,
  Clock3,
  Loader2,
  ListTodo,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Todo } from "@/types";
import type { CopilotGoalsTasksDraft } from "@/lib/copilot/drafts";

interface TodoListProps {
  userId: string;
  todos: Todo[];
  onTodosChange: () => void;
  draft?: CopilotGoalsTasksDraft | null;
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
    className: "text-[var(--cp-text-soft)]",
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
  todos,
  onTodosChange,
  draft,
  onTodoCreated,
}: TodoListProps) {
  const [newTitle, setNewTitle] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [inlineMsg, setInlineMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const externalTodos = todos.filter((todo) => !todo.goal_id);
  const pendingCount = externalTodos.filter((todo) => !todo.completed).length;

  const flash = (type: "success" | "error", text: string) => {
    setInlineMsg({ type, text });
    window.setTimeout(() => setInlineMsg(null), 3000);
  };

  useEffect(() => {
    if (draft?.type !== "todo") return;

    const timeoutId = window.setTimeout(() => {
      setShowForm(true);
      setNewTitle(draft.todo.title);
      setNewDueDate(draft.todo.due_date ?? "");
      flash("success", "CareerPilot filled a task draft. Review it, then click Add.");
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [draft]);

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
          goal_id: null,
        }),
      });

      if (!res.ok) {
        flash("error", "Failed to add task.");
        return;
      }

      const data = (await res.json()) as { todo?: Todo };
      setNewTitle("");
      setNewDueDate("");
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

  const sortedTodos = sortTodos(externalTodos);
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
    <Card className="w-full rounded-2xl border border-[var(--cp-border-soft)] bg-[var(--cp-surface)] shadow-xl shadow-black/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base font-bold text-white">
            <ListTodo className="h-4 w-4 text-[var(--cp-copper-strong)]" />
            External tasks
            {pendingCount > 0 && (
              <span className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full border border-[var(--cp-border-soft)] bg-[rgba(201,130,74,0.14)] px-1.5 text-[10px] font-bold text-[var(--cp-champagne)]">
                {pendingCount}
              </span>
            )}
          </CardTitle>
          <Button
            id="add-todo-btn"
            type="button"
            size="sm"
            onClick={() => setShowForm((value) => !value)}
            variant="outline"
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
            className="animate-in fade-in slide-in-from-top-1 space-y-2.5 rounded-xl border border-[var(--cp-border-soft)] bg-[var(--cp-surface-elevated)] p-3.5 duration-200"
          >
            <input
              id="new-todo-title"
              type="text"
              placeholder="Complete one cover letter..."
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              required
              className="h-9 w-full rounded-xl border border-[var(--cp-border-soft)] bg-[rgba(255,255,255,0.035)] px-3.5 text-sm text-white transition-all placeholder:text-white/25 focus:border-[var(--cp-border-strong)] focus:outline-none focus:ring-1 focus:ring-[var(--cp-glow-copper)]"
            />
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/20" />
              <input
                id="new-todo-due-date"
                type="date"
                value={newDueDate}
                onChange={(event) => setNewDueDate(event.target.value)}
                className="h-9 w-full rounded-xl border border-[var(--cp-border-soft)] bg-[rgba(255,255,255,0.035)] pl-9 pr-3 text-xs text-white/70 transition-all [color-scheme:dark] focus:border-[var(--cp-border-strong)] focus:outline-none"
              />
            </div>
            <div className="flex gap-2">
              <Button
                id="submit-todo-btn"
                type="submit"
                disabled={submitting || !newTitle.trim()}
                className="flex-1"
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
                className="text-white/50 hover:bg-[rgba(201,130,74,0.08)] hover:text-white"
              >
                Cancel
              </Button>
            </div>
          </form>
        )}

        {externalTodos.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <ListTodo className="h-8 w-8 text-white/10" />
            <p className="max-w-[260px] text-sm text-white/35">
              Tasks without a goal will show up here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {(["overdue", "today", "future", "no-date", "completed"] as const).map((bucket) => {
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
                      <span className="text-[10px] text-white/20">{items.length}</span>
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
  isDeleting,
  isToggling,
  onToggle,
  onDelete,
}: {
  todo: Todo;
  bucket: TodoBucket;
  isDeleting: boolean;
  isToggling: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const isOverdue = bucket === "overdue";
  const isToday = bucket === "today";
  const cardClassName = todo.completed
    ? "border-[var(--cp-border-soft)] bg-[rgba(24,23,22,0.68)] opacity-55"
    : isOverdue
      ? "border-red-400/20 bg-red-500/[0.04]"
      : isToday
        ? "border-amber-400/20 bg-amber-400/[0.04]"
        : "border-[var(--cp-border-soft)] bg-[var(--cp-surface-elevated)] hover:border-[var(--cp-border-medium)] hover:bg-[rgba(201,130,74,0.06)]";

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
          <Circle className="h-4 w-4 text-white/20 hover:text-[var(--cp-copper-strong)]" />
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
                isOverdue ? "text-red-300" : isToday ? "text-amber-200" : "text-white/35"
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
