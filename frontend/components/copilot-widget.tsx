"use client";

import {
  FormEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Bot,
  Calendar,
  ChevronDown,
  CheckCircle2,
  ExternalLink,
  Loader2,
  MapPin,
  Maximize2,
  MessageSquare,
  Minus,
  Navigation,
  Plus,
  Search,
  Send,
  Target,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { supabase } from "@/lib/supabase";
import {
  buildCopilotContext,
  buildJobSearchHref,
  isAllowedCopilotHref,
  validateCopilotAction,
} from "@/lib/copilot/app-map";
import { getCopilotActionSuccessMessage } from "@/lib/copilot/action-guidance";
import { saveApplicationNoteDraft, saveGoalsTasksDraft } from "@/lib/copilot/drafts";
import type {
  CareerPreferences,
  CopilotAction,
  CopilotClientContext,
  CopilotGuideState,
  CopilotGuideStep,
  CopilotOnboardingState,
  CopilotProfileStatus,
  CopilotValidatedAction,
} from "@/types";

type PanelState = "closed" | "open" | "minimized";
type LocalMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions?: CopilotAction[];
};
type ChatMessageRow = {
  id: string;
  role: "user" | "assistant";
  content: string;
};
type ChatSessionRow = {
  id: string;
  title: string | null;
  created_at: string | null;
  updated_at: string | null;
};
type ChatSessionSummary = {
  id: string;
  title: string;
  updatedAt: string;
};
type ActionExecutionState = {
  status: "idle" | "loading" | "success" | "error";
  message?: string;
  href?: string;
};
type PanelPosition = {
  x: number;
  y: number;
};

const ACTION_PATTERN = /<careerpilot_action>\s*([\s\S]*?)\s*<\/careerpilot_action>/g;
const ONBOARDING_PATTERN = /<careerpilot_onboarding>\s*([\s\S]*?)\s*<\/careerpilot_onboarding>/g;
const DEFAULT_SESSION_TITLE = "New conversation";
const COPILOT_SESSION_KEY_PREFIX = "careerpilot:copilot-chat:";
const ACTIVE_SESSION_KEY_PREFIX = "careerpilot:active-chat:";
const ACTIVE_CHAT_CHANGED_EVENT = "careerpilot:active-chat-changed";

const DEFAULT_ONBOARDING: CopilotOnboardingState = {
  completed: false,
  name: "",
  targetRoles: [],
  location: "",
  workMode: "",
  careerStage: "",
  lastStep: "name",
  updatedAt: "",
};

const DEFAULT_PREFERENCES: CareerPreferences = {
  user_id: "",
  preferred_name: null,
  target_roles: [],
  preferred_locations: [],
  work_modes: [],
  seniority: null,
  weekly_capacity_hours: null,
  target_start_date: null,
  industries: [],
  updated_at: null,
};

const PANEL_MARGIN = 16;
const DESKTOP_PANEL_WIDTH = 390;
const MOBILE_PANEL_GUTTER = 24;

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function messageId(): string {
  return `copilot-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function onboardingKey(userId: string): string {
  return `careerpilot:onboarding:v1:${userId}`;
}

function copilotSessionKey(userId: string): string {
  return `${COPILOT_SESSION_KEY_PREFIX}${userId}`;
}

function activeSessionStorageKey(userId: string): string {
  return `${ACTIVE_SESSION_KEY_PREFIX}${userId}`;
}

function dispatchActiveChatChanged(userId: string, sessionId: string): void {
  window.dispatchEvent(
    new CustomEvent(ACTIVE_CHAT_CHANGED_EVENT, {
      detail: { userId, sessionId },
    }),
  );
}

function normalizeOnboarding(value: unknown): CopilotOnboardingState {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ...DEFAULT_ONBOARDING };
  }

  const data = value as Partial<CopilotOnboardingState>;
  return {
    completed: Boolean(data.completed),
    name: typeof data.name === "string" ? data.name : "",
    targetRoles: Array.isArray(data.targetRoles)
      ? data.targetRoles.filter((item): item is string => typeof item === "string")
      : [],
    location: typeof data.location === "string" ? data.location : "",
    workMode: typeof data.workMode === "string" ? data.workMode : "",
    careerStage: typeof data.careerStage === "string" ? data.careerStage : "",
    lastStep: data.lastStep ?? "name",
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : "",
  };
}

function initialAssistantContent(onboarding: CopilotOnboardingState): string {
  if (onboarding.completed) {
    const name = onboarding.name ? `, ${onboarding.name}` : "";
    return `Welcome back${name}. What should we move forward today?`;
  }

  return "Hi, I am CareerPilot. I will help turn your CV into job matches, applications, goals, and next steps. What can I call you?";
}

function initialAssistantMessage(onboarding: CopilotOnboardingState): LocalMessage {
  return {
    id: messageId(),
    role: "assistant",
    content: initialAssistantContent(onboarding),
  };
}

function stripHiddenDirectives(content: string): string {
  return content.replace(ACTION_PATTERN, "").replace(ONBOARDING_PATTERN, "").trim();
}

function extractActions(content: string): CopilotAction[] {
  const actions: CopilotAction[] = [];
  const matches = content.matchAll(ACTION_PATTERN);

  for (const match of matches) {
    try {
      const parsed = JSON.parse(match[1]) as unknown;
      const action = validateCopilotAction(parsed);
      if (action) actions.push(action);
    } catch {
      continue;
    }
  }

  return actions;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

function normalizeName(value: unknown): string | undefined {
  const cleaned = cleanText(value);
  if (!cleaned) return undefined;

  const lower = cleaned.toLowerCase();
  const looksLikeSentence =
    /\s/.test(cleaned) &&
    !/^[a-z]+(?:[-'][a-z]+)?(?:\s+[a-z]+(?:[-'][a-z]+)?){0,2}$/i.test(cleaned);
  if (looksLikeSentence || /^(hi|hello|hey|my name|i am|i'm|im)\b/.test(lower)) {
    return undefined;
  }

  return cleaned
    .split(" ")
    .slice(0, 3)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeRoles(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const roles = value
    .map(cleanText)
    .filter((item): item is string => Boolean(item))
    .slice(0, 4);
  return roles.length > 0 ? roles : undefined;
}

function normalizeWorkMode(value: unknown): string | undefined {
  const cleaned = cleanText(value)?.toLowerCase();
  if (!cleaned) return undefined;
  if (cleaned === "onsite") return "on-site";
  if (["remote", "hybrid", "on-site", "any"].includes(cleaned)) return cleaned;
  return undefined;
}

function deriveLastStep(onboarding: CopilotOnboardingState): CopilotOnboardingState["lastStep"] {
  if (onboarding.completed) return "complete";
  if (!onboarding.name) return "name";
  if (onboarding.targetRoles.length === 0) return "target_role";
  if (!onboarding.location && !onboarding.workMode) return "location_work_mode";
  if (!onboarding.careerStage) return "career_stage";
  return "complete";
}

function applyOnboardingPatch(
  current: CopilotOnboardingState,
  patch: Record<string, unknown>,
): CopilotOnboardingState {
  const next: CopilotOnboardingState = {
    ...current,
    updatedAt: new Date().toISOString(),
  };

  const name = normalizeName(patch.name);
  if (name) next.name = name;

  const targetRoles = normalizeRoles(patch.targetRoles ?? patch.target_roles);
  if (targetRoles) next.targetRoles = targetRoles;

  const location = cleanText(patch.location);
  if (location) next.location = location;

  const workMode = normalizeWorkMode(patch.workMode ?? patch.work_mode);
  if (workMode) next.workMode = workMode;

  const careerStage = cleanText(patch.careerStage ?? patch.career_stage);
  if (careerStage) next.careerStage = careerStage;

  const hasRequiredFields =
    Boolean(next.name) &&
    next.targetRoles.length > 0 &&
    Boolean(next.location || next.workMode) &&
    Boolean(next.careerStage);
  next.completed = patch.completed === true && hasRequiredFields ? true : hasRequiredFields;
  next.lastStep = deriveLastStep(next);

  return next;
}

function mergePreferencesIntoOnboarding(
  current: CopilotOnboardingState,
  preferences: CareerPreferences,
): CopilotOnboardingState {
  const next: CopilotOnboardingState = {
    ...current,
    name: current.name || preferences.preferred_name || "",
    targetRoles: current.targetRoles.length > 0 ? current.targetRoles : preferences.target_roles,
    location: current.location || preferences.preferred_locations[0] || "",
    workMode: current.workMode || preferences.work_modes[0] || "",
    updatedAt: new Date().toISOString(),
  };
  next.completed =
    Boolean(next.name) &&
    next.targetRoles.length > 0 &&
    Boolean(next.location || next.workMode) &&
    Boolean(next.careerStage);
  next.lastStep = deriveLastStep(next);
  return next;
}

function mergeCopilotStateIntoOnboarding(
  current: CopilotOnboardingState,
  state?: CopilotGuideState | null,
): CopilotOnboardingState {
  if (!state?.onboarding) return current;
  const onboarding = state.onboarding;
  const next: CopilotOnboardingState = {
    ...current,
    name: current.name || onboarding.name || "",
    targetRoles:
      current.targetRoles.length > 0
        ? current.targetRoles
        : onboarding.targetRoles ?? [],
    location: current.location || onboarding.location || "",
    workMode: current.workMode || onboarding.workMode || "",
    careerStage: current.careerStage || onboarding.careerStage || "",
    completed: Boolean(onboarding.completed) || current.completed,
    updatedAt: new Date().toISOString(),
  };
  next.lastStep = deriveLastStep(next);
  return next;
}

function extractOnboardingPatch(content: string): Record<string, unknown> | null {
  let patch: Record<string, unknown> | null = null;
  const matches = content.matchAll(ONBOARDING_PATTERN);

  for (const match of matches) {
    try {
      const parsed = JSON.parse(match[1]) as unknown;
      if (isPlainObject(parsed)) {
        patch = { ...(patch ?? {}), ...parsed };
      }
    } catch {
      continue;
    }
  }

  return patch;
}

function formatDraftDate(date?: string | null): string {
  if (!date) return "No date";
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function mapChatSession(row: ChatSessionRow): ChatSessionSummary {
  return {
    id: row.id,
    title: row.title || DEFAULT_SESSION_TITLE,
    updatedAt: row.updated_at ?? row.created_at ?? new Date().toISOString(),
  };
}

function sortChatSessions(sessions: ChatSessionSummary[]): ChatSessionSummary[] {
  return [...sessions].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

function truncateSessionTitle(title: string, limit = 30): string {
  const cleaned = title.trim() || DEFAULT_SESSION_TITLE;
  return cleaned.length > limit ? `${cleaned.slice(0, limit)}...` : cleaned;
}

function guideStepForPath(pathname: string): CopilotGuideStep | null {
  if (pathname.startsWith("/cv")) return "profile_setup";
  if (pathname.startsWith("/jobs")) return "job_search";
  if (pathname.startsWith("/tracker")) return "today";
  return null;
}

export function CopilotWidget() {
  const pathname = usePathname();
  const router = useRouter();
  const [panelState, setPanelState] = useState<PanelState>("minimized");
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [isSessionMenuOpen, setIsSessionMenuOpen] = useState(false);
  const [profileStatus, setProfileStatus] = useState<CopilotProfileStatus>("unknown");
  const [onboarding, setOnboarding] = useState<CopilotOnboardingState>(DEFAULT_ONBOARDING);
  const [preferences, setPreferences] = useState<CareerPreferences | null>(null);
  const [copilotState, setCopilotState] = useState<CopilotGuideState | null>(null);
  const [actionStates, setActionStates] = useState<Record<string, ActionExecutionState>>({});
  const [connectionError, setConnectionError] = useState("");
  const [panelPosition, setPanelPosition] = useState<PanelPosition | null>(null);
  const [triggerPosition, setTriggerPosition] = useState<PanelPosition | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sessionIdRef = useRef(generateUUID());
  const dragRef = useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
    width: number;
    height: number;
  } | null>(null);
  const triggerDragRef = useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
    width: number;
    height: number;
    moved: boolean;
  } | null>(null);

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const isFullAssistantPage = pathname === "/chat" || pathname.startsWith("/chat/");

  const clampPanelPosition = useCallback((x: number, y: number, width: number, height: number) => {
    const maxX = Math.max(PANEL_MARGIN, window.innerWidth - width - PANEL_MARGIN);
    const maxY = Math.max(PANEL_MARGIN, window.innerHeight - height - PANEL_MARGIN);
    return {
      x: Math.min(Math.max(PANEL_MARGIN, x), maxX),
      y: Math.min(Math.max(PANEL_MARGIN, y), maxY),
    };
  }, []);

  const setDefaultPanelPosition = useCallback(() => {
    const width = Math.min(DESKTOP_PANEL_WIDTH, window.innerWidth - MOBILE_PANEL_GUTTER);
    const height = Math.min(680, window.innerHeight - 96);
    setPanelPosition(
      clampPanelPosition(
        window.innerWidth - width - 24,
        window.innerHeight - height - 24,
        width,
        height,
      ),
    );
  }, [clampPanelPosition]);

  const setDefaultTriggerPosition = useCallback(() => {
    const width = 144;
    const height = 48;
    setTriggerPosition(
      clampPanelPosition(
        window.innerWidth - width - 24,
        window.innerHeight - height - 96,
        width,
        height,
      ),
    );
  }, [clampPanelPosition]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  useEffect(() => {
    if (panelState !== "open") return;

    if (!panelPosition) {
      const timeoutId = window.setTimeout(setDefaultPanelPosition, 0);
      return () => window.clearTimeout(timeoutId);
    }
  }, [panelPosition, panelState, setDefaultPanelPosition]);

  useEffect(() => {
    if (panelState === "open") return;

    if (!triggerPosition) {
      const timeoutId = window.setTimeout(setDefaultTriggerPosition, 0);
      return () => window.clearTimeout(timeoutId);
    }
  }, [panelState, setDefaultTriggerPosition, triggerPosition]);

  useEffect(() => {
    if (panelState !== "open") return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (panelRef.current?.contains(target)) return;
      setIsSessionMenuOpen(false);
      setPanelState("minimized");
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [panelState]);

  useEffect(() => {
    const handleResize = () => {
      const panel = panelRef.current;
      if (panel) {
        const rect = panel.getBoundingClientRect();
        setPanelPosition((current) =>
          current
            ? clampPanelPosition(current.x, current.y, rect.width, rect.height)
            : current,
        );
      }

      setTriggerPosition((current) =>
        current ? clampPanelPosition(current.x, current.y, 144, 48) : current,
      );
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [clampPanelPosition]);

  const loadSessionMessages = useCallback(
    async (id: string, sessionId: string, greetingOnboarding: CopilotOnboardingState) => {
      const { data: messageRows } = await supabase
        .from("chat_messages")
        .select("id, role, content")
        .eq("user_id", id)
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true })
        .limit(50);

      const persistedMessages = ((messageRows as ChatMessageRow[] | null) ?? [])
        .filter((row) => row.role === "user" || row.role === "assistant")
        .map((row) => ({
          id: row.id,
          role: row.role,
          content: row.content,
        }));

      setActionStates({});

      if (persistedMessages.length > 0) {
        setMessages(persistedMessages);
        return;
      }

      const greeting = initialAssistantMessage(greetingOnboarding);
      setMessages([greeting]);

      await supabase.from("chat_messages").insert({
        user_id: id,
        session_id: sessionId,
        role: "assistant",
        content: greeting.content,
      });
    },
    [],
  );

  const loadChatSessions = useCallback(async (id: string) => {
    const { data } = await supabase
      .from("chat_sessions")
      .select("id, title, created_at, updated_at")
      .eq("user_id", id)
      .order("updated_at", { ascending: false });

    const loadedSessions = sortChatSessions(((data as ChatSessionRow[] | null) ?? []).map(mapChatSession));
    setSessions(loadedSessions);
    return loadedSessions;
  }, []);

  const activateSession = useCallback(
    async (id: string, sessionId: string, greetingOnboarding: CopilotOnboardingState) => {
      const { data: sessionRows } = await supabase
        .from("chat_sessions")
        .select("id, title, created_at, updated_at")
        .eq("user_id", id)
        .eq("id", sessionId)
        .limit(1);

      const sessionExists = ((sessionRows as ChatSessionRow[] | null) ?? []).length > 0;
      if (!sessionExists) return false;

      sessionIdRef.current = sessionId;
      setActiveSessionId(sessionId);
      window.localStorage.setItem(activeSessionStorageKey(id), sessionId);
      window.localStorage.setItem(copilotSessionKey(id), sessionId);
      setSessions((current) =>
        sortChatSessions([
          ...((sessionRows as ChatSessionRow[] | null) ?? []).map(mapChatSession),
          ...current.filter((session) => session.id !== sessionId),
        ]),
      );
      await loadSessionMessages(id, sessionId, greetingOnboarding);
      return true;
    },
    [loadSessionMessages],
  );

  useEffect(() => {
    const loadUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        setUserId(null);
        return;
      }

      const id = data.user.id;
      setUserId(id);

      const stored = window.localStorage.getItem(onboardingKey(id));
      let parsed = { ...DEFAULT_ONBOARDING };
      if (stored) {
        try {
          parsed = normalizeOnboarding(JSON.parse(stored) as unknown);
        } catch {
          parsed = { ...DEFAULT_ONBOARDING };
        }
      }
      setOnboarding(parsed);
      setPanelState("minimized");

      try {
        const prefResponse = await fetch(
          `${apiBaseUrl}/copilot/preferences?user_id=${encodeURIComponent(id)}`,
        );
        if (prefResponse.ok) {
          const prefBody = (await prefResponse.json()) as { preferences?: CareerPreferences };
          const loadedPreferences = prefBody.preferences ?? { ...DEFAULT_PREFERENCES, user_id: id };
          setPreferences(loadedPreferences);
          const merged = mergePreferencesIntoOnboarding(parsed, loadedPreferences);
          parsed = merged;
          setOnboarding(merged);
        }
      } catch {
        setPreferences({ ...DEFAULT_PREFERENCES, user_id: id });
      }

      try {
        const contextResponse = await fetch(
          `${apiBaseUrl}/copilot/context?user_id=${encodeURIComponent(id)}`,
        );
        if (contextResponse.ok) {
          const body = (await contextResponse.json()) as {
            context?: {
              profile_status?: CopilotProfileStatus;
              copilot?: CopilotGuideState;
            };
          };
          if (body.context?.copilot) {
            setCopilotState(body.context.copilot);
            parsed = mergeCopilotStateIntoOnboarding(parsed, body.context.copilot);
            setOnboarding(parsed);
          }
          if (
            body.context?.profile_status === "has_profile" ||
            body.context?.profile_status === "no_profile"
          ) {
            setProfileStatus(body.context.profile_status);
          }
        }
      } catch {
        /* Context refresh should not block chat startup. */
      }

      const loadedSessions = await loadChatSessions(id);
      const storedActiveSessionId = window.localStorage.getItem(activeSessionStorageKey(id));
      const storedWidgetSessionId = window.localStorage.getItem(copilotSessionKey(id));
      const nextSession =
        loadedSessions.find((session) => session.id === storedActiveSessionId) ??
        loadedSessions.find((session) => session.id === storedWidgetSessionId) ??
        loadedSessions[0];
      let nextSessionId = nextSession?.id ?? generateUUID();
      let sessionReady = Boolean(nextSession);

      if (!sessionReady) {
        nextSessionId = generateUUID();
        const now = new Date().toISOString();
        const { error: insertSessionError } = await supabase.from("chat_sessions").insert({
          id: nextSessionId,
          user_id: id,
          title: DEFAULT_SESSION_TITLE,
          created_at: now,
          updated_at: now,
        });
        sessionReady = !insertSessionError;
        if (sessionReady) {
          setSessions([{ id: nextSessionId, title: DEFAULT_SESSION_TITLE, updatedAt: now }]);
        }
      }

      sessionIdRef.current = nextSessionId;
      setActiveSessionId(nextSessionId);
      window.localStorage.setItem(activeSessionStorageKey(id), nextSessionId);
      window.localStorage.setItem(copilotSessionKey(id), nextSessionId);

      if (sessionReady) {
        await loadSessionMessages(id, nextSessionId, parsed);
      } else {
        setActionStates({});
        setMessages([initialAssistantMessage(parsed)]);
      }

      try {
        const response = await fetch(
          `${apiBaseUrl}/api/cv/profile?user_id=${encodeURIComponent(id)}`,
        );
        if (response.ok) {
          const body = (await response.json()) as { profile?: { active_cv_id?: string | null } | null };
          setProfileStatus(body.profile?.active_cv_id ? "has_profile" : "no_profile");
        } else {
          setProfileStatus("unknown");
        }
      } catch {
        setProfileStatus("unknown");
      }
    };

    void loadUser();
  }, [activateSession, apiBaseUrl, loadChatSessions, loadSessionMessages]);

  useEffect(() => {
    if (!userId) return;

    const syncActiveSession = async (sessionId: string | null) => {
      if (!sessionId || sessionId === sessionIdRef.current) return;
      await activateSession(userId, sessionId, onboarding);
    };

    const handleActiveChatChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ userId?: string; sessionId?: string }>).detail;
      if (detail?.userId !== userId) return;
      void syncActiveSession(detail.sessionId ?? null);
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== activeSessionStorageKey(userId)) return;
      void syncActiveSession(event.newValue);
    };

    window.addEventListener(ACTIVE_CHAT_CHANGED_EVENT, handleActiveChatChanged);
    window.addEventListener("storage", handleStorage);
    void syncActiveSession(window.localStorage.getItem(activeSessionStorageKey(userId)));

    return () => {
      window.removeEventListener(ACTIVE_CHAT_CHANGED_EVENT, handleActiveChatChanged);
      window.removeEventListener("storage", handleStorage);
    };
  }, [activateSession, onboarding, userId]);

  useEffect(() => {
    if (!userId) return;
    window.localStorage.setItem(
      onboardingKey(userId),
      JSON.stringify({ ...onboarding, updatedAt: new Date().toISOString() }),
    );
  }, [onboarding, userId]);

  useEffect(() => {
    if (!userId) return;
    const step = guideStepForPath(pathname);
    if (!step) return;

    const markStep = async () => {
      try {
        const response = await fetch(
          `${apiBaseUrl}/copilot/state?user_id=${encodeURIComponent(userId)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mark_step_complete: step,
              feature_exposure: { feature: pathname },
            }),
          },
        );
        if (response.ok) {
          const body = (await response.json()) as { state?: CopilotGuideState };
          if (body.state) {
            setCopilotState(body.state);
          }
        }
      } catch {
        /* Step tracking is best effort. */
      }
    };

    void markStep();
  }, [apiBaseUrl, pathname, userId]);

  useEffect(() => {
    const handleCvUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ userId: string; cvId: string }>).detail;
      if (!userId || detail?.userId !== userId) return;

      setProfileStatus("has_profile");
      const role = onboarding.targetRoles[0] ?? "software engineer";
      const location = onboarding.location || "Dhaka";
      setMessages((current) => [
        ...current,
        {
          id: messageId(),
          role: "assistant",
          content: "Your profile is ready. I can start a job search with your preferences.",
          actions: [
            {
              type: "prefill_job_search",
              label: `Search ${role} roles`,
              query: role,
              location,
              auto: true,
            },
          ],
        },
      ]);
      setPanelState("minimized");
    };

    window.addEventListener("careerpilot:cv-updated", handleCvUpdated);
    return () => {
      window.removeEventListener("careerpilot:cv-updated", handleCvUpdated);
    };
  }, [onboarding.location, onboarding.targetRoles, userId]);

  const clientContext = useMemo<CopilotClientContext>(
    () =>
      buildCopilotContext({
        currentPath: pathname,
        profileStatus,
        onboarding,
        preferences: preferences ?? undefined,
        copilotState: copilotState ?? undefined,
      }),
    [copilotState, onboarding, pathname, preferences, profileStatus],
  );

  const appendAssistantMessage = useCallback((content: string, actions?: CopilotAction[]) => {
    setMessages((current) => [
      ...current,
      {
        id: messageId(),
        role: "assistant",
        content,
        actions,
      },
    ]);
  }, []);

  const persistPreferencesFromOnboarding = useCallback(
    async (nextOnboarding: CopilotOnboardingState) => {
      if (!userId) return;

      const payload = {
        preferred_name: nextOnboarding.name || undefined,
        target_roles: nextOnboarding.targetRoles,
        preferred_locations: nextOnboarding.location ? [nextOnboarding.location] : [],
        work_modes: nextOnboarding.workMode ? [nextOnboarding.workMode] : [],
        seniority: nextOnboarding.careerStage || undefined,
      };

      try {
        const response = await fetch(
          `${apiBaseUrl}/copilot/preferences?user_id=${encodeURIComponent(userId)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
        );
        if (response.ok) {
          const body = (await response.json()) as { preferences?: CareerPreferences };
          if (body.preferences) setPreferences(body.preferences);
        }
      } catch {
        /* Preference persistence should not block chat. */
      }

      try {
        const response = await fetch(
          `${apiBaseUrl}/copilot/state?user_id=${encodeURIComponent(userId)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              onboarding: nextOnboarding,
              mark_step_complete: nextOnboarding.completed ? "preferences" : "welcome",
            }),
          },
        );
        if (response.ok) {
          const body = (await response.json()) as { state?: CopilotGuideState };
          if (body.state) {
            setCopilotState((current) => ({
              ...(current ?? {
                remaining_steps: [],
                completed_steps: [],
                feature_exposures: {},
                guidance_level: "first_run",
                onboarding: {},
              }),
              ...body.state,
            }));
          }
        }
      } catch {
        /* Copilot state persistence should not block chat. */
      }
    },
    [apiBaseUrl, userId],
  );

  const validateActions = useCallback(
    async (actions: CopilotAction[]): Promise<CopilotAction[]> => {
      if (!userId || actions.length === 0) return [];

      const validated: CopilotAction[] = [];
      for (const action of actions) {
        try {
          const response = await fetch(`${apiBaseUrl}/copilot/actions/validate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_id: userId,
              source: "widget",
              action,
            }),
          });
          if (!response.ok) continue;
          const body = (await response.json()) as CopilotValidatedAction;
          if (body.valid) validated.push(body.action);
        } catch {
          continue;
        }
      }
      return validated;
    },
    [apiBaseUrl, userId],
  );

  const sendChatMessage = useCallback(
    async (text: string) => {
      if (!userId) {
        appendAssistantMessage("Please sign in to use CareerPilot.");
        return;
      }

      setIsStreaming(true);
      setConnectionError("");
      const assistantId = messageId();
      setMessages((current) => [...current, { id: assistantId, role: "assistant", content: "" }]);

      let fullReply = "";
      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: userId,
            session_id: sessionIdRef.current,
            message: text,
            client_context: clientContext,
          }),
        });

        if (!response.ok) throw new Error("Chat request failed");

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response stream");

        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          if (!chunk) continue;
          fullReply += chunk;

          setMessages((current) =>
            current.map((message) =>
              message.id === assistantId
                ? { ...message, content: stripHiddenDirectives(fullReply) }
                : message,
            ),
          );
        }

        const actions = extractActions(fullReply);
        const onboardingPatch = extractOnboardingPatch(fullReply);
        if (onboardingPatch) {
          let nextOnboarding: CopilotOnboardingState | null = null;
          setOnboarding((current) => {
            nextOnboarding = applyOnboardingPatch(current, onboardingPatch);
            return nextOnboarding;
          });
          if (nextOnboarding) {
            void persistPreferencesFromOnboarding(nextOnboarding);
          }
        }
        const validatedActions = await validateActions(actions);
        void loadChatSessions(userId);

        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId
              ? {
                  ...message,
                  content: stripHiddenDirectives(fullReply),
                  actions: validatedActions.length > 0 ? validatedActions : undefined,
                }
              : message,
          ),
        );
      } catch {
        setConnectionError("I lost connection for a moment. Send that again and I will pick it back up.");
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId
              ? {
                  ...message,
                  content: "I lost connection for a moment. Send that again and I will pick it back up.",
                }
              : message,
          ),
        );
      } finally {
        setIsStreaming(false);
      }
    },
    [appendAssistantMessage, clientContext, loadChatSessions, persistPreferencesFromOnboarding, userId, validateActions],
  );

  const submitCurrentInput = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    setMessages((current) => [...current, { id: messageId(), role: "user", content: text }]);
    setInput("");

    await sendChatMessage(text);
  }, [input, isStreaming, sendChatMessage]);

  const createNewChat = useCallback(async () => {
    if (!userId || isStreaming) return;

    const now = new Date().toISOString();
    const nextSessionId = generateUUID();
    const { error } = await supabase.from("chat_sessions").insert({
      id: nextSessionId,
      user_id: userId,
      title: DEFAULT_SESSION_TITLE,
      created_at: now,
      updated_at: now,
    });

    if (error) {
      setConnectionError("I could not start a new chat. Try again in a moment.");
      return;
    }

    sessionIdRef.current = nextSessionId;
    setActiveSessionId(nextSessionId);
    window.localStorage.setItem(activeSessionStorageKey(userId), nextSessionId);
    window.localStorage.setItem(copilotSessionKey(userId), nextSessionId);
    dispatchActiveChatChanged(userId, nextSessionId);

    setSessions((current) =>
      sortChatSessions([
        { id: nextSessionId, title: DEFAULT_SESSION_TITLE, updatedAt: now },
        ...current.filter((session) => session.id !== nextSessionId),
      ]),
    );
    setActionStates({});
    setConnectionError("");
    setIsSessionMenuOpen(false);

    const greeting = initialAssistantMessage(onboarding);
    setMessages([greeting]);

    await supabase.from("chat_messages").insert({
      user_id: userId,
      session_id: nextSessionId,
      role: "assistant",
      content: greeting.content,
    });
  }, [isStreaming, onboarding, userId]);

  const selectChatSession = useCallback(
    async (sessionId: string) => {
      if (!userId || isStreaming || sessionId === sessionIdRef.current) {
        setIsSessionMenuOpen(false);
        return;
      }

      const activated = await activateSession(userId, sessionId, onboarding);
      if (activated) {
        dispatchActiveChatChanged(userId, sessionId);
        setConnectionError("");
      } else {
        setConnectionError("I could not open that chat. Try another one.");
      }
      setIsSessionMenuOpen(false);
    },
    [activateSession, isStreaming, onboarding, userId],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submitCurrentInput();
  };

  const openFullAssistant = () => {
    if (userId && sessionIdRef.current) {
      window.localStorage.setItem(activeSessionStorageKey(userId), sessionIdRef.current);
      window.localStorage.setItem(copilotSessionKey(userId), sessionIdRef.current);
      dispatchActiveChatChanged(userId, sessionIdRef.current);
    }
    setPanelState("minimized");
    router.push("/chat");
  };

  const handleDragPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest("button")) return;

    const panel = panelRef.current;
    if (!panel) return;

    const rect = panel.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleDragPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    setPanelPosition(
      clampPanelPosition(
        event.clientX - drag.offsetX,
        event.clientY - drag.offsetY,
        drag.width,
        drag.height,
      ),
    );
  };

  const handleDragPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleTriggerPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    triggerDragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleTriggerPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = triggerDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const nextX = event.clientX - drag.offsetX;
    const nextY = event.clientY - drag.offsetY;
    const current = triggerPosition;
    if (!current || Math.abs(nextX - current.x) > 3 || Math.abs(nextY - current.y) > 3) {
      drag.moved = true;
    }

    setTriggerPosition(
      clampPanelPosition(nextX, nextY, drag.width, drag.height),
    );
  };

  const handleTriggerPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = triggerDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    triggerDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (!drag.moved) {
      setPanelState("open");
    }
  };

  const updateActionState = (actionKey: string, state: ActionExecutionState) => {
    setActionStates((current) => ({ ...current, [actionKey]: state }));
  };

  const executeAction = async (messageIdValue: string, index: number, action: CopilotAction) => {
    const actionKey = `${messageIdValue}-${index}`;

    if (action.type === "open_route") {
      if (!isAllowedCopilotHref(action.href)) {
        updateActionState(actionKey, { status: "error", message: "I could not open that page." });
        return;
      }
      router.push(action.href);
      updateActionState(actionKey, {
        status: "success",
        message: getCopilotActionSuccessMessage(action, action.href),
        href: action.href,
      });
      return;
    }

    if (action.type === "prefill_job_search") {
      const href = buildJobSearchHref(action.query, action.location, action.auto ?? true);
      if (!isAllowedCopilotHref(href)) {
        updateActionState(actionKey, { status: "error", message: "I could not prepare that search." });
        return;
      }
      router.push(href);
      updateActionState(actionKey, {
        status: "success",
        message: getCopilotActionSuccessMessage(action, href),
        href,
      });
      return;
    }

    if (action.type === "prefill_goal_with_todos") {
      const href = "/tracker?view=goals_tasks&draft=1";
      saveGoalsTasksDraft({
        type: "goal_with_todos",
        goal: action.goal,
        todos: action.todos,
      });
      router.push(href);
      updateActionState(actionKey, {
        status: "success",
        message: getCopilotActionSuccessMessage(action, href),
        href,
      });
      return;
    }

    if (action.type === "prefill_todo") {
      const href = "/tracker?view=goals_tasks&draft=1";
      saveGoalsTasksDraft({
        type: "todo",
        todo: action.todo,
      });
      router.push(href);
      updateActionState(actionKey, {
        status: "success",
        message: getCopilotActionSuccessMessage(action, href),
        href,
      });
      return;
    }

    if (action.type === "prefill_application_note") {
      const href = "/tracker?view=applications&draft=1";
      saveApplicationNoteDraft({
        application_id: action.application_id,
        note: action.note,
      });
      router.push(href);
      updateActionState(actionKey, {
        status: "success",
        message: getCopilotActionSuccessMessage(action, href),
        href,
      });
      return;
    }

    if (action.type === "show_feature_explainer") {
      const href = action.href ?? undefined;
      if (href) router.push(href);
      updateActionState(actionKey, {
        status: "success",
        message: getCopilotActionSuccessMessage(action, href),
        href,
      });
      return;
    }

    updateActionState(actionKey, { status: "loading" });
    try {
      if (!userId) throw new Error("Please sign in first.");
      const response = await fetch(`${apiBaseUrl}/copilot/actions/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          source: "widget",
          action,
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { detail?: string };
        throw new Error(body.detail ?? "I could not confirm that action.");
      }

      const body = (await response.json()) as { message?: string; href?: string };
      updateActionState(actionKey, {
        status: "success",
        message: body.message ?? getCopilotActionSuccessMessage(action, body.href),
        href: body.href ?? (
          action.type === "save_application" ||
          action.type === "update_application_status" ||
          action.type === "save_application_note"
            ? "/tracker?view=applications"
            : "/tracker?view=goals_tasks"
        ),
      });
    } catch (error) {
      updateActionState(actionKey, {
        status: "error",
        message:
          error instanceof Error
            ? `${error.message} Your plan is still here.`
            : "I could not create that. Your plan is still here.",
      });
    }
  };

  const activeSession = sessions.find((session) => session.id === activeSessionId);
  const activeSessionTitle = activeSession ? truncateSessionTitle(activeSession.title) : DEFAULT_SESSION_TITLE;

  if (isFullAssistantPage) {
    return null;
  }

  if (panelState === "closed") {
    return (
      <button
        type="button"
        aria-label="Open CareerPilot"
        onPointerDown={handleTriggerPointerDown}
        onPointerMove={handleTriggerPointerMove}
        onPointerUp={handleTriggerPointerUp}
        onPointerCancel={handleTriggerPointerUp}
        className="fixed z-50 flex h-12 w-12 touch-none cursor-grab select-none items-center justify-center rounded-2xl border border-[var(--cp-border-strong)] bg-[var(--cp-surface-elevated)] text-[var(--cp-champagne)] shadow-xl shadow-[var(--cp-glow-copper)] transition-transform hover:scale-105 active:cursor-grabbing"
        style={{ right: "24px", bottom: "24px" }}
      >
        <Bot className="h-5 w-5" />
      </button>
    );
  }

  if (panelState === "minimized") {
    return (
      <button
        type="button"
        onPointerDown={handleTriggerPointerDown}
        onPointerMove={handleTriggerPointerMove}
        onPointerUp={handleTriggerPointerUp}
        onPointerCancel={handleTriggerPointerUp}
        className="fixed z-50 flex touch-none cursor-grab select-none items-center gap-2 rounded-full border border-[var(--cp-border-strong)] bg-[var(--cp-surface-elevated)] px-4 py-3 text-sm font-semibold text-[var(--cp-text-main)] shadow-xl shadow-[var(--cp-glow-copper)] transition-all hover:border-[var(--cp-champagne)] active:cursor-grabbing"
        style={{ right: "24px", bottom: "24px" }}
      >
        <Navigation className="h-4 w-4 text-[var(--cp-champagne)]" />
        CareerPilot guide
      </button>
    );
  }

  return (
    <section
      ref={panelRef}
      className="cp-panel-solid fixed bottom-6 right-6 z-50 flex max-h-[calc(100vh-48px)] w-[calc(100vw-48px)] flex-col overflow-hidden rounded-2xl md:max-h-[680px] md:w-[390px]"
    >
      <header
        className="flex cursor-grab touch-none select-none items-center gap-3 border-b border-[var(--cp-border-soft)] px-4 py-3 active:cursor-grabbing"
        onPointerDown={handleDragPointerDown}
        onPointerMove={handleDragPointerMove}
        onPointerUp={handleDragPointerUp}
        onPointerCancel={handleDragPointerUp}
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--cp-border-medium)] bg-[rgba(201,130,74,0.14)] text-[var(--cp-champagne)]">
          <Navigation className="h-4 w-4" />
        </div>
        <div className="relative min-w-0 flex-1">
          <h2 className="text-sm font-bold text-[var(--cp-text-main)]">CareerPilot guide</h2>
          <button
            type="button"
            onClick={() => {
              setIsSessionMenuOpen((open) => !open);
              if (userId) void loadChatSessions(userId);
            }}
            className="mt-0.5 flex max-w-full items-center gap-1.5 rounded-md text-left text-xs text-[var(--cp-text-muted)] hover:text-[var(--cp-text-soft)]"
            aria-expanded={isSessionMenuOpen}
            aria-label="Choose chat session"
            title="Choose chat"
          >
            <span className="truncate">{activeSessionTitle}</span>
            <ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${isSessionMenuOpen ? "rotate-180" : ""}`} />
          </button>

          {isSessionMenuOpen && (
            <div className="absolute left-0 top-full z-50 mt-2 w-[240px] overflow-hidden rounded-xl border border-[var(--cp-border-medium)] bg-[var(--cp-surface-elevated)] shadow-xl shadow-black/30">
              <div className="max-h-60 overflow-y-auto py-1">
                {sessions.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-[var(--cp-text-subtle)]">No conversations yet</p>
                ) : (
                  sessions.map((session) => {
                    const isActiveSession = session.id === activeSessionId;
                    return (
                      <button
                        key={session.id}
                        type="button"
                        onClick={() => {
                          void selectChatSession(session.id);
                        }}
                        disabled={isStreaming}
                        className={`flex w-full items-start gap-2 px-3 py-2 text-left text-xs transition-colors disabled:opacity-50 ${
                          isActiveSession
                            ? "bg-[rgba(201,130,74,0.12)] text-[var(--cp-champagne)]"
                            : "text-[var(--cp-text-muted)] hover:bg-white/[0.04] hover:text-[var(--cp-text-soft)]"
                        }`}
                      >
                        <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-70" />
                        <span className="line-clamp-2 min-w-0 leading-snug">
                          {session.title || DEFAULT_SESSION_TITLE}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            void createNewChat();
          }}
          disabled={isStreaming}
          aria-label="New CareerPilot chat"
          title="New chat"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--cp-text-muted)] hover:bg-white/[0.05] hover:text-[var(--cp-text-main)] disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={openFullAssistant}
          aria-label="Open full AI Assistant"
          title="Open full AI Assistant"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--cp-text-muted)] hover:bg-white/[0.05] hover:text-[var(--cp-text-main)]"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            setIsSessionMenuOpen(false);
            setPanelState("minimized");
          }}
          aria-label="Minimize CareerPilot"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--cp-text-muted)] hover:bg-white/[0.05] hover:text-[var(--cp-text-main)]"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            setIsSessionMenuOpen(false);
            setPanelState("closed");
          }}
          aria-label="Close CareerPilot"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--cp-text-muted)] hover:bg-white/[0.05] hover:text-[var(--cp-text-main)]"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {message.role === "assistant" && (
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--cp-border-medium)] bg-[rgba(201,130,74,0.14)] text-[var(--cp-champagne)]">
                <Bot className="h-3.5 w-3.5" />
              </div>
            )}
            <div className={`max-w-[82%] ${message.role === "user" ? "order-first" : ""}`}>
              <div
                className={`rounded-2xl border px-3 py-2.5 text-sm leading-relaxed ${
                  message.role === "user"
                ? "rounded-tr-none border-[var(--cp-border-medium)] bg-[rgba(201,130,74,0.20)] text-[var(--cp-text-main)]"
                    : "rounded-tl-none border-[var(--cp-border-soft)] bg-white/[0.03] text-[var(--cp-text-main)]"
                }`}
              >
                {message.role === "assistant" ? (
                  message.content ? (
                    <MarkdownRenderer content={message.content} isStreaming={isStreaming} />
                  ) : (
                    <div className="flex items-center gap-1.5 py-1">
                      {["first", "second", "third"].map((dot) => (
                        <span
                          key={dot}
                          className="h-1.5 w-1.5 rounded-full bg-[var(--cp-copper-strong)]/70 animate-bounce"
                        />
                      ))}
                    </div>
                  )
                ) : (
                  <span className="whitespace-pre-wrap">{message.content}</span>
                )}
              </div>
              {message.actions?.map((action, index) => (
                <CopilotActionCard
                  key={`${message.id}-${index}`}
                  action={action}
                  state={actionStates[`${message.id}-${index}`] ?? { status: "idle" }}
                  onExecute={() => {
                    void executeAction(message.id, index, action);
                  }}
                  onOpenHref={(href) => router.push(href)}
                />
              ))}
            </div>
            {message.role === "user" && (
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--cp-border-soft)] bg-[rgba(201,130,74,0.10)] text-[var(--cp-champagne)]">
                <User className="h-3.5 w-3.5" />
              </div>
            )}
          </div>
        ))}
      </div>

      {connectionError && (
        <div className="mx-4 mb-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {connectionError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="border-t border-[var(--cp-border-soft)] p-3">
        <div className="flex items-end gap-2 rounded-2xl border border-[var(--cp-border-soft)] bg-white/[0.03] p-2 focus-within:border-[var(--cp-border-strong)]">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void submitCurrentInput();
              }
            }}
            rows={1}
            placeholder="Ask CareerPilot..."
            disabled={isStreaming}
            className="max-h-24 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-relaxed text-[var(--cp-text-main)] outline-none placeholder:text-[var(--cp-text-subtle)]"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isStreaming}
            className="h-9 w-9 shrink-0 rounded-xl disabled:opacity-40"
          >
            {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </form>
    </section>
  );
}

function CopilotActionCard({
  action,
  state,
  onExecute,
  onOpenHref,
}: {
  action: CopilotAction;
  state: ActionExecutionState;
  onExecute: () => void;
  onOpenHref: (href: string) => void;
}) {
  const isApplicationAction =
    action.type === "save_application" ||
    action.type === "update_application_status" ||
    action.type === "save_application_note";
  const isMutation =
    action.type === "create_goal_with_todos" ||
    action.type === "create_roadmap_with_tasks" ||
    action.type === "create_todo" ||
    isApplicationAction;
  const isLoading = state.status === "loading";
  const successHref = state.href ?? (isApplicationAction ? "/tracker?view=applications" : "/tracker?view=goals_tasks");
  const Icon =
    action.type === "open_route"
      ? Navigation
      : action.type === "prefill_job_search"
        ? Search
        : action.type === "create_todo" || action.type === "prefill_todo"
          ? Calendar
          : isApplicationAction
            ? CheckCircle2
            : Target;
  const buttonLabel =
    action.type === "prefill_goal_with_todos" || action.type === "prefill_todo"
      ? "Open Draft"
      : action.type === "prefill_application_note"
        ? "Open Note"
        : action.type === "show_feature_explainer"
          ? action.href ? "Open" : "Got it"
          : action.type === "create_goal_with_todos" || action.type === "create_roadmap_with_tasks"
      ? "Add to Goals & Tasks"
      : action.type === "create_todo"
        ? "Add Task"
        : isMutation
          ? "Confirm"
          : "Open";

  return (
    <div className="mt-2 rounded-xl border border-[var(--cp-border-medium)] bg-[rgba(201,130,74,0.08)] p-3 text-xs text-[var(--cp-text-soft)]">
      <div className="flex items-start gap-2">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[rgba(201,130,74,0.14)] text-[var(--cp-champagne)]">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="font-semibold text-[var(--cp-text-main)]">{action.label}</p>
            <ActionSummary action={action} />
          </div>

          {state.message && (
            <p
              className={`rounded-lg border px-2 py-1.5 ${
                state.status === "error"
                  ? "border-red-500/20 bg-red-500/10 text-red-300"
                  : "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
              }`}
            >
              {state.message}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {state.status === "success" && isMutation ? (
              <button
                type="button"
                onClick={() => onOpenHref(successHref)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--cp-border-strong)] bg-gradient-to-r from-[var(--cp-copper-deep)] to-[var(--cp-copper-strong)] px-3 py-1.5 font-semibold text-[var(--cp-bg-deep)] hover:brightness-110"
              >
                {isApplicationAction ? "Open Applications" : "Open Goals & Tasks"}
                <ExternalLink className="h-3 w-3" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onExecute}
                disabled={isLoading || state.status === "success"}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--cp-border-strong)] bg-gradient-to-r from-[var(--cp-copper-deep)] to-[var(--cp-copper-strong)] px-3 py-1.5 font-semibold text-[var(--cp-bg-deep)] hover:brightness-110 disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                {buttonLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionSummary({ action }: { action: CopilotAction }) {
  if (action.type === "open_route") {
    return (
      <p className="mt-1 flex items-center gap-1 text-white/45">
        <ExternalLink className="h-3 w-3" />
        {action.href}
      </p>
    );
  }

  if (action.type === "prefill_job_search") {
    return (
      <p className="mt-1 flex items-center gap-1 text-white/45">
        <MapPin className="h-3 w-3" />
        {action.query}
        {action.location ? ` in ${action.location}` : ""}
      </p>
    );
  }

  if (action.type === "create_todo") {
    return (
      <p className="mt-1 text-white/45">
        {action.todo.title} · {formatDraftDate(action.todo.due_date)}
      </p>
    );
  }

  if (action.type === "prefill_todo") {
    return (
      <p className="mt-1 text-white/45">
        {action.todo.title} - {formatDraftDate(action.todo.due_date)}
      </p>
    );
  }

  if (action.type === "create_roadmap_with_tasks") {
    const todoCount = action.goals.reduce((count, goal) => count + goal.todos.length, 0);
    return (
      <div className="mt-1 space-y-1 text-white/45">
        <p>
          {action.goals.length} goals · {todoCount} tasks
        </p>
        <ul className="space-y-1">
          {action.goals.map((goal) => (
            <li key={`${goal.title}-${goal.target_date}`} className="flex gap-1.5">
              <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-[var(--cp-champagne)]" />
              <span>{goal.title} · {formatDraftDate(goal.target_date)}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (action.type === "save_application") {
    return (
      <p className="mt-1 text-white/45">
        Save job to Applications{action.status ? ` as ${action.status}` : ""}
      </p>
    );
  }

  if (action.type === "update_application_status") {
    return (
      <p className="mt-1 text-white/45">
        Move application to {action.status}
      </p>
    );
  }

  if (action.type === "save_application_note") {
    return (
      <p className="mt-1 text-white/45">
        Save note: {action.note}
      </p>
    );
  }

  if (action.type === "prefill_application_note") {
    return (
      <p className="mt-1 text-white/45">
        Draft note: {action.note}
      </p>
    );
  }

  if (action.type === "show_feature_explainer") {
    return <p className="mt-1 text-white/45">{action.body || action.feature}</p>;
  }

  return (
    <div className="mt-1 space-y-1 text-white/45">
      <p>{action.goal.title} · {formatDraftDate(action.goal.target_date)}</p>
      {action.todos.length > 0 && (
        <ul className="space-y-1">
          {action.todos.map((todo) => (
            <li key={`${todo.title}-${todo.due_date}`} className="flex gap-1.5">
              <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-[var(--cp-champagne)]" />
              <span>{todo.title} · {formatDraftDate(todo.due_date)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
