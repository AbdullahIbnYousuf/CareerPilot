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
import { takeApplicationNoteDraft } from "@/lib/copilot/drafts";
import { FitScoreBadge } from "./fit-score-badge";
import type { Application, ApplicationStatus, Todo } from "@/types";
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
  Sparkles,
  CalendarPlus,
  CheckCircle2,
  MapPin,
  Building2,
  DollarSign,
  Calendar,
  BookmarkCheck,
  X,
} from "lucide-react";

// â”€â”€â”€ Column config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
    color: "bg-[var(--cp-status-saved)]",
    glow: "border-[var(--cp-border-medium)]",
    bg: "bg-white/[0.03]",
  },
  {
    key: "applied",
    label: "Applied",
    icon: Send,
    color: "bg-[var(--cp-status-applied)]",
    glow: "border-[var(--cp-border-medium)]",
    bg: "bg-[rgba(224,164,106,0.08)]",
  },
  {
    key: "interviewing",
    label: "Interviewing",
    icon: Users,
    color: "bg-[var(--cp-status-interviewing)]",
    glow: "border-[rgba(244,201,93,0.25)]",
    bg: "bg-[rgba(244,201,93,0.08)]",
  },
  {
    key: "offer",
    label: "Offer",
    icon: Trophy,
    color: "bg-[var(--cp-status-offer)]",
    glow: "border-[rgba(61,220,151,0.25)]",
    bg: "bg-[rgba(61,220,151,0.08)]",
  },
  {
    key: "rejected",
    label: "Rejected",
    icon: XCircle,
    color: "bg-[var(--cp-status-rejected)]",
    glow: "border-[rgba(255,107,107,0.25)]",
    bg: "bg-[rgba(255,107,107,0.08)]",
  },
];

// â”€â”€â”€ Sortable Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type ActionPromptState = {
  type: "follow_up" | "interview_prep";
  app: Application;
  dueDate: string;
};

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseDateOrToday(value?: string | null): Date {
  if (!value) return new Date();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let added = 0;

  while (added < days) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) added += 1;
  }

  return result;
}

function ApplicationCard({
  app,
  onDelete,
  onClick,
  isDragging = false,
}: {
  app: Application;
  onDelete: (id: string) => void;
  onClick?: () => void;
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
      ? "text-[var(--cp-text-subtle)]"
      : score >= 85
        ? "text-[var(--cp-fit-high)]"
        : score >= 70
          ? "text-[var(--cp-champagne)]"
          : score >= 55
            ? "text-[var(--cp-fit-good)]"
            : score >= 40
              ? "text-[var(--cp-fit-mid)]"
              : "text-[var(--cp-fit-low)]";

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onClick}
      className={`group relative rounded-xl border border-[var(--cp-border-soft)] bg-[var(--cp-surface-elevated)] p-3.5 shadow-md shadow-black/20 transition-all duration-200 cursor-pointer ${
        isDragging
          ? "shadow-2xl shadow-[var(--cp-glow-copper)] border-[var(--cp-border-strong)] rotate-1 scale-105"
          : "hover:border-[var(--cp-border-medium)] hover:shadow-lg hover:shadow-black/30"
      }`}
    >
      {/* Drag handle + title row */}
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="mt-0.5 cursor-grab active:cursor-grabbing text-[var(--cp-text-subtle)] hover:text-[var(--cp-text-soft)] transition-colors shrink-0 touch-none"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-[var(--cp-text-main)] leading-snug line-clamp-2">
            {app.title || "Unknown Role"}
          </p>
          <p className="text-xs text-[var(--cp-text-muted)] mt-0.5 truncate">
            {app.company || "Unknown Company"}
          </p>
          {app.location && (
            <p className="text-[10px] text-[var(--cp-text-subtle)] truncate mt-0.5">
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
      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-[var(--cp-border-soft)]">
        {/* Applied date */}
        <span className="text-[10px] text-[var(--cp-text-subtle)]">
          {app.applied_at
            ? new Date(app.applied_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })
            : "â€”"}
        </span>

        <div className="flex items-center gap-2">
          {/* Fit score chip */}
          {score !== undefined && score !== null && (
            <span className={`text-[10px] font-bold ${scoreColor}`}>
              {score}% fit
            </span>
          )}

          {/* External link / Apply text button - only for saved column */}
          {app.status === "saved" && (
            <a
              href={app.url || `https://www.google.com/search?q=${encodeURIComponent(`${app.title || "Job"} ${app.company || ""}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold text-[var(--cp-champagne)] hover:bg-[rgba(201,130,74,0.12)] transition-all border border-[var(--cp-border-soft)] hover:border-[var(--cp-border-medium)] bg-white/[0.02]"
              aria-label="Open job posting"
            >
              Apply <ExternalLink className="h-2.5 w-2.5 shrink-0" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// â”€â”€â”€ Column â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function KanbanColumn({
  column,
  apps,
  onDelete,
  onCardClick,
}: {
  column: (typeof COLUMNS)[0];
  apps: Application[];
  onDelete: (id: string) => void;
  onCardClick: (app: Application) => void;
}) {
  const Icon = column.icon;
  const { setNodeRef, isOver } = useDroppable({ id: column.key });

  return (
    <div
      ref={setNodeRef}
      className={`cp-panel-solid flex flex-col min-h-[500px] rounded-2xl transition-all duration-200 ${
        isOver
          ? `${column.glow} ${column.bg} shadow-lg`
          : ""
      }`}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 px-3.5 py-3 border-b border-[var(--cp-border-soft)]">
        <div className={`h-2 w-2 rounded-full ${column.color}`} />
        <Icon className="h-3.5 w-3.5 text-[var(--cp-text-muted)]" />
        <h3 className="text-sm font-bold text-[var(--cp-text-main)] flex-1">{column.label}</h3>
        <div className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/[0.04] border border-[var(--cp-border-soft)] text-[var(--cp-text-soft)] min-w-[1.5rem] text-center">
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
            <div className="flex flex-col items-center justify-center h-32 gap-2 rounded-xl border border-dashed border-[var(--cp-border-medium)] bg-[rgba(201,130,74,0.035)]">
              <div className="h-8 w-8 rounded-xl bg-[rgba(201,130,74,0.12)] flex items-center justify-center">
                <BookmarkCheck className="h-4 w-4 text-[var(--cp-champagne)]" />
              </div>
              <p className="text-[11px] text-[var(--cp-text-muted)] text-center">
                Drop cards here
              </p>
            </div>
          ) : (
            apps.map((app) => (
              <ApplicationCard key={app.id} app={app} onDelete={onDelete} onClick={() => onCardClick(app)} />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
}

// â”€â”€â”€ Main Kanban Board â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ApplicationActionPrompt({
  prompt,
  isCreating,
  error,
  onDueDateChange,
  onCreate,
  onDismiss,
}: {
  prompt: ActionPromptState;
  isCreating: boolean;
  error: string;
  onDueDateChange: (dueDate: string) => void;
  onCreate: () => void;
  onDismiss: () => void;
}) {
  const isFollowUp = prompt.type === "follow_up";

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[var(--cp-border-medium)] bg-[rgba(201,130,74,0.08)] p-3.5 shadow-lg shadow-black/20 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[rgba(201,130,74,0.14)] text-[var(--cp-champagne)]">
          <CalendarPlus className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--cp-text-main)]">
            CareerPilot guide - {isFollowUp ? "Follow up on strong matches this week." : "Prepare for this interview stage."}
          </p>
          <p className="mt-0.5 truncate text-xs text-[var(--cp-text-muted)]">
            {prompt.app.title || "Application"} at{" "}
            {prompt.app.company || "Unknown Company"}
          </p>
          {error && <p className="mt-1 text-xs text-red-300">{error}</p>}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="date"
          value={prompt.dueDate}
          onChange={(e) => onDueDateChange(e.target.value)}
          className="h-9 rounded-xl border border-[var(--cp-border-soft)] bg-white/[0.04] px-3 text-xs text-[var(--cp-text-soft)] transition-all [color-scheme:dark] focus:border-primary/50 focus:outline-none"
          aria-label={
            isFollowUp ? "Follow-up task due date" : "Interview prep due date"
          }
        />
        <button
          type="button"
          onClick={onCreate}
          disabled={isCreating}
          className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[var(--cp-border-strong)] bg-gradient-to-r from-[var(--cp-copper-deep)] to-[var(--cp-copper-strong)] px-3 text-xs font-semibold text-[var(--cp-bg-deep)] transition-all hover:brightness-110 disabled:opacity-50"
        >
          {isCreating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5" />
          )}
          {isFollowUp ? "Add task" : "Add tasks"}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="h-9 rounded-xl bg-white/[0.04] px-3 text-xs font-semibold text-[var(--cp-text-muted)] transition-all hover:text-[var(--cp-text-main)]"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

interface ApplicationEvent {
  id: string;
  event_type: "created" | "status_changed" | "note_updated";
  from_status?: string | null;
  to_status?: string | null;
  note?: string | null;
  created_at: string;
}

interface JobDetails {
  description?: string | null;
  salary_range?: string | null;
  fit_explanation?: string | null;
}

const htmlEntities: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeHtml(value: string) {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity.startsWith("#x")) {
      const cp = Number.parseInt(entity.slice(2), 16);
      return Number.isNaN(cp) ? match : String.fromCodePoint(cp);
    }
    if (entity.startsWith("#")) {
      const cp = Number.parseInt(entity.slice(1), 10);
      return Number.isNaN(cp) ? match : String.fromCodePoint(cp);
    }
    return htmlEntities[entity] ?? match;
  });
}

function cleanDesc(raw: string | null | undefined) {
  if (!raw) return "";
  const withBreaks = raw.replace(/<\/?(?:br|p|div|li|ul|ol|section|article|h[1-4])[^>]*>/gi, "\n");
  return decodeHtml(withBreaks.replace(/<[^>]+>/g, " "))
    .replace(/\u00a0/g, " ")
    .replace(/[ \t\r\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function capitalize(s?: string | null) {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}
interface KanbanBoardProps {
  onTodosCreated?: (todos: Todo[]) => void;
  onTodosChange?: () => void;
}

export function KanbanBoard({
  onTodosCreated,
  onTodosChange,
}: KanbanBoardProps = {}) {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [activeApp, setActiveApp] = useState<Application | null>(null);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [actionPrompt, setActionPrompt] = useState<ActionPromptState | null>(
    null
  );
  const [creatingTasks, setCreatingTasks] = useState(false);
  const [actionPromptError, setActionPromptError] = useState("");
  const [actionNotice, setActionNotice] = useState("");

  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [events, setEvents] = useState<ApplicationEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [eventsRefreshKey, setEventsRefreshKey] = useState(0);
  const [notesSaveError, setNotesSaveError] = useState("");
  const [notesSaved, setNotesSaved] = useState(false);
  const [jobDetails, setJobDetails] = useState<JobDetails | null>(null);
  const [loadingJobDetails, setLoadingJobDetails] = useState(false);

  const closeDetails = useCallback(() => {
    setSelectedApp(null);
    setEvents([]);
    setNotesSaveError("");
    setNotesSaved(false);
    setJobDetails(null);
  }, []);

  useEffect(() => {
    if (!selectedApp) return;
    const loadEvents = async () => {
      setLoadingEvents(true);
      try {
        const res = await fetch(`${baseUrl}/tracker/applications/${selectedApp.id}/events`);
        if (res.ok) {
          const data = await res.json();
          setEvents(data.events || []);
        }
      } catch {
        // silently fail
      } finally {
        setLoadingEvents(false);
      }
    };
    void loadEvents();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedApp?.id, baseUrl, eventsRefreshKey]);

  // Fetch full job details (description, salary, fit explanation) when modal opens
  useEffect(() => {
    if (!selectedApp?.job_id) return;
    const loadJobDetails = async () => {
      setLoadingJobDetails(true);
      try {
        const res = await fetch(`${baseUrl}/jobs/${selectedApp.job_id}/details`);
        if (res.ok) {
          const data = await res.json() as JobDetails;
          setJobDetails(data);
        }
      } catch {
        // silently fail â€” modal still works without these extras
      } finally {
        setLoadingJobDetails(false);
      }
    };
    void loadJobDetails();
  }, [selectedApp?.job_id, baseUrl]);

  const handleSaveNotes = async () => {
    if (!selectedApp) return;
    setSavingNotes(true);
    setNotesSaveError("");
    setNotesSaved(false);
    try {
      const res = await fetch(`${baseUrl}/tracker/applications/${selectedApp.id}/notes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      if (res.ok) {
        const data = await res.json();
        const updated = data.application as Application;
        setApplications((prev) =>
          prev.map((a) => (a.id === selectedApp.id ? { ...a, notes: updated.notes } : a))
        );
        setSelectedApp((prev) => (prev ? { ...prev, notes: updated.notes } : null));
        setEventsRefreshKey((k) => k + 1);
        setNotesSaved(true);
        setTimeout(() => setNotesSaved(false), 2500);
      } else {
        const errData = await res.json().catch(() => ({})) as { detail?: string };
        setNotesSaveError(errData.detail || `Save failed (${res.status})`);
      }
    } catch (err) {
      setNotesSaveError(err instanceof Error ? err.message : "Network error â€” check connection.");
    } finally {
      setSavingNotes(false);
    }
  };
  // â”€â”€ Sensors â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  // â”€â”€ Load user â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    supabase.auth.getUser().then(({ data, error }) => {
      if (!error) {
        setUserId(data.user?.id ?? null);
        if (!data.user) setLoading(false);
      }
    });
  }, []);

  // â”€â”€ Fetch applications â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
        // silently fail â€” Realtime will keep us in sync
      } finally {
        setLoading(false);
      }
    },
    [baseUrl]
  );

  useEffect(() => {
    if (!userId) return;
    const loadApplications = async () => {
      await fetchApplications(userId);
    };
    void loadApplications();
  }, [userId, fetchApplications]);

  useEffect(() => {
    if (applications.length === 0) return;

    const draft = takeApplicationNoteDraft();
    if (!draft) return;

    const timeoutId = window.setTimeout(() => {
      const application = applications.find((app) => app.id === draft.application_id);
      if (!application) {
        setActionNotice("CareerPilot could not find that application note draft.");
        window.setTimeout(() => setActionNotice(""), 3500);
        return;
      }

      const existingNotes = application.notes?.trim();
      setSelectedApp(application);
      setNotes(existingNotes ? `${existingNotes}\n\n${draft.note}` : draft.note);
      setActionNotice("CareerPilot filled a note draft. Review it, then click Save.");
      window.setTimeout(() => setActionNotice(""), 4500);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [applications]);

  // â”€â”€ Supabase Realtime â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
                a.id === updated.id
                  ? {
                      ...a,
                      status: updated.status,
                      applied_at: updated.applied_at ?? a.applied_at,
                      notes: updated.notes !== undefined ? updated.notes : a.notes,
                    }
                  : a
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

  // â”€â”€ Delete â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const deleteApplication = async (appId: string) => {
    // Optimistic
    setApplications((prev) => prev.filter((a) => a.id !== appId));
    setActionPrompt((prev) => (prev?.app.id === appId ? null : prev));
    try {
      await fetch(`${baseUrl}/tracker/applications/${appId}`, {
        method: "DELETE",
      });
    } catch {
      // silently fail
    }
  };

  // â”€â”€ DnD handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // Determine target column â€” overedId is either a column key or a card id
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
        return;
      }

      const data = (await res.json().catch(() => ({}))) as {
        application?: Partial<Application>;
      };
      const updatedApp: Application = {
        ...draggedApp,
        ...data.application,
        status: data.application?.status ?? targetColumn,
        applied_at:
          data.application?.applied_at ??
          (targetColumn === "saved"
            ? null
            : draggedApp.applied_at ?? new Date().toISOString()),
      };

      setApplications((prev) =>
        prev.map((a) => (a.id === draggedId ? updatedApp : a))
      );
      setActionPromptError("");
      setActionNotice("");

      if (targetColumn === "applied") {
        setActionPrompt({
          type: "follow_up",
          app: updatedApp,
          dueDate: toLocalDateStr(
            addBusinessDays(parseDateOrToday(updatedApp.applied_at), 5)
          ),
        });
      } else if (targetColumn === "interviewing") {
        setActionPrompt({
          type: "interview_prep",
          app: updatedApp,
          dueDate: toLocalDateStr(addBusinessDays(new Date(), 1)),
        });
      } else {
        setActionPrompt((prev) =>
          prev?.app.id === draggedId ? null : prev
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

  // â”€â”€ Loading â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const createTodo = async (title: string, dueDate: string): Promise<Todo> => {
    if (!userId) throw new Error("Please sign in to create tasks.");

    const res = await fetch(`${baseUrl}/tracker/todos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        title,
        due_date: dueDate || null,
        goal_id: null,
      }),
    });

    if (!res.ok) {
      throw new Error("Task creation failed.");
    }

    const data = (await res.json()) as { todo?: Todo };
    if (!data.todo) {
      throw new Error("Task creation failed.");
    }

    return data.todo;
  };

  const handleCreatePromptTasks = async () => {
    if (!actionPrompt) return;

    setCreatingTasks(true);
    setActionPromptError("");
    try {
      let createdTodos: Todo[] = [];
      if (actionPrompt.type === "follow_up") {
        const todo = await createTodo("Follow up with recruiter", actionPrompt.dueDate);
        createdTodos = [todo];
        setActionNotice("Follow-up task added.");
      } else {
        createdTodos = await Promise.all(
          [
            "Research company",
            "Practice role-specific questions",
            "Prepare STAR stories",
          ].map((title) => createTodo(title, actionPrompt.dueDate))
        );
        setActionNotice("Interview prep tasks added.");
      }

      onTodosCreated?.(createdTodos);
      onTodosChange?.();
      setActionPrompt(null);
      setTimeout(() => setActionNotice(""), 3500);
    } catch (error) {
      setActionPromptError(
        error instanceof Error ? error.message : "Could not create tasks."
      );
    } finally {
      setCreatingTasks(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-white/30">Loading your applicationsâ€¦</p>
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
          <p className="text-sm text-[var(--cp-text-muted)]">
            <span className="text-[var(--cp-text-main)] font-semibold">{totalApps}</span>{" "}
            application{totalApps !== 1 ? "s" : ""} tracked
          </p>
          {/* Realtime indicator */}
          <div className="flex items-center gap-1.5">
            <div
              className={`h-1.5 w-1.5 rounded-full transition-colors ${
                realtimeConnected ? "bg-emerald-400" : "bg-white/20"
              }`}
            />
            <span className="text-[10px] text-[var(--cp-text-subtle)]">
              {realtimeConnected ? "Live" : "Offline"}
            </span>
          </div>
        </div>

        {totalApps === 0 && (
          <div className="flex items-center gap-1.5 text-xs text-[var(--cp-text-muted)]">
            <Sparkles className="h-3.5 w-3.5" />
            Search jobs and click &ldquo;Save&rdquo; to start tracking
          </div>
        )}
      </div>

      {actionNotice && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {actionNotice}
        </div>
      )}

      {actionPrompt && (
        <ApplicationActionPrompt
          prompt={actionPrompt}
          isCreating={creatingTasks}
          error={actionPromptError}
          onDueDateChange={(dueDate) =>
            setActionPrompt((prev) =>
              prev ? { ...prev, dueDate } : prev
            )
          }
          onCreate={() => {
            void handleCreatePromptTasks();
          }}
          onDismiss={() => {
            setActionPrompt(null);
            setActionPromptError("");
          }}
        />
      )}

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
                onCardClick={(app) => {
                  setSelectedApp(app);
                  setNotes(app.notes || "");
                }}
              />
            );
          })}
        </div>

        {/* Drag overlay â€” card ghost that follows cursor */}
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

      {selectedApp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={(e) => e.target === e.currentTarget && closeDetails()}
        >
          <div className="w-full max-w-2xl max-h-[88vh] flex flex-col rounded-2xl border border-white/[0.08] bg-[#0E0E12] shadow-2xl shadow-black/60 overflow-hidden">

            {/* â”€â”€ Header (exact Job Hunter modal header) â”€â”€ */}
            <div className="flex justify-between items-start p-6 border-b border-white/[0.06] bg-white/[0.02]">
              <div className="flex-1 min-w-0 pr-4">
                {/* Status + source badge row */}
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] text-white/20 bg-white/[0.05] px-2 py-0.5 rounded font-mono uppercase tracking-wider">
                    {selectedApp.status}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-white mt-1 leading-snug">{selectedApp.title || "Unknown Role"}</h2>
                <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-white/40">
                  <span className="flex items-center gap-1.5 text-white/70 font-medium">
                    <Building2 className="h-4 w-4 text-white/30" /> {selectedApp.company}
                  </span>
                  {selectedApp.location && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4" /> {selectedApp.location}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={closeDetails}
                className="h-8 w-8 flex items-center justify-center rounded-lg border border-white/[0.08] text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* â”€â”€ Scrollable body â”€â”€ */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">

              {/* Fit score panel â€” exact Job Hunter style using FitScoreBadge */}
              {selectedApp.fit_score !== undefined && selectedApp.fit_score !== null ? (
                <div className="flex flex-col md:flex-row gap-4 items-center md:items-start rounded-xl bg-primary/5 border border-primary/15 p-4">
                  <div className="shrink-0">
                    <FitScoreBadge score={selectedApp.fit_score} explanation={jobDetails?.fit_explanation ?? undefined} />
                  </div>
                  <div className="space-y-1 text-center md:text-left flex-1">
                    <p className="text-xs font-semibold text-primary uppercase tracking-wider">Fit Match</p>
                    {loadingJobDetails ? (
                      <div className="flex items-center gap-1.5 text-xs text-white/30">
                        <Loader2 className="h-3 w-3 animate-spin" /> Loading analysis...
                      </div>
                    ) : jobDetails?.fit_explanation ? (
                      <p className="text-sm text-white/60 italic leading-relaxed">
                        &ldquo;{jobDetails.fit_explanation}&rdquo;
                      </p>
                    ) : (
                      <p className="text-xs text-white/30 italic">Run &ldquo;Check My Fit Score&rdquo; in Job Hunter to see analysis here.</p>
                    )}
                  </div>
                </div>
              ) : null}

              {/* Quick info â€” salary / deadline / applied (exact Job Hunter grid) */}
              <div className="grid grid-cols-2 gap-4 rounded-xl bg-white/[0.03] border border-white/[0.05] p-4 text-xs">
                <div className="space-y-1">
                  <span className="text-white/30 block">Salary Range</span>
                  <span className="text-white font-semibold flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5 text-primary" />
                    {loadingJobDetails ? "â€¦" : (jobDetails?.salary_range || "Not Disclosed")}
                  </span>
                </div>
                <div className="space-y-1 pl-4 border-l border-white/[0.05]">
                  <span className="text-white/30 block">Deadline</span>
                  <span className="text-white font-semibold flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-primary" />
                    {selectedApp.deadline || "Rolling / Open"}
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-white/30 block">Applied</span>
                  <span className="text-white font-semibold">
                    {selectedApp.applied_at
                      ? new Date(selectedApp.applied_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                      : "Not yet"}
                  </span>
                </div>
                <div className="space-y-1 pl-4 border-l border-white/[0.05]">
                  <span className="text-white/30 block">Job Link</span>
                  <a
                    href={selectedApp.url || `https://www.google.com/search?q=${encodeURIComponent(`${selectedApp.title || "Job"} ${selectedApp.company || ""}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[var(--cp-champagne)] hover:text-[var(--cp-copper-strong)] hover:underline font-semibold"
                  >
                    Open Posting <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>

              {/* â”€â”€ Notes (app-specific) â”€â”€ */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] font-bold text-white/30 uppercase tracking-wider">My Notes</h3>
                  <button
                    onClick={handleSaveNotes}
                    disabled={savingNotes}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--cp-border-strong)] bg-gradient-to-r from-[var(--cp-copper-deep)] to-[var(--cp-copper-strong)] text-xs font-semibold text-[var(--cp-bg-deep)] transition-all hover:brightness-110 disabled:opacity-50"
                  >
                    {savingNotes && <Loader2 className="h-3 w-3 animate-spin" />}
                    Save
                  </button>
                </div>
                <textarea
                  id="app-modal-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Interview dates, recruiter contacts, prep notes, links..."
                  className="w-full min-h-[80px] rounded-xl border border-[var(--cp-border-soft)] bg-[var(--cp-bg-deep)] px-3 py-2.5 text-sm text-[var(--cp-text-main)] placeholder:text-[var(--cp-text-subtle)] transition-all focus:border-primary/50 focus:outline-none resize-y"
                />
                {notesSaved && (
                  <p className="text-[11px] text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Notes saved
                  </p>
                )}
                {notesSaveError && (
                  <p className="text-[11px] text-red-400">{notesSaveError}</p>
                )}
              </div>

              {/* â”€â”€ Activity History (app-specific) â”€â”€ */}
              <div className="space-y-2">
                <h3 className="text-[11px] font-bold text-white/30 uppercase tracking-wider flex items-center gap-1.5">
                  Activity History
                </h3>
                {loadingEvents ? (
                  <div className="flex items-center gap-2 text-xs text-white/30 py-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading history...
                  </div>
                ) : events.length === 0 ? (
                  <p className="text-xs text-white/20 italic py-1">No activity recorded yet. Move this card between columns to log history.</p>
                ) : (
                  <div className="relative border-l border-white/[0.06] ml-2 pl-4 py-1 space-y-3.5">
                    {events.map((ev) => (
                      <div key={ev.id} className="relative">
                        <div className="absolute -left-[21px] top-1 h-2 w-2 rounded-full border border-white/10 bg-[var(--cp-copper-strong)]" />
                        <p className="text-xs font-semibold text-white/80">
                          {ev.event_type === "created" && `Created in ${capitalize(ev.to_status) || "Saved"}`}
                          {ev.event_type === "status_changed" && `Moved from ${capitalize(ev.from_status)} to ${capitalize(ev.to_status)}`}
                          {ev.event_type === "note_updated" && "Notes updated"}
                        </p>
                        <p className="text-[10px] text-white/30 mt-0.5">
                          {new Date(ev.created_at).toLocaleString("en-US", {
                            month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                          })}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* â”€â”€ Job Description (at the bottom, exact Job Hunter style) â”€â”€ */}
              <div className="space-y-2">
                <h3 className="text-[11px] font-bold text-white/30 uppercase tracking-wider flex items-center gap-1.5">
                  <Briefcase className="h-3.5 w-3.5" /> Job Description
                </h3>
                {loadingJobDetails ? (
                  <div className="flex items-center gap-2 rounded-xl bg-white/[0.02] border border-white/[0.05] p-4 text-xs text-white/30">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading...
                  </div>
                ) : (jobDetails?.description) ? (
                  <div className="rounded-xl bg-white/[0.02] border border-white/[0.05] p-4 text-sm text-white/50 leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
                    {cleanDesc(jobDetails.description) || jobDetails.description}
                  </div>
                ) : (
                  <p className="text-xs text-white/20 italic">No description stored for this job.</p>
                )}
              </div>
            </div>

            {/* â”€â”€ Footer (exact Job Hunter modal footer) â”€â”€ */}
            <div className="p-4 border-t border-white/[0.06] flex flex-col-reverse gap-2 bg-white/[0.02] sm:flex-row sm:justify-end">
              <button
                onClick={closeDetails}
                className="inline-flex items-center justify-center rounded-lg border border-white/[0.08] text-sm font-medium px-4 py-2 text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors sm:mr-auto"
              >
                Close
              </button>
              <span className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-sm font-medium px-4 py-2">
                <BookmarkCheck className="h-4 w-4 shrink-0" /> Saved to Tracker
              </span>
              {selectedApp.status === "saved" && (
                <a
                  href={selectedApp.url || `https://www.google.com/search?q=${encodeURIComponent(`${selectedApp.title || "Job"} ${selectedApp.company || ""}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 whitespace-nowrap items-center justify-center gap-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-sm font-medium px-4 py-2 transition-colors duration-150"
                >
                  Apply Now <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
