"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock } from "lucide-react";

export function CalendarView() {
  const [date, setDate] = useState(new Date());

  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const prevMonth = () => setDate(new Date(date.getFullYear(), date.getMonth() - 1, 1));
  const nextMonth = () => setDate(new Date(date.getFullYear(), date.getMonth() + 1, 1));

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  return (
    <Card className="w-full bg-[#0E0E12] border border-white/[0.06] rounded-2xl shadow-xl shadow-black/30">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xl font-bold flex items-center gap-2 text-white">
          <CalendarIcon className="h-5 w-5 text-[#7C74DB]" />
          {monthNames[date.getMonth()]} {date.getFullYear()}
        </CardTitle>
        <div className="flex gap-2">
          <button
            onClick={prevMonth}
            className="bg-[#1E1B3A]/40 border border-white/[0.06] text-white hover:bg-[#1E1B3A]/80 hover:text-white rounded-xl h-8 w-8 flex items-center justify-center transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={nextMonth}
            className="bg-[#1E1B3A]/40 border border-white/[0.06] text-white hover:bg-[#1E1B3A]/80 hover:text-white rounded-xl h-8 w-8 flex items-center justify-center transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-white/40 mb-4">
          <div>Sun</div>
          <div>Mon</div>
          <div>Tue</div>
          <div>Wed</div>
          <div>Thu</div>
          <div>Fri</div>
          <div>Sat</div>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: firstDayOfMonth }).map((_, i) => (
            <div key={`empty-${i}`} className="h-24 rounded-xl bg-white/[0.01] border border-transparent"></div>
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const isToday = day === new Date().getDate() && date.getMonth() === new Date().getMonth() && date.getFullYear() === new Date().getFullYear();
            return (
              <div
                key={day}
                className={`h-24 rounded-xl p-2.5 flex flex-col justify-between border ${
                  isToday
                    ? "border-[#7C74DB]/50 bg-[#7C74DB]/5 shadow-lg shadow-[#7C74DB]/5"
                    : "border-white/[0.06] bg-[#0E0E12] hover:border-white/[0.12] hover:bg-white/[0.02]"
                } transition-all duration-200`}
              >
                <div className={`text-sm font-semibold ${isToday ? "text-[#7C74DB]" : "text-white/90"}`}>
                  {day}
                </div>
                {/* Placeholder for events */}
                {day % 5 === 0 && (
                  <div className="text-[10px] bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg px-2 py-1 truncate flex items-center gap-1 font-medium">
                    <Clock className="h-3 w-3 shrink-0 text-amber-400" />
                    Interview
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
