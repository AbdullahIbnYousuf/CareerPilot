"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import type { Snapshot, StatusCounts, Nudge, SnapshotHistory, FitScoreDistribution } from "@/types";
import {
  Loader2,
  TrendingUp,
  Flame,
  Target,
  Briefcase,
  Send,
  Users,
  Trophy,
  XCircle,
  Bell,
  BarChart2,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const CHART_TOOLTIP_STYLE = {
  backgroundColor: "#0E0E12",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: "12px",
  color: "#ffffff",
  fontSize: "12px",
};

export function ProgressDashboard() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [statusCounts, setStatusCounts] = useState<StatusCounts | null>(null);
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [history, setHistory] = useState<SnapshotHistory[]>([]);
  const [distribution, setDistribution] = useState<FitScoreDistribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  useEffect(() => {
    const loadUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!error) setUserId(data.user?.id ?? null);
    };
    loadUser();
  }, []);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    Promise.all([
      fetchDashboard(userId),
      fetchNudges(userId),
      fetchStats(userId),
    ]).finally(() => setLoading(false));
  }, [userId]);

  const fetchDashboard = async (uid: string) => {
    try {
      const res = await fetch(`${baseUrl}/dashboard/${uid}`);
      if (res.ok) {
        const data = await res.json();
        setSnapshot(data.snapshot);
        setStatusCounts(data.status_counts);
      }
    } catch { /* silently fail */ }
  };

  const fetchNudges = async (uid: string) => {
    try {
      const res = await fetch(`${baseUrl}/dashboard/${uid}/nudges`);
      if (res.ok) {
        const data = await res.json();
        setNudges(data.nudges || []);
      }
    } catch { /* silently fail */ }
  };

  const fetchStats = async (uid: string) => {
    try {
      const res = await fetch(`${baseUrl}/dashboard/${uid}/stats`);
      if (res.ok) {
        const data = await res.json();
        setHistory(
          (data.snapshots || []).map((s: SnapshotHistory) => ({
            ...s,
            week_start: new Date(s.week_start).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          }))
        );
        setDistribution(data.distribution || []);
      }
    } catch { /* silently fail */ }
  };

  const dismissNudge = async (nudgeId: string) => {
    try {
      await fetch(`${baseUrl}/dashboard/nudges/${nudgeId}/seen`, { method: "PATCH" });
      setNudges((prev) => prev.filter((n) => n.id !== nudgeId));
    } catch { /* silently fail */ }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-[#7C74DB]" />
      </div>
    );
  }

  const statusItems = [
    { key: "saved",        label: "Saved",       icon: Briefcase, color: "text-slate-400",   bg: "bg-slate-400/10" },
    { key: "applied",      label: "Applied",     icon: Send,      color: "text-blue-400",    bg: "bg-blue-400/10" },
    { key: "interviewing", label: "Interview",   icon: Users,     color: "text-amber-400",   bg: "bg-amber-400/10" },
    { key: "offer",        label: "Offer",       icon: Trophy,    color: "text-emerald-400", bg: "bg-emerald-400/10" },
    { key: "rejected",     label: "Rejected",    icon: XCircle,   color: "text-red-400",     bg: "bg-red-400/10" },
  ] as const;

  return (
    <div className="space-y-6">
      {/* AI Nudges */}
      {nudges.length > 0 && (
        <div className="space-y-2">
          {nudges.map((nudge) => (
            <div
              key={nudge.id}
              className="flex items-start gap-3 p-4 rounded-xl bg-[#534AB7]/10 border border-[#534AB7]/20 shadow-md text-white/90"
            >
              <Bell className="h-4 w-4 text-[#AFA9EC] mt-0.5 shrink-0" />
              <p className="text-sm flex-1">{nudge.message}</p>
              <button
                className="text-xs text-white/40 hover:text-white transition-colors shrink-0 underline"
                onClick={() => dismissNudge(nudge.id)}
              >
                Dismiss
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Card className="bg-[#0E0E12] border border-white/[0.06] rounded-2xl shadow-xl shadow-black/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-white/60">Applications Sent</CardTitle>
            <TrendingUp className="h-4 w-4 text-white/30" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white tracking-tight">
              {snapshot?.applications_sent ?? 0}
            </div>
            <p className="text-xs text-white/30 mt-1">This week</p>
          </CardContent>
        </Card>

        <Card className="bg-[#0E0E12] border border-white/[0.06] rounded-2xl shadow-xl shadow-black/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-white/60">Daily Streak</CardTitle>
            <Flame className="h-4 w-4 text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white tracking-tight">
              {snapshot?.streak_days ?? 0}{" "}
              <span className="text-sm font-normal text-white/40">days</span>
            </div>
            <p className="text-xs text-white/30 mt-1">Keep it going!</p>
          </CardContent>
        </Card>

        <Card className="bg-[#0E0E12] border border-white/[0.06] rounded-2xl shadow-xl shadow-black/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-white/60">Roadmap Progress</CardTitle>
            <Target className="h-4 w-4 text-white/30" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white tracking-tight">
              {snapshot?.roadmap_pct ?? 0}%
            </div>
            <div className="mt-3.5 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#534AB7] to-[#7C74DB] transition-all duration-700"
                style={{ width: `${snapshot?.roadmap_pct ?? 0}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline overview */}
      <Card className="bg-[#0E0E12] border border-white/[0.06] rounded-2xl shadow-xl shadow-black/30">
        <CardHeader>
          <CardTitle className="text-base font-bold text-white">Application Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {statusItems.map((item) => {
              const Icon = item.icon;
              const count = statusCounts?.[item.key as keyof StatusCounts] ?? 0;
              return (
                <div
                  key={item.key}
                  className="flex flex-col items-center gap-1.5 p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] transition-all hover:bg-white/[0.04]"
                >
                  <div className={`h-8 w-8 rounded-xl ${item.bg} flex items-center justify-center`}>
                    <Icon className={`h-4 w-4 ${item.color}`} />
                  </div>
                  <span className="text-2xl font-bold text-white tracking-tight">{count}</span>
                  <span className="text-xs text-white/40 font-medium">{item.label}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Line chart — applications over time */}
        <Card className="bg-[#0E0E12] border border-white/[0.06] rounded-2xl shadow-xl shadow-black/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#7C74DB]" />
              Applications Over Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            {history.length > 1 ? (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={history} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis
                    dataKey="week_start"
                    tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                  <Line
                    type="monotone"
                    dataKey="applications_sent"
                    name="Applications"
                    stroke="#7C74DB"
                    strokeWidth={2}
                    dot={{ fill: "#7C74DB", r: 3 }}
                    activeDot={{ r: 5, fill: "#AFA9EC" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[180px] flex items-center justify-center text-white/20 text-sm">
                Not enough data yet. Keep applying!
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bar chart — fit score distribution */}
        <Card className="bg-[#0E0E12] border border-white/[0.06] rounded-2xl shadow-xl shadow-black/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-[#7C74DB]" />
              Fit Score Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {distribution.some((d) => d.count > 0) ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={distribution} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis
                    dataKey="range"
                    tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                  <Bar
                    dataKey="count"
                    name="Jobs"
                    fill="#534AB7"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[180px] flex items-center justify-center text-white/20 text-sm">
                Search for jobs to see fit score data.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
