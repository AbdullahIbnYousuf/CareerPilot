"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  { key: "saved", label: "Saved", icon: Briefcase, color: "bg-slate-500" },
  { key: "applied", label: "Applied", icon: Send, color: "bg-blue-500" },
  { key: "interviewing", label: "Interviewing", icon: Users, color: "bg-amber-500" },
  { key: "offer", label: "Offer", icon: Trophy, color: "bg-emerald-500" },
  { key: "rejected", label: "Rejected", icon: XCircle, color: "bg-red-500" },
] as const;

type ApplicationStatus = (typeof STATUSES)[number]["key"];

interface Application {
  id: string;
  user_id: string;
  job_id: string;
  status: ApplicationStatus;
  applied_at: string;
}

export function KanbanBoard() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const baseUrl =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      const res = await fetch(`${baseUrl}/tracker/test-user-id`);
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
    newStatus: ApplicationStatus
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
          prev.map((a) => (a.id === appId ? { ...a, status: newStatus } : a))
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
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {STATUSES.map((status) => {
        const Icon = status.icon;
        const columnApps = applications.filter(
          (a) => a.status === status.key
        );

        return (
          <div key={status.key} className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <div className={`h-2.5 w-2.5 rounded-full ${status.color}`} />
              <h3 className="text-sm font-semibold">{status.label}</h3>
              <Badge variant="secondary" className="ml-auto text-xs">
                {columnApps.length}
              </Badge>
            </div>

            <div className="space-y-2 min-h-[120px] p-2 rounded-lg bg-muted/30 border border-dashed">
              {columnApps.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6">
                  No applications
                </p>
              )}

              {columnApps.map((app) => (
                <Card key={app.id} className="p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate font-medium text-xs">
                        {app.job_id.slice(0, 8)}...
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => deleteApplication(app.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* Move buttons */}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {STATUSES.filter((s) => s.key !== app.status).map((s) => (
                      <Button
                        key={s.key}
                        variant="outline"
                        size="sm"
                        className="h-6 text-[10px] px-1.5"
                        disabled={updatingId === app.id}
                        onClick={() => moveApplication(app.id, s.key)}
                      >
                        {updatingId === app.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          s.label
                        )}
                      </Button>
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
