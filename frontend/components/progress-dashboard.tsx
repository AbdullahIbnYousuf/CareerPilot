"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import type { Snapshot, StatusCounts, Nudge } from "@/types";
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
} from "lucide-react";

export function ProgressDashboard() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [statusCounts, setStatusCounts] = useState<StatusCounts | null>(null);
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  useEffect(() => {
    const loadUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!error) {
        setUserId(data.user?.id ?? null);
      }
    };
    loadUser();
  }, []);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    fetchDashboard(userId);
    fetchNudges(userId);
  }, [userId]);

  const fetchDashboard = async (activeUserId: string) => {
    try {
      const res = await fetch(`${baseUrl}/dashboard/${activeUserId}`);
      if (res.ok) {
        const data = await res.json();
        setSnapshot(data.snapshot);
        setStatusCounts(data.status_counts);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  const fetchNudges = async (activeUserId: string) => {
    try {
      const res = await fetch(`${baseUrl}/dashboard/${activeUserId}/nudges`);
      if (res.ok) {
        const data = await res.json();
        setNudges(data.nudges || []);
      }
    } catch {
      // silently fail
    }
  };

  const dismissNudge = async (nudgeId: string) => {
    try {
      await fetch(`${baseUrl}/dashboard/nudges/${nudgeId}/seen`, {
        method: "PATCH",
      });
      setNudges((prev) => prev.filter((n) => n.id !== nudgeId));
    } catch {
      // silently fail
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-[#7C74DB]" />
      </div>
    );
  }

  const statusItems = [
    { key: "saved", label: "Saved", icon: Briefcase, color: "text-slate-400" },
    { key: "applied", label: "Applied", icon: Send, color: "text-blue-400" },
    {
      key: "interviewing",
      label: "Interview",
      icon: Users,
      color: "text-amber-400",
    },
    { key: "offer", label: "Offer", icon: Trophy, color: "text-emerald-400" },
    {
      key: "rejected",
      label: "Rejected",
      icon: XCircle,
      color: "text-red-400",
    },
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
            <CardTitle className="text-sm font-semibold text-white/60">
              Applications Sent
            </CardTitle>
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
              <span className="text-sm font-normal text-white/40">
                days
              </span>
            </div>
            <p className="text-xs text-white/30 mt-1">Keep it going!</p>
          </CardContent>
        </Card>

        <Card className="bg-[#0E0E12] border border-white/[0.06] rounded-2xl shadow-xl shadow-black/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-white/60">
              Roadmap Progress
            </CardTitle>
            <Target className="h-4 w-4 text-white/30" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white tracking-tight">
              {snapshot?.roadmap_pct ?? 0}%
            </div>
            <div className="mt-3.5 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#534AB7] to-[#7C74DB] transition-all"
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
                  <Icon className={`h-5 w-5 ${item.color}`} />
                  <span className="text-2xl font-bold text-white tracking-tight">{count}</span>
                  <span className="text-xs text-white/40 font-medium">
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
