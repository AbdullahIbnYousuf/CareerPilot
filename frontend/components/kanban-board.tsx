"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import type { Application, ApplicationStatus } from "@/types";
import {
  Loader2,
  GripVertical,
  Trash2,
  Briefcase,
  Send,
  Users,
  Trophy,
  XCircle,
} from "lucide-react";

const STATUSES = [
  { key: "saved", label: "Saved", icon: Briefcase, color: "bg-slate-400" },
  { key: "applied", label: "Applied", icon: Send, color: "bg-blue-400" },
  {
    key: "interviewing",
    label: "Interviewing",
    icon: Users,
    color: "bg-amber-400",
  },
  { key: "offer", label: "Offer", icon: Trophy, color: "bg-emerald-400" },
  { key: "rejected", label: "Rejected", icon: XCircle, color: "bg-red-400" },
] as const;

export function KanbanBoard() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
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
    fetchApplications(userId);
  }, [userId]);

  const fetchApplications = async (activeUserId: string) => {
    try {
      const res = await fetch(`${baseUrl}/tracker/${activeUserId}`);
      if (res.ok) {
        const data = await res.json();
        setApplications(data.applications || []);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  const moveApplication = async (
    appId: string,
    newStatus: ApplicationStatus,
  ) => {
    setUpdatingId(appId);
    try {
      const res = await fetch(`${baseUrl}/tracker/${appId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setApplications((prev) =>
          prev.map((a) => (a.id === appId ? { ...a, status: newStatus } : a)),
        );
      }
    } catch {
      // silently fail
    } finally {
      setUpdatingId(null);
    }
  };

  const deleteApplication = async (appId: string) => {
    try {
      await fetch(`${baseUrl}/tracker/${appId}`, { method: "DELETE" });
      setApplications((prev) => prev.filter((a) => a.id !== appId));
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {STATUSES.map((status) => {
        const columnApps = applications.filter((a) => a.status === status.key);

        return (
          <div key={status.key} className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <div className={`h-2 w-2 rounded-full ${status.color}`} />
              <h3 className="text-sm font-bold text-white">{status.label}</h3>
              <div className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-white/70">
                {columnApps.length}
              </div>
            </div>

            <div className="space-y-2.5 min-h-[200px] p-2.5 rounded-2xl bg-[#0E0E12]/80 backdrop-blur-md border border-white/[0.04]">
              {columnApps.length === 0 && (
                <p className="text-xs text-white/20 text-center py-10">
                  No applications
                </p>
              )}

              {columnApps.map((app) => (
                <Card key={app.id} className="bg-[#141418] border border-white/[0.06] rounded-xl p-3 shadow-md shadow-black/20 hover:border-white/[0.12] transition-all">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <GripVertical className="h-3.5 w-3.5 text-white/20 shrink-0" />
                      <span className="truncate font-bold text-xs text-white/95">
                        {app.job_id.slice(0, 8)}...
                      </span>
                    </div>
                    <button
                      onClick={() => deleteApplication(app.id)}
                      className="h-6 w-6 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-lg flex items-center justify-center shrink-0 transition-all"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Move buttons */}
                  <div className="flex flex-wrap gap-1 mt-2.5">
                    {STATUSES.filter((s) => s.key !== app.status).map((s) => (
                      <button
                        key={s.key}
                        disabled={updatingId === app.id}
                        onClick={() => moveApplication(app.id, s.key)}
                        className="h-5 text-[9px] px-1.5 rounded-md border border-white/[0.04] bg-[#1E1B3A]/30 text-white/60 hover:text-white hover:bg-[#1E1B3A]/70 disabled:opacity-40 transition-all font-semibold"
                      >
                        {updatingId === app.id ? (
                          <Loader2 className="h-3 w-3 animate-spin text-[#7C74DB]" />
                        ) : (
                          s.label
                        )}
                      </button>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
