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
  CheckCircle2,
  ExternalLink,
  Loader2,
  MapPin,
  Maximize2,
  Minus,
  Navigation,
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
import type {
  CopilotAction,
  CopilotClientContext,
  CopilotOnboardingState,
  CopilotProfileStatus,
  CopilotTodoDraft,
  Goal,
  Todo,
} from "@/types";

type PanelState = "closed" | "open" | "minimized";
type LocalMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions?: CopilotAction[];
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

function initialAssistantMessage(onboarding: CopilotOnboardingState): LocalMessage {
  if (onboarding.completed) {
    const name = onboarding.name ? `, ${onboarding.name}` : "";
    return {
      id: messageId(),
      role: "assistant",
      content: `Welcome back${name}. What should we move forward today?`,
    };
  }

  return {
    id: messageId(),
    role: "assistant",
    content:
      "Hi, I am CareerPilot. I will help turn your CV into job matches, applications, goals, and next steps. What can I call you?",
  };
}

function stripActionDirectives(content: string): string {
  return content.replace(ACTION_PATTERN, "").trim();
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

function parseTargetRoles(input: string): string[] {
  return input
    .split(/,|\/|\band\b/i)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function parseLocationAndMode(input: string): Pick<CopilotOnboardingState, "location" | "workMode"> {
  const normalized = input.toLowerCase();
  const modes = ["remote", "hybrid", "on-site", "onsite", "any"];
  const matchedMode = modes.find((mode) => normalized.includes(mode));
  const workMode = matchedMode === "onsite" ? "on-site" : matchedMode ?? "any";
  const location = input
    .replace(/\b(remote|hybrid|on-site|onsite|any)\b/gi, "")
    .replace(/[(),]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    location: location || input.trim(),
    workMode,
  };
}

function formatDraftDate(date?: string | null): string {
  if (!date) return "No date";
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function CopilotWidget() {
  const pathname = usePathname();
  const router = useRouter();
  const [panelState, setPanelState] = useState<PanelState>("minimized");
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [profileStatus, setProfileStatus] = useState<CopilotProfileStatus>("unknown");
  const [onboarding, setOnboarding] = useState<CopilotOnboardingState>(DEFAULT_ONBOARDING);
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
      setMessages([initialAssistantMessage(parsed)]);
      setPanelState(parsed.completed ? "minimized" : "open");

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
  }, [apiBaseUrl]);

  useEffect(() => {
    if (!userId) return;
    window.localStorage.setItem(
      onboardingKey(userId),
      JSON.stringify({ ...onboarding, updatedAt: new Date().toISOString() }),
    );
  }, [onboarding, userId]);

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
      setPanelState("open");
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
      }),
    [onboarding, pathname, profileStatus],
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

  const finishOnboardingWithCvStatus = useCallback(
    (nextOnboarding: CopilotOnboardingState) => {
      const name = nextOnboarding.name ? `${nextOnboarding.name}, ` : "";
      if (profileStatus === "has_profile") {
        const role = nextOnboarding.targetRoles[0] ?? "software engineer";
        appendAssistantMessage(`${name}you are set. Want me to start with matching jobs?`, [
          {
            type: "prefill_job_search",
            label: `Search ${role} roles`,
            query: role,
            location: nextOnboarding.location,
            auto: true,
          },
        ]);
        return;
      }

      appendAssistantMessage(`${name}your CV is the foundation for fit scores and grounded advice. Upload it first.`, [
        {
          type: "open_route",
          label: "Upload your CV",
          href: "/cv?upload=1",
        },
      ]);
    },
    [appendAssistantMessage, profileStatus],
  );

  const handleOnboardingAnswer = useCallback(
    (text: string): boolean => {
      if (onboarding.completed) return false;

      const now = new Date().toISOString();
      if (onboarding.lastStep === "name") {
        const next = {
          ...onboarding,
          name: text.trim(),
          lastStep: "target_role" as const,
          updatedAt: now,
        };
        setOnboarding(next);
        appendAssistantMessage(`Nice to meet you, ${next.name}. What role are you aiming for?`);
        return true;
      }

      if (onboarding.lastStep === "target_role") {
        const roles = parseTargetRoles(text);
        const next = {
          ...onboarding,
          targetRoles: roles.length > 0 ? roles : [text.trim()],
          lastStep: "location_work_mode" as const,
          updatedAt: now,
        };
        setOnboarding(next);
        appendAssistantMessage("Where do you want to work, and do you prefer on-site, hybrid, remote, or any?");
        return true;
      }

      if (onboarding.lastStep === "location_work_mode") {
        const locationAndMode = parseLocationAndMode(text);
        const next = {
          ...onboarding,
          ...locationAndMode,
          lastStep: "career_stage" as const,
          updatedAt: now,
        };
        setOnboarding(next);
        appendAssistantMessage("What stage are you in right now: student, fresh graduate, experienced, switching career, or urgent search?");
        return true;
      }

      const next = {
        ...onboarding,
        careerStage: text.trim(),
        completed: true,
        lastStep: "complete" as const,
        updatedAt: now,
      };
      setOnboarding(next);
      finishOnboardingWithCvStatus(next);
      return true;
    },
    [appendAssistantMessage, finishOnboardingWithCvStatus, onboarding],
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
                ? { ...message, content: stripActionDirectives(fullReply) }
                : message,
            ),
          );
        }

        const actions = extractActions(fullReply);
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId
              ? {
                  ...message,
                  content: stripActionDirectives(fullReply),
                  actions: actions.length > 0 ? actions : undefined,
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
    [appendAssistantMessage, clientContext, userId],
  );

  const submitCurrentInput = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    setMessages((current) => [...current, { id: messageId(), role: "user", content: text }]);
    setInput("");

    if (handleOnboardingAnswer(text)) return;
    await sendChatMessage(text);
  }, [handleOnboardingAnswer, input, isStreaming, sendChatMessage]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submitCurrentInput();
  };

  const openFullAssistant = () => {
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

  const executeCreateTodo = async (actionKey: string, todo: CopilotTodoDraft, goalId?: string) => {
    if (!userId) throw new Error("Please sign in first.");
    const response = await fetch(`${apiBaseUrl}/tracker/todos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        title: todo.title,
        due_date: todo.due_date ?? null,
        goal_id: goalId ?? null,
      }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { detail?: string };
      throw new Error(body.detail ?? "Failed to create task.");
    }

    const body = (await response.json()) as { todo?: Todo };
    if (!body.todo?.id) throw new Error("Task was not confirmed.");
    updateActionState(actionKey, {
      status: "success",
      message: "Task added.",
      href: "/tracker?view=goals_tasks",
    });
  };

  const executeAction = async (messageIdValue: string, index: number, action: CopilotAction) => {
    const actionKey = `${messageIdValue}-${index}`;

    if (action.type === "open_route") {
      if (!isAllowedCopilotHref(action.href)) {
        updateActionState(actionKey, { status: "error", message: "I could not open that page." });
        return;
      }
      router.push(action.href);
      updateActionState(actionKey, { status: "success", message: "Opened.", href: action.href });
      return;
    }

    if (action.type === "prefill_job_search") {
      const href = buildJobSearchHref(action.query, action.location, action.auto ?? true);
      if (!isAllowedCopilotHref(href)) {
        updateActionState(actionKey, { status: "error", message: "I could not prepare that search." });
        return;
      }
      router.push(href);
      updateActionState(actionKey, { status: "success", message: "Search prepared.", href });
      return;
    }

    updateActionState(actionKey, { status: "loading" });
    try {
      if (action.type === "create_todo") {
        await executeCreateTodo(actionKey, action.todo);
        return;
      }

      if (!userId) throw new Error("Please sign in first.");
      const goalResponse = await fetch(`${apiBaseUrl}/tracker/goals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          title: action.goal.title,
          target_date: action.goal.target_date ?? null,
        }),
      });

      if (!goalResponse.ok) {
        const body = (await goalResponse.json().catch(() => ({}))) as { detail?: string };
        throw new Error(body.detail ?? "Failed to create goal.");
      }

      const goalBody = (await goalResponse.json()) as { goal?: Goal };
      const goalId = goalBody.goal?.id;
      if (!goalId) throw new Error("Goal was not confirmed.");

      for (const todo of action.todos) {
        const todoResponse = await fetch(`${apiBaseUrl}/tracker/todos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: userId,
            goal_id: goalId,
            title: todo.title,
            due_date: todo.due_date ?? null,
          }),
        });

        if (!todoResponse.ok) {
          const body = (await todoResponse.json().catch(() => ({}))) as { detail?: string };
          throw new Error(body.detail ?? "Goal was created, but a task failed.");
        }
      }

      updateActionState(actionKey, {
        status: "success",
        message: "Plan created in My Journey.",
        href: "/tracker?view=goals_tasks",
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
        className="fixed z-50 flex h-12 w-12 touch-none cursor-grab select-none items-center justify-center rounded-2xl border border-[#7C74DB]/30 bg-[#534AB7] text-white shadow-xl shadow-[#534AB7]/25 transition-transform hover:scale-105 active:cursor-grabbing"
        style={{
          left: triggerPosition ? `${triggerPosition.x}px` : "auto",
          top: triggerPosition ? `${triggerPosition.y}px` : "auto",
          right: triggerPosition ? "auto" : "16px",
          bottom: triggerPosition ? "auto" : "96px",
        }}
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
        className="fixed z-50 flex touch-none cursor-grab select-none items-center gap-2 rounded-2xl border border-[#7C74DB]/30 bg-[#0E0E12] px-4 py-3 text-sm font-semibold text-white shadow-xl shadow-black/40 transition-all hover:border-[#AFA9EC]/50 active:cursor-grabbing"
        style={{
          left: triggerPosition ? `${triggerPosition.x}px` : "auto",
          top: triggerPosition ? `${triggerPosition.y}px` : "auto",
          right: triggerPosition ? "auto" : "16px",
          bottom: triggerPosition ? "auto" : "96px",
        }}
      >
        <Bot className="h-4 w-4 text-[#AFA9EC]" />
        CareerPilot
      </button>
    );
  }

  return (
    <section
      ref={panelRef}
      className="fixed z-50 flex max-h-[calc(100vh-32px)] w-[calc(100vw-24px)] flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0E0E12] shadow-2xl shadow-black/60 md:max-h-[680px] md:w-[390px]"
      style={{
        left: panelPosition ? `${panelPosition.x}px` : "auto",
        top: panelPosition ? `${panelPosition.y}px` : "auto",
        right: panelPosition ? "auto" : "12px",
        bottom: panelPosition ? "auto" : "80px",
      }}
    >
      <header
        className="flex cursor-grab touch-none select-none items-center gap-3 border-b border-white/[0.06] px-4 py-3 active:cursor-grabbing"
        onPointerDown={handleDragPointerDown}
        onPointerMove={handleDragPointerMove}
        onPointerUp={handleDragPointerUp}
        onPointerCancel={handleDragPointerUp}
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#534AB7] to-[#7C74DB] text-white">
          <Bot className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-white">CareerPilot</h2>
          <p className="truncate text-xs text-white/35">
            {profileStatus === "has_profile" ? "CV-aware guide" : "Career guide"}
          </p>
        </div>
        <button
          type="button"
          onClick={openFullAssistant}
          aria-label="Open full AI Assistant"
          title="Open full AI Assistant"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-white/35 hover:bg-white/[0.05] hover:text-white"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setPanelState("minimized")}
          aria-label="Minimize CareerPilot"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-white/35 hover:bg-white/[0.05] hover:text-white"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setPanelState("closed")}
          aria-label="Close CareerPilot"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-white/35 hover:bg-white/[0.05] hover:text-white"
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
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#534AB7] text-white">
                <Bot className="h-3.5 w-3.5" />
              </div>
            )}
            <div className={`max-w-[82%] ${message.role === "user" ? "order-first" : ""}`}>
              <div
                className={`rounded-2xl border px-3 py-2.5 text-sm leading-relaxed ${
                  message.role === "user"
                    ? "rounded-tr-none border-white/[0.08] bg-[#534AB7] text-white"
                    : "rounded-tl-none border-white/[0.06] bg-white/[0.03] text-white/90"
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
                          className="h-1.5 w-1.5 rounded-full bg-[#AFA9EC]/70 animate-bounce"
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
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-[#1E1B3A] text-[#AFA9EC]">
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

      <form onSubmit={handleSubmit} className="border-t border-white/[0.06] p-3">
        <div className="flex items-end gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-2 focus-within:border-[#7C74DB]/50">
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
            className="max-h-24 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-relaxed text-white outline-none placeholder:text-white/20"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isStreaming}
            className="h-9 w-9 shrink-0 rounded-xl bg-[#534AB7] text-white hover:bg-[#6B63CC] disabled:opacity-40"
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
  const isMutation = action.type === "create_goal_with_todos" || action.type === "create_todo";
  const isLoading = state.status === "loading";
  const successHref = state.href ?? "/tracker?view=goals_tasks";
  const Icon =
    action.type === "open_route"
      ? Navigation
      : action.type === "prefill_job_search"
        ? Search
        : action.type === "create_todo"
          ? Calendar
          : Target;

  return (
    <div className="mt-2 rounded-xl border border-[#7C74DB]/20 bg-[#1E1B3A]/40 p-3 text-xs text-white/70">
      <div className="flex items-start gap-2">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#534AB7]/30 text-[#AFA9EC]">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="font-semibold text-white">{action.label}</p>
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
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#534AB7] px-3 py-1.5 font-semibold text-white hover:bg-[#6B63CC]"
              >
                Open Goals & Tasks
                <ExternalLink className="h-3 w-3" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onExecute}
                disabled={isLoading || state.status === "success"}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#534AB7] px-3 py-1.5 font-semibold text-white hover:bg-[#6B63CC] disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                {isMutation ? "Confirm" : "Open"}
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

  return (
    <div className="mt-1 space-y-1 text-white/45">
      <p>{action.goal.title} · {formatDraftDate(action.goal.target_date)}</p>
      {action.todos.length > 0 && (
        <ul className="space-y-1">
          {action.todos.map((todo) => (
            <li key={`${todo.title}-${todo.due_date}`} className="flex gap-1.5">
              <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-[#AFA9EC]" />
              <span>{todo.title} · {formatDraftDate(todo.due_date)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
