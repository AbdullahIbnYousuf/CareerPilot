"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Send,
  Loader2,
  Bot,
  User,
  Sparkles,
  FileText,
  Map,
  Target,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import type { ChatMessage } from "@/types";

// ── Suggested prompts shown in empty state ───────────────────────────────────

const SUGGESTED_PROMPTS = [
  {
    icon: Target,
    label: "Career readiness check",
    prompt:
      "Am I ready for a data engineer role? Here's the job description:\n\n[paste JD here]",
  },
  {
    icon: Sparkles,
    label: "Skill gap analysis",
    prompt: "What skills am I missing to land a Google internship?",
  },
  {
    icon: Map,
    label: "3-month roadmap",
    prompt:
      "Build me a 3-month roadmap to become job-ready as a software engineer.",
  },
  {
    icon: FileText,
    label: "Draft cover letter",
    prompt:
      "Draft a professional cover letter for this job posting:\n\n[paste JD here]",
  },
];

// ── Prop types ───────────────────────────────────────────────────────────────

interface ChatInterfaceProps {
  sessionId: string;
  /** Called after the first message in a fresh session is sent. */
  onFirstMessage?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ChatInterface({ sessionId, onFirstMessage }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const isFirstMessageRef = useRef(true);
  const [userId, setUserId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Auto-scroll to bottom on new messages ──────────────────────────────────
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  // ── Auto-resize textarea ───────────────────────────────────────────────────
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [input]);

  // ── Fetch authenticated user ───────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data, error }) => {
      if (!error) setUserId(data.user?.id ?? null);
    });
  }, []);

  // ── Reset first-message tracker when session changes ───────────────────────
  useEffect(() => {
    isFirstMessageRef.current = true;
  }, [sessionId]);

  // ── Load chat history when sessionId changes ───────────────────────────────
  useEffect(() => {
    if (!userId || !sessionId) return;

    const loadHistory = async () => {
      setIsLoadingHistory(true);
      setMessages([]);
      try {
        const { data, error } = await supabase
          .from("chat_messages")
          .select("role, content")
          .eq("user_id", userId)
          .eq("session_id", sessionId)
          .order("created_at", { ascending: true })
          .limit(50);

        if (!error && data) {
          setMessages(data as ChatMessage[]);
        }
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadHistory();
  }, [userId, sessionId]);

  // ── Send a message ─────────────────────────────────────────────────────────
  const handleSend = useCallback(
    async (overrideText?: string) => {
      const text = (overrideText ?? input).trim();
      if (!text || isStreaming) return;

      if (!userId) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Please sign in to start chatting." },
        ]);
        return;
      }

      setMessages((prev) => [...prev, { role: "user", content: text }]);
      setInput("");

      // Notify parent the first time so it can refresh the session list title
      if (isFirstMessageRef.current) {
        isFirstMessageRef.current = false;
        onFirstMessage?.();
      }
      setIsStreaming(true);

      // Placeholder assistant bubble that we stream into
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: userId,
            session_id: sessionId,
            message: text,
          }),
        });

        if (!res.ok) throw new Error("Chat request failed");

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        if (!reader) throw new Error("No response stream");

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          if (!chunk) continue;

          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last?.role === "assistant") {
              last.content += chunk;
            }
            return updated;
          });
        }
      } catch {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === "assistant") {
            last.content =
              "Sorry, something went wrong connecting to the server.";
          }
          return updated;
        });
      } finally {
        setIsStreaming(false);
      }
    },
    [input, isStreaming, userId, sessionId]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestion = (prompt: string) => {
    setInput(prompt);
    textareaRef.current?.focus();
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-6 pr-1 pb-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
      >
        {/* Loading history */}
        {isLoadingHistory && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-white/20" />
          </div>
        )}

        {/* Empty state with suggested prompts */}
        {!isLoadingHistory && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center max-w-lg mx-auto py-10 gap-8">
            {/* Hero icon */}
            <div className="flex flex-col items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-[#534AB7]/20 to-[#7C74DB]/10 flex items-center justify-center shadow-lg shadow-primary/10 border border-white/[0.04]">
                <Bot className="h-8 w-8 text-[#7C74DB]" />
              </div>
              <div>
                <p className="text-xl font-bold text-white tracking-tight">
                  CareerPilot AI
                </p>
                <p className="text-sm text-white/40 mt-1.5 leading-relaxed">
                  Ask me anything about your career — job advice, CV tips,
                  cover letters, or interview prep. I know your CV inside out.
                </p>
              </div>
            </div>

            {/* Suggested prompt cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
              {SUGGESTED_PROMPTS.map(({ icon: Icon, label, prompt }) => (
                <button
                  key={label}
                  onClick={() => handleSuggestion(prompt)}
                  className="group flex items-start gap-3 p-3.5 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-primary/30 text-left transition-all duration-200"
                >
                  <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-primary/20 transition-colors">
                    <Icon className="h-3.5 w-3.5 text-primary/70" />
                  </div>
                  <span className="text-xs text-white/50 group-hover:text-white/70 leading-relaxed transition-colors">
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message list */}
        {!isLoadingHistory &&
          messages.map((msg, i) => {
            const isLast = i === messages.length - 1;
            const isAssistantStreaming =
              isLast && msg.role === "assistant" && isStreaming;

            return (
              <div
                key={i}
                className={`flex gap-3 ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {/* Assistant avatar */}
                {msg.role === "assistant" && (
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#534AB7] to-[#7C74DB] flex items-center justify-center shrink-0 mt-0.5 shadow-md shadow-[#534AB7]/10">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                )}

                {/* Bubble */}
                <div
                  className={`max-w-[78%] px-4 py-3 rounded-2xl shadow-md border text-sm ${
                    msg.role === "user"
                      ? "bg-gradient-to-br from-[#534AB7] to-[#7C74DB] text-white border-white/[0.08] rounded-tr-none"
                      : "bg-[#0E0E12] border-white/[0.06] text-white/90 rounded-tl-none"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    msg.content ? (
                      <MarkdownRenderer
                        content={msg.content}
                        isStreaming={isAssistantStreaming}
                      />
                    ) : (
                      /* Streaming indicator — pulsing dots */
                      <div className="flex items-center gap-1.5 py-1">
                        {[0, 150, 300].map((delay) => (
                          <span
                            key={delay}
                            className="h-1.5 w-1.5 rounded-full bg-[#AFA9EC]/60 animate-bounce"
                            style={{ animationDelay: `${delay}ms` }}
                          />
                        ))}
                      </div>
                    )
                  ) : (
                    <span className="whitespace-pre-wrap">{msg.content}</span>
                  )}
                </div>

                {/* User avatar */}
                {msg.role === "user" && (
                  <div className="h-8 w-8 rounded-full bg-[#1E1B3A] border border-white/[0.08] flex items-center justify-center shrink-0 mt-0.5 shadow-sm text-[#AFA9EC]">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/* Input area */}
      <div className="border-t border-white/[0.06] pt-4 mt-2 shrink-0">
        <div className="flex gap-3 items-end p-2 rounded-2xl border border-white/[0.06] bg-[#0E0E12] focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask CareerPilot anything…  (Shift+Enter for newline)"
            rows={1}
            className="flex-1 bg-transparent border-none px-3 py-2 text-white placeholder:text-white/20 focus:outline-none focus:ring-0 resize-none min-h-[44px] max-h-[160px] text-sm leading-relaxed"
            disabled={isStreaming}
          />
          <Button
            onClick={() => handleSend()}
            disabled={!input.trim() || isStreaming}
            size="icon"
            className="shrink-0 h-[40px] w-[40px] rounded-xl bg-gradient-to-r from-[#534AB7] to-[#6B63CC] hover:from-[#5E55CC] hover:to-[#7A73DD] text-white disabled:opacity-40 transition-all duration-200 shadow-md shadow-[#534AB7]/20"
          >
            {isStreaming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-center text-[10px] text-white/15 mt-2">
          CareerPilot AI can make mistakes. Check important information.
        </p>
      </div>
    </div>
  );
}
