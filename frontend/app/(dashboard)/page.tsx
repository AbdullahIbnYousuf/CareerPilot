"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { NudgeBanner } from "@/components/nudge-banner";
import { JobCard } from "@/components/job-card";
import type { Snapshot, StatusCounts, Nudge, Job } from "@/types";
import {
  LayoutDashboard,
  TrendingUp,
  Flame,
  Target,
  Sparkles,
  Send,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function HomePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [statusCounts, setStatusCounts] = useState<StatusCounts | null>(null);
  const [newMatches, setNewMatches] = useState<number>(0);
  const [topJobs, setTopJobs] = useState<Job[]>([]);
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [loading, setLoading] = useState(true);

  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  // ── Fetch dashboard data ──────────────────────────────────────────────────
  const fetchDashboard = useCallback(async (uid: string) => {
    try {
      const res = await fetch(`${baseUrl}/dashboard/${uid}`);
      if (res.ok) {
        const data = await res.json();
        setSnapshot(data.snapshot);
        setStatusCounts(data.status_counts);
        setNewMatches(data.new_matches ?? 0);
      }
    } catch { /* silently fail */ }
  }, [baseUrl]);

  const fetchNudges = useCallback(async (uid: string) => {
    try {
      const res = await fetch(`${baseUrl}/dashboard/${uid}/nudges`);
      if (res.ok) {
        const data = await res.json();
        setNudges(data.nudges || []);
      }
    } catch { /* silently fail */ }
  }, [baseUrl]);

  const fetchTopJobs = useCallback(async (uid: string) => {
    try {
      // Pull top-3 highest fit score jobs from Supabase directly
      const { data } = await supabase
        .from("jobs")
        .select("id, title, company, location, fit_score, fit_explanation, source, url, description, salary_range, deadline")
        .eq("user_id", uid)
        .order("fit_score", { ascending: false })
        .limit(3);
      if (data) setTopJobs(data as Job[]);
    } catch { /* silently fail */ }
  }, []);

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const loadUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data.user) {
        setUserId(data.user.id);
      }
    };
    loadUser();
  }, []);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    Promise.all([
      fetchDashboard(userId),
      fetchNudges(userId),
      fetchTopJobs(userId),
    ]).finally(() => setLoading(false));
  }, [userId, fetchDashboard, fetchNudges, fetchTopJobs]);

  // ── Realtime — nudges table INSERT ────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel("home-nudges")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "nudges",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNudge = payload.new as Nudge;
          setNudges((prev) => [newNudge, ...prev]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  // ── Dismiss nudge ─────────────────────────────────────────────────────────
  const dismissNudge = async (nudgeId: string) => {
    try {
      await fetch(`${baseUrl}/dashboard/nudges/${nudgeId}/seen`, { method: "PATCH" });
    } catch { /* silently fail */ }
    setNudges((prev) => prev.filter((n) => n.id !== nudgeId));
  };

  // ── Stat cards config ─────────────────────────────────────────────────────
  const stats = [
    {
      label: "Applications Sent",
      value: snapshot?.applications_sent ?? 0,
      suffix: "",
      icon: Send,
      iconColor: "text-blue-400",
      iconBg: "bg-blue-400/10",
      sub: "This week",
    },
    {
      label: "Roadmap Progress",
      value: snapshot?.roadmap_pct ?? 0,
      suffix: "%",
      icon: Target,
      iconColor: "text-[#AFA9EC]",
      iconBg: "bg-[#534AB7]/10",
      sub: "Career roadmap",
      progress: snapshot?.roadmap_pct ?? 0,
    },
    {
      label: "New Matches",
      value: newMatches,
      suffix: "",
      icon: Sparkles,
      iconColor: "text-emerald-400",
      iconBg: "bg-emerald-400/10",
      sub: "Fit score ≥ 70%",
    },
    {
      label: "Daily Streak",
      value: snapshot?.streak_days ?? 0,
      suffix: " days",
      icon: Flame,
      iconColor: "text-orange-400",
      iconBg: "bg-orange-400/10",
      sub: "Keep it going!",
    },
  ];

  return (
    <div className="space-y-8">
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
          Your career at a glance — stats, top matches, and AI nudges.
        </p>
      </div>

      {/* AI Nudge banners — Realtime */}
      {nudges.length > 0 && (
        <div className="space-y-2">
          {nudges.map((nudge) => (
            <NudgeBanner
              key={nudge.id}
              message={nudge.message}
              onDismiss={() => dismissNudge(nudge.id)}
            />
          ))}
        </div>
      )}

      {/* Stats grid */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin text-[#7C74DB]" />
        </div>
      ) : (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card
                key={stat.label}
                className="bg-[#0E0E12] border border-white/[0.06] rounded-2xl shadow-xl shadow-black/30 hover:border-white/[0.10] transition-all duration-200"
              >
                <CardHeader className="flex flex-row items-start justify-between pb-2 pt-5 px-5">
                  <CardTitle className="text-xs font-semibold text-white/50 leading-tight">
                    {stat.label}
                  </CardTitle>
                  <div className={`h-7 w-7 rounded-lg ${stat.iconBg} flex items-center justify-center shrink-0`}>
                    <Icon className={`h-3.5 w-3.5 ${stat.iconColor}`} />
                  </div>
                </CardHeader>
                <CardContent className="px-5 pb-5">
                  <div className="text-3xl font-bold text-white tracking-tight">
                    {stat.value}
                    <span className="text-lg font-normal text-white/50">{stat.suffix}</span>
                  </div>
                  {"progress" in stat && (
                    <div className="mt-2.5 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#534AB7] to-[#7C74DB] transition-all duration-700"
                        style={{ width: `${stat.progress}%` }}
                      />
                    </div>
                  )}
                  <p className="text-xs text-white/30 mt-1.5">{stat.sub}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Top job matches */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Top Job Matches</h2>
            <p className="text-xs text-white/30 mt-0.5">Highest fit scores from your last search</p>
          </div>
          <Link
            href="/jobs"
            className="flex items-center gap-1.5 text-xs font-semibold text-[#AFA9EC] hover:text-white transition-colors"
          >
            Find more <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-[#7C74DB]" />
          </div>
        ) : topJobs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {topJobs.map((job, i) => (
              <JobCard key={job.id ?? i} job={job} />
            ))}
          </div>
        ) : (
          <div className="flex h-[200px] items-center justify-center rounded-2xl border border-dashed border-white/[0.06]">
            <div className="flex flex-col items-center gap-3 text-center max-w-xs">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-primary/20 to-primary/10 flex items-center justify-center shadow-lg shadow-primary/10">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-white/50">No matches yet</p>
                <p className="text-sm text-white/25 mt-1">
                  Search for jobs to see your top AI-scored matches here.
                </p>
              </div>
              <Link
                href="/jobs"
                className="mt-1 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#534AB7]/20 hover:bg-[#534AB7]/30 text-[#AFA9EC] text-xs font-semibold transition-all"
              >
                Start Searching <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { href: "/jobs", label: "Hunt Jobs", icon: Sparkles, color: "from-[#534AB7]/20 to-[#7C74DB]/10 border-[#534AB7]/20 text-[#AFA9EC]" },
          { href: "/ai", label: "Ask AI", icon: TrendingUp, color: "from-emerald-500/10 to-emerald-500/5 border-emerald-500/20 text-emerald-400" },
          { href: "/tracker", label: "My Journey", icon: Target, color: "from-amber-500/10 to-amber-500/5 border-amber-500/20 text-amber-400" },
          { href: "/profile", label: "My Profile", icon: Send, color: "from-blue-500/10 to-blue-500/5 border-blue-500/20 text-blue-400" },
        ].map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className={`flex items-center gap-2.5 p-4 rounded-xl bg-gradient-to-br border ${action.color} hover:scale-[1.02] transition-all duration-200 font-medium text-sm`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {action.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
