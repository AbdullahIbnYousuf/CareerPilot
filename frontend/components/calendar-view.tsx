"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import type { Application, Goal, Todo } from "@/types";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  CheckCircle2,
  Circle,
  Loader2,
  Target,
  BriefcaseBusiness,
  ListTodo,
} from "lucide-react";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

type CalendarItemType = "todo" | "goal" | "job_deadline";

interface CalendarItemBase {
  id: string;
  type: CalendarItemType;
  title: string;
  date: string;
  meta?: string;
}

interface CalendarTodoItem extends CalendarItemBase {
  type: "todo";
  completed: boolean;
  todo: Todo;
}

interface CalendarGoalItem extends CalendarItemBase {
  type: "goal";
  completed: boolean;
}

interface CalendarJobDeadlineItem extends CalendarItemBase {
  type: "job_deadline";
  href?: string;
}

type CalendarItem =
  | CalendarTodoItem
  | CalendarGoalItem
  | CalendarJobDeadlineItem;

const ITEM_TYPE_META: Record<
  CalendarItemType,
  {
    label: string;
    dot: string;
    icon: typeof ListTodo;
    accent: string;
  }
> = {
  todo: {
    label: "Task",
    dot: "bg-amber-400",
    icon: ListTodo,
    accent: "text-amber-300",
  },
  goal: {
    label: "Goal",
    dot: "bg-[#7C74DB]",
    icon: Target,
    accent: "text-[#AFA9EC]",
  },
  job_deadline: {
    label: "Job deadline",
    dot: "bg-rose-400",
    icon: BriefcaseBusiness,
    accent: "text-rose-300",
  },
};

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

function normalizeCalendarDate(value?: string | null): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const unavailable = [
    "rolling",
    "open",
    "not specified",
    "n/a",
    "na",
    "none",
  ];
  if (unavailable.some((word) => trimmed.toLowerCase().includes(word))) {
    return null;
  }

  const isoMatch = trimmed.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;

  return toLocalDateStr(parsed);
}

function formatDate(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function addItem(
  grouped: Record<string, CalendarItem[]>,
  item: CalendarItem
) {
  if (!grouped[item.date]) grouped[item.date] = [];
  grouped[item.date].push(item);
}

export function CalendarView() {
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(
    toLocalDateStr(new Date())
  );
  const [todos, setTodos] = useState<Todo[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  useEffect(() => {
    const loadUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!error) {
        setUserId(data.user?.id ?? null);
        if (!data.user) setLoading(false);
      }
    };
    void loadUser();
  }, []);

  useEffect(() => {
    if (!userId) return;

    const loadCalendarData = async () => {
      setLoading(true);
      try {
        const [todosRes, goalsRes, applicationsRes] = await Promise.all([
          fetch(`${baseUrl}/tracker/todos?user_id=${userId}`),
          fetch(`${baseUrl}/tracker/goals?user_id=${userId}`),
          fetch(`${baseUrl}/tracker/applications?user_id=${userId}`),
        ]);

        if (todosRes.ok) {
          const data: { todos?: Todo[] } = await todosRes.json();
          setTodos(data.todos ?? []);
        }

        if (goalsRes.ok) {
          const data: { goals?: Goal[] } = await goalsRes.json();
          setGoals(data.goals ?? []);
        }

        if (applicationsRes.ok) {
          const data: { applications?: Application[] } =
            await applicationsRes.json();
          setApplications(data.applications ?? []);
        }
      } catch {
        /* silently fail */
      } finally {
        setLoading(false);
      }
    };

    void loadCalendarData();
  }, [userId, viewDate, baseUrl]);

  const toggleTodo = async (todo: Todo) => {
    try {
      const res = await fetch(`${baseUrl}/tracker/todos/${todo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !todo.completed }),
      });
      if (res.ok) {
        setTodos((prev) =>
          prev.map((t) =>
            t.id === todo.id ? { ...t, completed: !t.completed } : t
          )
        );
      }
    } catch {
      /* silently fail */
    }
  };

  const itemsByDate = useMemo(() => {
    const grouped: Record<string, CalendarItem[]> = {};

    for (const todo of todos) {
      const date = normalizeCalendarDate(todo.due_date);
      if (!date) continue;

      addItem(grouped, {
        id: todo.id,
        type: "todo",
        title: todo.title,
        date,
        completed: todo.completed,
        todo,
      });
    }

    for (const goal of goals) {
      const date = normalizeCalendarDate(goal.target_date);
      if (!date) continue;

      addItem(grouped, {
        id: goal.id,
        type: "goal",
        title: goal.title,
        date,
        completed: goal.completed,
        meta: goal.completed ? "Completed" : "Target date",
      });
    }

    for (const app of applications) {
      const date = normalizeCalendarDate(app.deadline);
      if (!date) continue;

      addItem(grouped, {
        id: app.id,
        type: "job_deadline",
        title: app.title || "Application deadline",
        date,
        meta: app.company,
        href: app.url,
      });
    }

    return grouped;
  }, [todos, goals, applications]);

  const daysInMonth = new Date(
    viewDate.getFullYear(),
    viewDate.getMonth() + 1,
    0
  ).getDate();
  const firstDayOfMonth = new Date(
    viewDate.getFullYear(),
    viewDate.getMonth(),
    1
  ).getDay();
  const todayStr = toLocalDateStr(new Date());

  const prevMonth = () =>
    setViewDate(
      new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1)
    );
  const nextMonth = () =>
    setViewDate(
      new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1)
    );

  const selectedItems = itemsByDate[selectedDate] || [];

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <Card className="rounded-2xl border border-white/[0.06] bg-[#0E0E12] shadow-xl shadow-black/30 lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-bold text-white">
            <CalendarIcon className="h-4 w-4 text-[#7C74DB]" />
            {MONTH_NAMES[viewDate.getMonth()]} {viewDate.getFullYear()}
          </CardTitle>
          <div className="flex gap-1.5">
            <button
              onClick={prevMonth}
              id="calendar-prev-btn"
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={nextMonth}
              id="calendar-next-btn"
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex flex-wrap gap-3 text-[10px] font-semibold uppercase tracking-widest text-white/35">
            {(Object.keys(ITEM_TYPE_META) as CalendarItemType[]).map((type) => (
              <div key={type} className="flex items-center gap-1.5">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${ITEM_TYPE_META[type].dot}`}
                />
                {ITEM_TYPE_META[type].label}
              </div>
            ))}
          </div>

          <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-widest text-white/30">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`empty-${i}`} className="h-14 rounded-xl" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${viewDate.getFullYear()}-${String(
                viewDate.getMonth() + 1
              ).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === selectedDate;
              const itemTypes = Array.from(
                new Set((itemsByDate[dateStr] || []).map((item) => item.type))
              );

              return (
                <button
                  key={day}
                  id={`calendar-day-${dateStr}`}
                  onClick={() => setSelectedDate(dateStr)}
                  className={`flex h-14 flex-col items-center justify-between rounded-xl border p-2 transition-all duration-150 ${
                    isSelected
                      ? "border-[#7C74DB]/60 bg-[#7C74DB]/10 shadow-lg shadow-[#7C74DB]/5"
                      : isToday
                        ? "border-[#534AB7]/40 bg-[#534AB7]/5"
                        : "border-white/[0.04] bg-transparent hover:border-white/[0.10] hover:bg-white/[0.02]"
                  }`}
                >
                  <span
                    className={`text-sm font-semibold leading-none ${
                      isSelected
                        ? "text-[#AFA9EC]"
                        : isToday
                          ? "text-[#7C74DB]"
                          : "text-white/70"
                    }`}
                  >
                    {day}
                  </span>
                  {itemTypes.length > 0 && (
                    <div className="flex gap-0.5">
                      {itemTypes.map((type) => (
                        <div
                          key={type}
                          className={`h-1.5 w-1.5 rounded-full ${ITEM_TYPE_META[type].dot}`}
                        />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border border-white/[0.06] bg-[#0E0E12] shadow-xl shadow-black/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold text-white">
            {new Date(`${selectedDate}T12:00:00`).toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-[#7C74DB]" />
            </div>
          ) : selectedItems.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <CalendarIcon className="h-8 w-8 text-white/10" />
              <p className="text-sm text-white/25">
                No tasks, goals, or deadlines on this day.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {selectedItems.map((item) => (
                <CalendarItemRow
                  key={`${item.type}-${item.id}`}
                  item={item}
                  onToggleTodo={toggleTodo}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CalendarItemRow({
  item,
  onToggleTodo,
}: {
  item: CalendarItem;
  onToggleTodo: (todo: Todo) => void;
}) {
  const meta = ITEM_TYPE_META[item.type];
  const Icon = meta.icon;

  if (item.type === "todo") {
    return (
      <button
        onClick={() => onToggleTodo(item.todo)}
        className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all duration-200 ${
          item.completed
            ? "border-white/[0.03] bg-white/[0.01] opacity-50"
            : "border-white/[0.06] bg-white/[0.03] hover:border-white/[0.12]"
        }`}
      >
        {item.completed ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
        ) : (
          <Circle className="h-4 w-4 shrink-0 text-white/20" />
        )}
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
            <span className={`text-[10px] font-bold uppercase ${meta.accent}`}>
              {meta.label}
            </span>
          </div>
          <p
            className={`text-sm font-medium ${
              item.completed ? "line-through text-white/30" : "text-white/80"
            }`}
          >
            {item.title}
          </p>
        </div>
      </button>
    );
  }

  const content = (
    <div className="flex w-full items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-left">
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${meta.accent}`} />
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
          <span className={`text-[10px] font-bold uppercase ${meta.accent}`}>
            {meta.label}
          </span>
        </div>
        <p
          className={`text-sm font-medium ${
            item.type === "goal" && item.completed
              ? "line-through text-white/35"
              : "text-white/80"
          }`}
        >
          {item.title}
        </p>
        <p className="mt-0.5 text-[10px] text-white/30">
          {item.meta || formatDate(item.date)}
        </p>
      </div>
    </div>
  );

  if (item.type === "job_deadline" && item.href) {
    return (
      <a href={item.href} target="_blank" rel="noopener noreferrer">
        {content}
      </a>
    );
  }

  return content;
}
