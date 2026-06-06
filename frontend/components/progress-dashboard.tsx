"use client";

import { useCallback, useEffect, useState } from "react";
import type { ElementType, ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import type {
  DashboardAttention,
  FitScoreDistribution,
  Nudge,
  Snapshot,
  SnapshotHistory,
  StatusCounts,
  StatusDistribution,
} from "@/types";
import {
  AlertTriangle,
  BarChart2,
  Bell,
  Briefcase,
  CheckCircle2,
  Flame,
  Loader2,
  Send,
  Target,
  Trophy,
  Users,
  XCircle,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface DashboardPayload {
  snapshot?: Snapshot;
  status_counts?: StatusCounts;
  attention?: DashboardAttention;
}

interface StatsPayload {
  snapshots?: SnapshotHistory[];
  distribution?: FitScoreDistribution[];
  status_distribution?: StatusDistribution[];
}

const CHART_TOOLTIP_STYLE = {
  backgroundColor: "#0E0E12",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: "8px",
  color: "#ffffff",
  fontSize: "12px",
};

const EMPTY_ATTENTION: DashboardAttention = {
  high_fit_saved: 0,
  overdue_tasks: 0,
  active_goals: 0,
  completed_goals: 0,
  interviews: 0,
};

const EMPTY_STATUS_COUNTS: StatusCounts = {
  saved: 0,
  applied: 0,
  interviewing: 0,
  offer: 0,
  rejected: 0,
};

const statusItems = [
  { key: "saved", label: "Saved", icon: Briefcase, color: "text-slate-400", bg: "bg-slate-400/10" },
  { key: "applied", label: "Applied", icon: Send, color: "text-blue-400", bg: "bg-blue-400/10" },
  { key: "interviewing", label: "Interviewing", icon: Users, color: "text-amber-400", bg: "bg-amber-400/10" },
  { key: "offer", label: "Offer", icon: Trophy, color: "text-emerald-400", bg: "bg-emerald-400/10" },
  { key: "rejected", label: "Rejected", icon: XCircle, color: "text-red-400", bg: "bg-red-400/10" },
] as const;

export function ProgressDashboard() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [statusCounts, setStatusCounts] = useState<StatusCounts>(EMPTY_STATUS_COUNTS);
  const [attention, setAttention] = useState<DashboardAttention>(EMPTY_ATTENTION);
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [history, setHistory] = useState<SnapshotHistory[]>([]);
  const [distribution, setDistribution] = useState<FitScoreDistribution[]>([]);
  const [statusDistribution, setStatusDistribution] = useState<StatusDistribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  useEffect(() => {
    const loadUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!error) {
        const currentUserId = data.user?.id ?? null;
        setUserId(currentUserId);
        if (!currentUserId) setLoading(false);
      } else {
        setLoading(false);
      }
    };
    void loadUser();
  }, []);

  const fetchDashboard = useCallback(async (uid: string) => {
    try {
      const res = await fetch(`${baseUrl}/dashboard/${uid}`);
      if (res.ok) {
        const data = (await res.json()) as DashboardPayload;
        setSnapshot(data.snapshot ?? null);
        setStatusCounts(data.status_counts ?? EMPTY_STATUS_COUNTS);
        setAttention(data.attention ?? EMPTY_ATTENTION);
      }
    } catch {
      /* keep dashboard resilient when the API is unavailable */
    }
  }, [baseUrl]);

  const fetchNudges = useCallback(async (uid: string) => {
    try {
      const res = await fetch(`${baseUrl}/dashboard/${uid}/nudges`);
      if (res.ok) {
        const data = (await res.json()) as { nudges?: Nudge[] };
        setNudges(data.nudges ?? []);
      }
    } catch {
      /* keep dashboard resilient when the API is unavailable */
    }
  }, [baseUrl]);

  const fetchStats = useCallback(async (uid: string) => {
    try {
      const res = await fetch(`${baseUrl}/dashboard/${uid}/stats`);
      if (res.ok) {
        const data = (await res.json()) as StatsPayload;
        setHistory(
          (data.snapshots ?? []).map((s) => ({
            ...s,
            week_start: new Date(s.week_start).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            }),
          }))
        );
        setDistribution(data.distribution ?? []);
        setStatusDistribution(data.status_distribution ?? []);
      }
    } catch {
      /* keep dashboard resilient when the API is unavailable */
    }
  }, [baseUrl]);

  useEffect(() => {
    if (!userId) return;

    const loadDashboard = async () => {
      setLoading(true);
      await Promise.all([
        fetchDashboard(userId),
        fetchNudges(userId),
        fetchStats(userId),
      ]);
      setLoading(false);
    };

    void loadDashboard();
  }, [fetchDashboard, fetchNudges, fetchStats, userId]);

  const dismissNudge = async (nudgeId: string) => {
    try {
      await fetch(`${baseUrl}/dashboard/nudges/${nudgeId}/seen`, { method: "PATCH" });
      setNudges((prev) => prev.filter((n) => n.id !== nudgeId));
    } catch {
      /* keep the current nudge visible if the update fails */
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#7C74DB]" />
      </div>
    );
  }

  const activeApplications =
    statusCounts.applied + statusCounts.interviewing + statusCounts.offer;
  const totalApplications = Object.values(statusCounts).reduce(
    (sum, count) => sum + count,
    0
  );
  const statusChartData = statusDistribution.length > 0
    ? statusDistribution
    : statusItems.map((item) => ({
        status: item.key,
        label: item.label,
        count: statusCounts[item.key],
      }));

  const attentionItems = [
    {
      label: "Saved high-fit jobs",
      value: attention.high_fit_saved,
      detail: "Ready to apply",
      tone: "text-[#AFA9EC]",
    },
    {
      label: "Overdue tasks",
      value: attention.overdue_tasks,
      detail: "Need cleanup",
      tone: "text-amber-300",
    },
    {
      label: "Interviews",
      value: attention.interviews,
      detail: "In progress",
      tone: "text-emerald-300",
    },
    {
      label: "Active goals",
      value: attention.active_goals,
      detail: `${attention.completed_goals} completed`,
      tone: "text-blue-300",
    },
  ];

  return (
    <div className="space-y-6">
      {nudges.length > 0 && (
        <div className="space-y-2">
          {nudges.map((nudge) => (
            <div
              key={nudge.id}
              className="flex items-start gap-3 rounded-lg border border-[#534AB7]/20 bg-[#534AB7]/10 p-4 text-white/90 shadow-md"
            >
              <Bell className="mt-0.5 h-4 w-4 shrink-0 text-[#AFA9EC]" />
              <p className="flex-1 text-sm">{nudge.message}</p>
              <button
                className="shrink-0 text-xs text-white/40 underline transition-colors hover:text-white"
                onClick={() => dismissNudge(nudge.id)}
              >
                Dismiss
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Applications This Week"
          value={snapshot?.applications_sent ?? 0}
          helper="Saved roles do not count"
          icon={Send}
          iconClassName="text-blue-300"
        />
        <MetricCard
          title="Active Pipeline"
          value={activeApplications}
          helper="Applied, interviewing, or offer"
          icon={Briefcase}
          iconClassName="text-[#AFA9EC]"
        />
        <MetricCard
          title="Task Completion"
          value={`${snapshot?.roadmap_pct ?? 0}%`}
          helper="Based on completed tasks"
          icon={Target}
          iconClassName="text-emerald-300"
          progress={snapshot?.roadmap_pct ?? 0}
        />
        <MetricCard
          title="Task Streak"
          value={`${snapshot?.streak_days ?? 0}d`}
          helper="Consecutive days with a done task"
          icon={Flame}
          iconClassName="text-orange-300"
        />
      </div>

      <Card className="border border-white/[0.06] bg-[#0E0E12] shadow-xl shadow-black/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-bold text-white">
            <AlertTriangle className="h-4 w-4 text-amber-300" />
            What Needs Attention
          </CardTitle>
        </CardHeader>
        <CardContent>
          {attentionItems.some((item) => item.value > 0) ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              {attentionItems.map((item) => (
                <div
                  key={item.label}
                  className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-3"
                >
                  <div className={`text-2xl font-bold ${item.tone}`}>
                    {item.value}
                  </div>
                  <div className="mt-1 text-xs font-semibold text-white/70">
                    {item.label}
                  </div>
                  <div className="mt-0.5 text-xs text-white/35">
                    {item.detail}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-lg border border-emerald-400/10 bg-emerald-400/5 p-4">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-300" />
              <div>
                <p className="text-sm font-semibold text-white">
                  No urgent blockers right now.
                </p>
                <p className="mt-0.5 text-xs text-white/40">
                  Keep the pipeline moving by applying to one strong saved role or finishing a small task.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {totalApplications === 0 && (
        <div className="rounded-lg border border-[#534AB7]/20 bg-[#534AB7]/10 p-4">
          <p className="text-sm font-semibold text-white">No applications tracked yet.</p>
          <p className="mt-1 text-xs text-white/45">
            Save a job from the Job Hunter page or move a saved role into Applied to start building dashboard history.
          </p>
        </div>
      )}

      <Card className="border border-white/[0.06] bg-[#0E0E12] shadow-xl shadow-black/30">
        <CardHeader>
          <CardTitle className="text-base font-bold text-white">Application Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {statusItems.map((item) => {
              const Icon = item.icon;
              const count = statusCounts[item.key];
              return (
                <div
                  key={item.key}
                  className="flex flex-col items-center gap-1.5 rounded-lg border border-white/[0.04] bg-white/[0.02] p-4 transition-all hover:bg-white/[0.04]"
                >
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${item.bg}`}>
                    <Icon className={`h-4 w-4 ${item.color}`} />
                  </div>
                  <span className="text-2xl font-bold text-white">{count}</span>
                  <span className="text-xs font-medium text-white/40">{item.label}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <DashboardChartCard title="Applications Per Week" icon={Send}>
          {history.length > 0 ? (
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={history} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
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
                  allowDecimals={false}
                />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Bar dataKey="applications_sent" name="Applications" fill="#7C74DB" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChartMessage message="Weekly history appears after snapshots are saved." />
          )}
        </DashboardChartCard>

        <DashboardChartCard title="Status Breakdown" icon={BarChart2}>
          {statusChartData.some((d) => d.count > 0) ? (
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={statusChartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  dataKey="label"
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
                <Bar dataKey="count" name="Applications" fill="#AFA9EC" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChartMessage message="Track applications to see the pipeline breakdown." />
          )}
        </DashboardChartCard>

        <DashboardChartCard title="Fit Score Distribution" icon={Target}>
          {distribution.some((d) => d.count > 0) ? (
            <ResponsiveContainer width="100%" height={190}>
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
                <Bar dataKey="count" name="Jobs" fill="#534AB7" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChartMessage message="Search for jobs to see fit score data." />
          )}
        </DashboardChartCard>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  helper,
  icon: Icon,
  iconClassName,
  progress,
}: {
  title: string;
  value: string | number;
  helper: string;
  icon: ElementType;
  iconClassName: string;
  progress?: number;
}) {
  return (
    <Card className="border border-white/[0.06] bg-[#0E0E12] shadow-xl shadow-black/30">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-semibold text-white/60">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${iconClassName}`} />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-white">{value}</div>
        <p className="mt-1 text-xs text-white/30">{helper}</p>
        {typeof progress === "number" && (
          <div className="mt-3.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#534AB7] to-[#7C74DB] transition-all duration-700"
              style={{ width: `${Math.max(0, Math.min(progress, 100))}%` }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DashboardChartCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: ElementType;
  children: ReactNode;
}) {
  return (
    <Card className="border border-white/[0.06] bg-[#0E0E12] shadow-xl shadow-black/30">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-bold text-white">
          <Icon className="h-4 w-4 text-[#7C74DB]" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function EmptyChartMessage({ message }: { message: string }) {
  return (
    <div className="flex h-[190px] items-center justify-center px-6 text-center text-sm text-white/25">
      {message}
    </div>
  );
}
