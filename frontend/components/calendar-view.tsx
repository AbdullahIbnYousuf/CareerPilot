"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import type { Todo } from "@/types";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  CheckCircle2,
  Circle,
  Loader2,
} from "lucide-react";

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function CalendarView() {
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(toLocalDateStr(new Date()));
  const [todos, setTodos] = useState<Todo[]>([]);
  const [todosByDate, setTodosByDate] = useState<Record<string, Todo[]>>({});
  const [loading, setLoading] = useState(true);
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

  // ── Fetch todos for the visible month ─────────────────────────────────────
  const fetchMonthTodos = useCallback(async (uid: string, year: number, month: number) => {
    setLoading(true);
    try {
      const res = await fetch(`${baseUrl}/tracker/todos?user_id=${uid}`);
      if (res.ok) {
        const data = await res.json();
        const all: Todo[] = data.todos || [];

        // Group by due_date for dot indicators
        const grouped: Record<string, Todo[]> = {};
        for (const t of all) {
          if (t.due_date) {
            if (!grouped[t.due_date]) grouped[t.due_date] = [];
            grouped[t.due_date].push(t);
          }
        }
        setTodosByDate(grouped);
        setTodos(all);
      }
    } catch { /* silently fail */ } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    fetchMonthTodos(userId, viewDate.getFullYear(), viewDate.getMonth());
  }, [userId, viewDate, fetchMonthTodos]);

  // ── Toggle todo completion ────────────────────────────────────────────────
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
        setTodosByDate((prev) => {
          if (!todo.due_date) return prev;
          return {
            ...prev,
            [todo.due_date]: (prev[todo.due_date] || []).map((t) =>
              t.id === todo.id ? { ...t, completed: !t.completed } : t
            ),
          };
        });
      }
    } catch { /* silently fail */ }
  };

  // ── Calendar math ─────────────────────────────────────────────────────────
  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();
  const todayStr = toLocalDateStr(new Date());

  const prevMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  const nextMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));

  const selectedTodos = todosByDate[selectedDate] || [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* Calendar grid */}
      <Card className="lg:col-span-2 bg-[#0E0E12] border border-white/[0.06] rounded-2xl shadow-xl shadow-black/30">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2 text-white">
            <CalendarIcon className="h-4 w-4 text-[#7C74DB]" />
            {MONTH_NAMES[viewDate.getMonth()]} {viewDate.getFullYear()}
          </CardTitle>
          <div className="flex gap-1.5">
            <button
              onClick={prevMonth}
              id="calendar-prev-btn"
              className="h-8 w-8 flex items-center justify-center rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/50 hover:bg-white/[0.06] hover:text-white transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={nextMonth}
              id="calendar-next-btn"
              className="h-8 w-8 flex items-center justify-center rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/50 hover:bg-white/[0.06] hover:text-white transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-white/30 mb-2 uppercase tracking-widest">
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`empty-${i}`} className="h-14 rounded-xl" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === selectedDate;
              const hasTodos = (todosByDate[dateStr]?.length ?? 0) > 0;
              const hasIncomplete = todosByDate[dateStr]?.some((t) => !t.completed);

              return (
                <button
                  key={day}
                  id={`calendar-day-${dateStr}`}
                  onClick={() => setSelectedDate(dateStr)}
                  className={`h-14 rounded-xl p-2 flex flex-col items-center justify-between border transition-all duration-150 ${
                    isSelected
                      ? "border-[#7C74DB]/60 bg-[#7C74DB]/10 shadow-lg shadow-[#7C74DB]/5"
                      : isToday
                      ? "border-[#534AB7]/40 bg-[#534AB7]/5"
                      : "border-white/[0.04] bg-transparent hover:border-white/[0.10] hover:bg-white/[0.02]"
                  }`}
                >
                  <span
                    className={`text-sm font-semibold leading-none ${
                      isSelected ? "text-[#AFA9EC]" : isToday ? "text-[#7C74DB]" : "text-white/70"
                    }`}
                  >
                    {day}
                  </span>
                  {/* Dot indicator */}
                  {hasTodos && (
                    <div className="flex gap-0.5">
                      <div
                        className={`h-1.5 w-1.5 rounded-full ${
                          hasIncomplete ? "bg-amber-400" : "bg-emerald-400"
                        }`}
                      />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Selected day todo panel */}
      <Card className="bg-[#0E0E12] border border-white/[0.06] rounded-2xl shadow-xl shadow-black/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold text-white">
            {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", {
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
          ) : selectedTodos.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <CalendarIcon className="h-8 w-8 text-white/10" />
              <p className="text-sm text-white/25">No tasks due on this day.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {selectedTodos.map((todo) => (
                <button
                  key={todo.id}
                  onClick={() => toggleTodo(todo)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-200 ${
                    todo.completed
                      ? "bg-white/[0.01] border-white/[0.03] opacity-50"
                      : "bg-white/[0.03] border-white/[0.06] hover:border-white/[0.12]"
                  }`}
                >
                  {todo.completed ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  ) : (
                    <Circle className="h-4 w-4 shrink-0 text-white/20" />
                  )}
                  <span
                    className={`text-sm flex-1 font-medium ${
                      todo.completed ? "line-through text-white/30" : "text-white/80"
                    }`}
                  >
                    {todo.title}
                  </span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
