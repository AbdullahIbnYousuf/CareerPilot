"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

interface Snapshot {
  applications_sent: number;
  streak_days: number;
  roadmap_pct: number;
}

interface StatusCounts {
  saved: number;
  applied: number;
  interviewing: number;
  offer: number;
  rejected: number;
}

interface Nudge {
  id: string;
  message: string;
  seen: boolean;
}

export function ProgressDashboard() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [statusCounts, setStatusCounts] = useState<StatusCounts | null>(null);
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [loading, setLoading] = useState(true);

  const baseUrl =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  useEffect(() => {
    fetchDashboard();
    fetchNudges();
  }, []);

  const fetchDashboard = async () => {
    try {
      const res = await fetch(`${baseUrl}/dashboard/test-user-id`);
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

  const fetchNudges = async () => {
    try {
      const res = await fetch(`${baseUrl}/dashboard/test-user-id/nudges`);
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
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const statusItems = [
    { key: "saved", label: "Saved", icon: Briefcase, color: "text-slate-500" },
    { key: "applied", label: "Applied", icon: Send, color: "text-blue-500" },
    { key: "interviewing", label: "Interview", icon: Users, color: "text-amber-500" },
    { key: "offer", label: "Offer", icon: Trophy, color: "text-emerald-500" },
    { key: "rejected", label: "Rejected", icon: XCircle, color: "text-red-500" },
  ] as const;

  return (
    <div className="space-y-6">
      {/* AI Nudges */}
      {nudges.length > 0 && (
        <div className="space-y-2">
          {nudges.map((nudge) => (
            <div
              key={nudge.id}
              className="flex items-start gap-3 p-4 rounded-lg bg-primary/5 border border-primary/20"
            >
              <Bell className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <p className="text-sm flex-1">{nudge.message}</p>
              <button
                className="text-xs text-muted-foreground hover:text-foreground underline shrink-0"
                onClick={() => dismissNudge(nudge.id)}
              >
                Dismiss
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Applications Sent
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {snapshot?.applications_sent ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">This week</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Daily Streak
            </CardTitle>
            <Flame className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {snapshot?.streak_days ?? 0}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                days
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Keep it going!</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Roadmap Progress
            </CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {snapshot?.roadmap_pct ?? 0}%
            </div>
            <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${snapshot?.roadmap_pct ?? 0}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Application Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {statusItems.map((item) => {
              const Icon = item.icon;
              const count =
                statusCounts?.[item.key as keyof StatusCounts] ?? 0;
              return (
                <div
                  key={item.key}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-muted/40"
                >
                  <Icon className={`h-5 w-5 ${item.color}`} />
                  <span className="text-2xl font-bold">{count}</span>
                  <span className="text-xs text-muted-foreground">
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
