"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, FileText, Loader2, Map, Send, Sparkles, Target, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { CopilotActionCard, type CopilotActionState } from "@/components/copilot-action-card";
import { extractCopilotActions, stripCopilotDirectives } from "@/lib/copilot/directives";
import { buildJobSearchHref, isAllowedCopilotHref } from "@/lib/copilot/app-map";
import { supabase } from "@/lib/supabase";
import type {
  CopilotAction,
  CopilotClientContext,
  CopilotValidatedAction,
} from "@/types";

const SUGGESTED_PROMPTS = [
  {
    icon: Target,
    label: "What should I do today?",
    prompt: "What should I do today based on my current applications, goals, and CV?",
  },
  {
    icon: Sparkles,
    label: "Find jobs",
    prompt: "Find jobs that match my CV and current career goals.",
  },
  {
    icon: Map,
    label: "Create prep tasks",
    prompt: "Create interview prep tasks I can review and confirm.",
  },
  {
    icon: FileText,
    label: "Improve CV",
    prompt: "How can I improve my CV for my target roles?",
  },
];

interface ChatInterfaceProps {
  sessionId: string;
  clientContext?: CopilotClientContext;
  onFirstMessage?: (firstMessageText: string) => void;
}

type LocalChatMessage = {
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

function generateId(): string {
  return `chat-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function ChatInterface({ sessionId, clientContext, onFirstMessage }: ChatInterfaceProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<LocalChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [actionStates, setActionStates] = useState<Record<string, CopilotActionState>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isFirstMessageRef = useRef(true);
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [input]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data, error }) => {
      if (!error) setUserId(data.user?.id ?? null);
    });
  }, []);

  useEffect(() => {
    isFirstMessageRef.current = true;
  }, [sessionId]);

  useEffect(() => {
    if (!userId || !sessionId) return;

    const loadHistory = async () => {
      setIsLoadingHistory(true);
      setMessages([]);
      try {
        const { data, error } = await supabase
          .from("chat_messages")
          .select("id, role, content")
          .eq("user_id", userId)
          .eq("session_id", sessionId)
          .order("created_at", { ascending: true })
          .limit(50);

        if (!error && data) {
          setMessages(
            (data as ChatMessageRow[]).map((row) => ({
              id: row.id,
              role: row.role,
              content: row.content,
            })),
          );
          isFirstMessageRef.current = data.length === 0;
        }
      } finally {
        setIsLoadingHistory(false);
      }
    };

    void loadHistory();
  }, [sessionId, userId]);

  const updateActionState = useCallback((actionKey: string, state: CopilotActionState) => {
    setActionStates((current) => ({ ...current, [actionKey]: state }));
  }, []);

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
              source: "chat",
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

  const executeAction = useCallback(
    async (messageId: string, index: number, action: CopilotAction) => {
      const actionKey = `${messageId}-${index}`;

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
        if (!userId) throw new Error("Please sign in first.");
        const response = await fetch(`${apiBaseUrl}/copilot/actions/execute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: userId,
            source: "chat",
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
          message: body.message ?? "Confirmed.",
          href:
            body.href ??
            (action.type === "save_application" ||
            action.type === "update_application_status" ||
            action.type === "save_application_note"
              ? "/tracker?view=applications"
              : "/tracker?view=goals_tasks"),
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
    },
    [apiBaseUrl, router, updateActionState, userId],
  );

  const handleSend = useCallback(
    async (overrideText?: string) => {
      const text = (overrideText ?? input).trim();
      if (!text || isStreaming) return;

      if (!userId) {
        setMessages((prev) => [
          ...prev,
          { id: generateId(), role: "assistant", content: "Please sign in to start chatting." },
        ]);
        return;
      }

      const userMessageId = generateId();
      const assistantId = generateId();
      setMessages((prev) => [
        ...prev,
        { id: userMessageId, role: "user", content: text },
        { id: assistantId, role: "assistant", content: "" },
      ]);
      setInput("");

      if (isFirstMessageRef.current) {
        isFirstMessageRef.current = false;
        onFirstMessage?.(text);
      }

      setIsStreaming(true);
      let fullReply = "";

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: userId,
            session_id: sessionId,
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

          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantId
                ? { ...message, content: stripCopilotDirectives(fullReply) }
                : message,
            ),
          );
        }

        const actions = await validateActions(extractCopilotActions(fullReply));
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantId
              ? {
                  ...message,
                  content: stripCopilotDirectives(fullReply),
                  actions: actions.length > 0 ? actions : undefined,
                }
              : message,
          ),
        );
      } catch {
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantId
              ? {
                  ...message,
                  content: "Sorry, something went wrong connecting to the server.",
                }
              : message,
          ),
        );
      } finally {
        setIsStreaming(false);
      }
    },
    [clientContext, input, isFirstMessageRef, isStreaming, onFirstMessage, sessionId, userId, validateActions],
  );

  const handleSuggestion = (prompt: string) => {
    setInput(prompt);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div
        ref={scrollRef}
        className="flex-1 space-y-6 overflow-y-auto pb-4 pr-1"
      >
        {isLoadingHistory && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-white/20" />
          </div>
        )}

        {!isLoadingHistory && messages.length === 0 && (
          <div className="cp-map-lines flex flex-col items-center justify-center gap-8 rounded-2xl border border-[var(--cp-border-soft)] bg-[rgba(255,255,255,0.015)] px-6 py-10 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--cp-border-medium)] bg-[rgba(201,130,74,0.14)] shadow-lg shadow-[var(--cp-glow-copper)]">
                <Bot className="h-8 w-8 text-[var(--cp-champagne)]" />
              </div>
              <div>
                <p className="font-display text-2xl font-semibold tracking-normal text-[var(--cp-text-main)]">CareerPilot guide</p>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--cp-text-muted)]">
                  Ask me anything about your career - job advice, CV tips, cover letters,
                  or interview prep. I know your CV inside out.
                </p>
              </div>
            </div>

            <div className="grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2">
              {SUGGESTED_PROMPTS.map(({ icon: Icon, label, prompt }) => (
                <button
                  key={label}
                  onClick={() => handleSuggestion(prompt)}
                  className="group flex items-start gap-3 rounded-xl border border-[var(--cp-border-soft)] bg-white/[0.02] p-3.5 text-left transition-all duration-200 hover:border-[var(--cp-border-medium)] hover:bg-white/[0.04]"
                >
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[rgba(201,130,74,0.12)] transition-colors group-hover:bg-[rgba(201,130,74,0.2)]">
                    <Icon className="h-3.5 w-3.5 text-[var(--cp-champagne)]" />
                  </div>
                  <span className="text-xs leading-relaxed text-[var(--cp-text-muted)] transition-colors group-hover:text-[var(--cp-text-soft)]">
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {!isLoadingHistory &&
          messages.map((message, index) => {
            const isLast = index === messages.length - 1;
            const isAssistantStreaming = isLast && message.role === "assistant" && isStreaming;

            return (
              <div key={message.id} className="space-y-2">
                <div
                  className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {message.role === "assistant" && (
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--cp-border-medium)] bg-[rgba(201,130,74,0.14)] shadow-md shadow-[var(--cp-glow-copper)]">
                      <Bot className="h-4 w-4 text-[var(--cp-champagne)]" />
                    </div>
                  )}

                  <div
                    className={`max-w-[78%] rounded-2xl border px-4 py-3 text-sm shadow-md ${
                      message.role === "user"
                        ? "rounded-tr-none border-[var(--cp-border-medium)] bg-[rgba(201,130,74,0.20)] text-[var(--cp-text-main)]"
                        : "rounded-tl-none border-[var(--cp-border-soft)] bg-[var(--cp-surface)] text-[var(--cp-text-main)]"
                    }`}
                  >
                    {message.role === "assistant" ? (
                      message.content ? (
                        <MarkdownRenderer content={message.content} isStreaming={isAssistantStreaming} />
                      ) : (
                        <div className="flex items-center gap-1.5 py-1">
                          {[0, 150, 300].map((delay) => (
                            <span
                              key={delay}
                              className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--cp-copper-strong)]/60"
                            />
                          ))}
                        </div>
                      )
                    ) : (
                      <span className="whitespace-pre-wrap">{message.content}</span>
                    )}
                  </div>

                  {message.role === "user" && (
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--cp-border-soft)] bg-[rgba(201,130,74,0.10)] text-[var(--cp-champagne)] shadow-sm">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </div>

                {message.role === "assistant" &&
                  message.actions?.map((action, actionIndex) => (
                    <CopilotActionCard
                      key={`${message.id}-${actionIndex}`}
                      action={action}
                      state={actionStates[`${message.id}-${actionIndex}`]}
                      onExecute={() => {
                        void executeAction(message.id, actionIndex, action);
                      }}
                      onOpenHref={(href) => router.push(href)}
                    />
                  ))}
              </div>
            );
          })}
      </div>

      <div className="mt-2 shrink-0 border-t border-[var(--cp-border-soft)] pt-4">
        <div className="flex items-end gap-3 rounded-2xl border border-[var(--cp-border-soft)] bg-[var(--cp-surface)] p-2 transition-all focus-within:border-[var(--cp-border-strong)] focus-within:ring-2 focus-within:ring-[var(--cp-glow-copper)]">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask CareerPilot anything... (Shift+Enter for newline)"
            rows={1}
            disabled={isStreaming}
            className="min-h-[44px] max-h-[160px] flex-1 resize-none bg-transparent px-3 py-2 text-sm leading-relaxed text-[var(--cp-text-main)] placeholder:text-[var(--cp-text-subtle)] focus:outline-none focus:ring-0"
          />
          <Button
            onClick={() => void handleSend()}
            disabled={!input.trim() || isStreaming}
            size="icon"
            className="h-[40px] w-[40px] shrink-0 rounded-xl disabled:opacity-40"
          >
            {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <p className="mt-2 text-center text-[10px] text-[var(--cp-text-subtle)]">
          CareerPilot AI can make mistakes. Check important information.
        </p>
      </div>
    </div>
  );
}
