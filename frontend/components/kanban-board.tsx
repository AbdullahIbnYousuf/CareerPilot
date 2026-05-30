"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
  ExternalLink,
  Plus,
  Sparkles,
} from "lucide-react";

// ─── Column config ──────────────────────────────────────────────────────────

const COLUMNS: {
  key: ApplicationStatus;
  label: string;
  icon: React.ElementType;
  color: string;
  glow: string;
  bg: string;
}[] = [
  {
    key: "saved",
    label: "Saved",
    icon: Briefcase,
    color: "bg-slate-400",
    glow: "border-slate-400/20",
    bg: "bg-slate-400/5",
  },
  {
    key: "applied",
    label: "Applied",
    icon: Send,
    color: "bg-blue-400",
    glow: "border-blue-400/20",
    bg: "bg-blue-400/5",
  },
  {
    key: "interviewing",
    label: "Interviewing",
    icon: Users,
    color: "bg-amber-400",
    glow: "border-amber-400/20",
    bg: "bg-amber-400/5",
  },
  {
    key: "offer",
    label: "Offer",
    icon: Trophy,
    color: "bg-emerald-400",
    glow: "border-emerald-400/20",
    bg: "bg-emerald-400/5",
  },
  {
    key: "rejected",
    label: "Rejected",
    icon: XCircle,
    color: "bg-red-400",
    glow: "border-red-400/20",
    bg: "bg-red-400/5",
  },
];

// ─── Sortable Card ───────────────────────────────────────────────────────────

function ApplicationCard({
  app,
  onDelete,
  isDragging = false,
}: {
  app: Application;
  onDelete: (id: string) => void;
  isDragging?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: app.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.35 : 1,
  };

  const score = app.fit_score;
  const scoreColor =
    score === undefined || score === null
      ? "text-white/30"
      : score >= 70
        ? "text-emerald-400"
        : score >= 40
          ? "text-amber-400"
          : "text-red-400";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative rounded-xl border border-white/[0.06] bg-[#141418] p-3.5 shadow-md shadow-black/20 transition-all duration-200 ${
        isDragging
          ? "shadow-2xl shadow-primary/20 border-primary/40 rotate-1 scale-105"
          : "hover:border-white/[0.12] hover:shadow-lg hover:shadow-black/30"
      }`}
    >
      {/* Drag handle + title row */}
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 cursor-grab active:cursor-grabbing text-white/20 hover:text-white/50 transition-colors shrink-0 touch-none"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-white/95 leading-snug line-clamp-2">
            {app.title || "Unknown Role"}
          </p>
          <p className="text-xs text-white/40 mt-0.5 truncate">
            {app.company || "Unknown Company"}
          </p>
          {app.location && (
            <p className="text-[10px] text-white/25 truncate mt-0.5">
              {app.location}
            </p>
          )}
        </div>

        {/* Delete button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(app.id);
          }}
          className="opacity-0 group-hover:opacity-100 h-6 w-6 shrink-0 flex items-center justify-center rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all"
          aria-label="Remove application"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      {/* Footer row */}
      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-white/[0.04]">
        {/* Applied date */}
        <span className="text-[10px] text-white/20">
          {app.applied_at
            ? new Date(app.applied_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })
            : "—"}
        </span>

        <div className="flex items-center gap-2">
          {/* Fit score chip */}
          {score !== undefined && score !== null && (
            <span className={`text-[10px] font-bold ${scoreColor}`}>
              {score}% fit
            </span>
          )}

          {/* External link */}
          {app.url && (
            <a
              href={app.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="h-5 w-5 flex items-center justify-center rounded-md text-white/20 hover:text-primary hover:bg-primary/10 transition-all"
              aria-label="Open job posting"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Column ──────────────────────────────────────────────────────────────────

function KanbanColumn({
  column,
  apps,
  onDelete,
}: {
  column: (typeof COLUMNS)[0];
  apps: Application[];
  onDelete: (id: string) => void;
}) {
  const Icon = column.icon;
  const { setNodeRef, isOver } = useDroppable({ id: column.key });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col min-h-[500px] rounded-2xl border transition-all duration-200 ${
        isOver
          ? `${column.glow} ${column.bg} shadow-lg`
          : "border-white/[0.04] bg-[#0E0E12]/60"
      }`}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 px-3.5 py-3 border-b border-white/[0.04]">
        <div className={`h-2 w-2 rounded-full ${column.color}`} />
        <Icon className="h-3.5 w-3.5 text-white/40" />
        <h3 className="text-sm font-bold text-white flex-1">{column.label}</h3>
        <div className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-white/50 min-w-[1.5rem] text-center">
          {apps.length}
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 p-2.5 space-y-2.5 overflow-y-auto">
        <SortableContext
          items={apps.map((a) => a.id)}
          strategy={verticalListSortingStrategy}
        >
          {apps.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2">
              <div className="h-8 w-8 rounded-xl bg-white/[0.03] flex items-center justify-center">
                <Plus className="h-4 w-4 text-white/10" />
              </div>
              <p className="text-[11px] text-white/15 text-center">
                Drop cards here
              </p>
            </div>
          ) : (
            apps.map((app) => (
              <ApplicationCard key={app.id} app={app} onDelete={onDelete} />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
}

// ─── Main Kanban Board ────────────────────────────────────────────────────────

export function KanbanBoard() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [activeApp, setActiveApp] = useState<Application | null>(null);
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  // ── Sensors ────────────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  // ── Load user ──────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data, error }) => {
      if (!error) setUserId(data.user?.id ?? null);
    });
  }, []);

  // ── Fetch applications ────────────────────────────────────────────────────
  const fetchApplications = useCallback(
    async (uid: string) => {
      try {
        const res = await fetch(
          `${baseUrl}/tracker/applications?user_id=${uid}`
        );
        if (res.ok) {
          const data = await res.json();
          setApplications(data.applications || []);
        }
      } catch {
        // silently fail — Realtime will keep us in sync
      } finally {
        setLoading(false);
      }
    },
    [baseUrl]
  );

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    fetchApplications(userId);
  }, [userId, fetchApplications]);

  // ── Supabase Realtime ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`applications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "applications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            // Re-fetch to get joined job metadata
            fetchApplications(userId);
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as Application;
            setApplications((prev) =>
              prev.map((a) =>
                a.id === updated.id ? { ...a, status: updated.status } : a
              )
            );
          } else if (payload.eventType === "DELETE") {
            const deleted = payload.old as { id: string };
            setApplications((prev) => prev.filter((a) => a.id !== deleted.id));
          }
        }
      )
      .subscribe((status) => {
        setRealtimeConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
      setRealtimeConnected(false);
    };
  }, [userId, fetchApplications]);

  // ── Delete ─────────────────────────────────────────────────────────────────
  const deleteApplication = async (appId: string) => {
    // Optimistic
    setApplications((prev) => prev.filter((a) => a.id !== appId));
    try {
      await fetch(`${baseUrl}/tracker/applications/${appId}`, {
        method: "DELETE",
      });
    } catch {
      // silently fail
    }
  };

  // ── DnD handlers ──────────────────────────────────────────────────────────
  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.id as string;
    setActiveApp(applications.find((a) => a.id === id) ?? null);
  };


  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveApp(null);

    const { active, over } = event;
    if (!over) return;

    const draggedId = active.id as string;
    const overedId = over.id as string;

    // Determine target column — overedId is either a column key or a card id
    const targetColumn = COLUMNS.find((c) => c.key === overedId)
      ? (overedId as ApplicationStatus)
      : applications.find((a) => a.id === overedId)?.status ?? null;

    if (!targetColumn) return;

    const draggedApp = applications.find((a) => a.id === draggedId);
    if (!draggedApp || draggedApp.status === targetColumn) return;

    // Optimistic update
    setApplications((prev) =>
      prev.map((a) =>
        a.id === draggedId ? { ...a, status: targetColumn } : a
      )
    );

    // Persist to backend
    try {
      const res = await fetch(
        `${baseUrl}/tracker/applications/${draggedId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: targetColumn }),
        }
      );
      if (!res.ok) {
        // Revert on failure
        setApplications((prev) =>
          prev.map((a) =>
            a.id === draggedId ? { ...a, status: draggedApp.status } : a
          )
        );
      }
    } catch {
      // Revert on failure
      setApplications((prev) =>
        prev.map((a) =>
          a.id === draggedId ? { ...a, status: draggedApp.status } : a
        )
      );
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-white/30">Loading your applications…</p>
        </div>
      </div>
    );
  }

  const totalApps = applications.length;

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="text-sm text-white/40">
            <span className="text-white font-semibold">{totalApps}</span>{" "}
            application{totalApps !== 1 ? "s" : ""} tracked
          </p>
          {/* Realtime indicator */}
          <div className="flex items-center gap-1.5">
            <div
              className={`h-1.5 w-1.5 rounded-full transition-colors ${
                realtimeConnected ? "bg-emerald-400" : "bg-white/20"
              }`}
            />
            <span className="text-[10px] text-white/20">
              {realtimeConnected ? "Live" : "Offline"}
            </span>
          </div>
        </div>

        {totalApps === 0 && (
          <div className="flex items-center gap-1.5 text-xs text-white/25">
            <Sparkles className="h-3.5 w-3.5" />
            Search jobs and click &ldquo;Save&rdquo; to start tracking
          </div>
        )}
      </div>

      {/* Kanban grid */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {COLUMNS.map((col) => {
            const colApps = applications.filter((a) => a.status === col.key);

            return (
              <KanbanColumn
                key={col.key}
                column={col}
                apps={colApps}
                onDelete={deleteApplication}
              />
            );
          })}
        </div>

        {/* Drag overlay — card ghost that follows cursor */}
        <DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
          {activeApp ? (
            <ApplicationCard
              app={activeApp}
              onDelete={() => {}}
              isDragging
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
