"use client";

import { useEffect, useState, useCallback } from "react";
import { ChatInterface } from "@/components/chat-interface";
import {
  Bot,
  Plus,
  Trash2,
  MessageSquare,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChatSession {
  id: string;          // UUID
  title: string;       // derived from first user message
  createdAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateUUID(): string {
  // RFC-4122 v4 UUID — safe for Supabase uuid columns
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function truncate(str: string, n: number) {
  return str.length > n ? str.slice(0, n) + "…" : str;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AiPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [userId, setUserId] = useState<string | null>(null);
  const [isMobileDropdownOpen, setIsMobileDropdownOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(true);

  // ── Get user ────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data, error }) => {
      if (!error) setUserId(data.user?.id ?? null);
    });
  }, []);

  // ── Load sessions from Supabase ──────────────────────────────────────────────
  const loadSessions = useCallback(async () => {
    if (!userId) return;
    setLoadingSessions(true);
    try {
      // Get the first message per session to derive a title
      const { data, error } = await supabase
        .from("chat_messages")
        .select("session_id, content, created_at")
        .eq("user_id", userId)
        .eq("role", "user")
        .order("created_at", { ascending: true });

      if (error || !data) return;

      // Deduplicate: keep only the first message per session_id
      const seen = new Map<string, ChatSession>();
      for (const row of data) {
        if (!seen.has(row.session_id)) {
          seen.set(row.session_id, {
            id: row.session_id,
            title: truncate(row.content, 42),
            createdAt: row.created_at,
          });
        }
      }

      // Sort newest first
      const sorted = Array.from(seen.values()).sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setSessions(sorted);

      // If we have sessions and none is active, pick the newest
      if (sorted.length > 0 && !activeSessionId) {
        setActiveSessionId(sorted[0].id);
      }
    } finally {
      setLoadingSessions(false);
    }
  }, [userId, activeSessionId]);

  useEffect(() => {
    if (userId) loadSessions();
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Create a new session ─────────────────────────────────────────────────────
  const handleNewChat = () => {
    const newId = generateUUID();
    setActiveSessionId(newId);
    // Session row will be populated once the user sends the first message
    setIsMobileDropdownOpen(false);
    // Optimistically add a placeholder to the list
    setSessions((prev) => [
      {
        id: newId,
        title: "New conversation",
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
  };

  // ── Clear current session's history ─────────────────────────────────────────
  const handleClearHistory = async () => {
    if (!userId || !activeSessionId || isClearing) return;
    setIsClearing(true);
    try {
      await supabase
        .from("chat_messages")
        .delete()
        .eq("user_id", userId)
        .eq("session_id", activeSessionId);

      // Remove from sessions list and start fresh new chat
      setSessions((prev) => prev.filter((s) => s.id !== activeSessionId));
      handleNewChat();
    } finally {
      setIsClearing(false);
    }
  };

  // ── Refresh session list when a new session sends its first message ──────────
  // (handled by passing loadSessions as onFirstMessage to ChatInterface)

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-[calc(100vh-100px)] gap-0">

      {/* ── Desktop session sidebar ─────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 bg-white/[0.015] border border-white/[0.05] rounded-2xl mr-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/[0.05]">
          <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">
            Chats
          </span>
          <button
            onClick={handleNewChat}
            title="New chat"
            className="h-7 w-7 rounded-lg border border-white/[0.07] flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/[0.05] transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto py-2 space-y-0.5 scrollbar-thin scrollbar-thumb-white/10">
          {loadingSessions && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin text-white/20" />
            </div>
          )}
          {!loadingSessions && sessions.length === 0 && (
            <p className="px-4 py-3 text-xs text-white/20 text-center">
              No conversations yet
            </p>
          )}
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSessionId(s.id)}
              className={`w-full flex items-start gap-2.5 px-3 py-2.5 rounded-xl mx-1 text-left transition-all duration-150 group ${
                s.id === activeSessionId
                  ? "bg-[#1E1B3A] text-[#AFA9EC]"
                  : "text-white/35 hover:bg-white/[0.03] hover:text-white/60"
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5 shrink-0 mt-0.5 opacity-60" />
              <span className="text-xs leading-snug line-clamp-2">
                {s.title}
              </span>
            </button>
          ))}
        </div>
      </aside>

      {/* ── Main chat panel ─────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">

        {/* Page header */}
        <div className="shrink-0 flex items-start justify-between mb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-6 w-6 rounded-md bg-primary/20 flex items-center justify-center">
                <Bot className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-xs font-semibold text-primary uppercase tracking-widest">
                Co-Pilot
              </span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              AI Assistant
            </h1>
            <p className="text-white/40 text-sm mt-1">
              {activeSession?.title && activeSession.title !== "New conversation"
                ? truncate(activeSession.title, 60)
                : "Chat with an AI that knows your CV inside out."}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0 mt-1">
            {/* Mobile session switcher */}
            <div className="relative md:hidden">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsMobileDropdownOpen((v) => !v)}
                className="gap-1.5 border-white/[0.08] bg-white/[0.02] text-white/50 text-xs"
              >
                Sessions
                <ChevronDown className="h-3 w-3" />
              </Button>
              {isMobileDropdownOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-56 bg-[#0E0E12] border border-white/[0.08] rounded-xl shadow-xl z-50 overflow-hidden">
                  <button
                    onClick={handleNewChat}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-white/60 hover:bg-white/[0.05] transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    New conversation
                  </button>
                  <div className="border-t border-white/[0.05] max-h-60 overflow-y-auto">
                    {sessions.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          setActiveSessionId(s.id);
                          setIsMobileDropdownOpen(false);
                        }}
                        className={`w-full flex items-start gap-2 px-3 py-2.5 text-left transition-colors ${
                          s.id === activeSessionId
                            ? "bg-[#1E1B3A] text-[#AFA9EC]"
                            : "text-white/40 hover:bg-white/[0.04]"
                        }`}
                      >
                        <MessageSquare className="h-3 w-3 shrink-0 mt-0.5 opacity-60" />
                        <span className="text-xs line-clamp-1">{s.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* New Chat (desktop shortcut) */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleNewChat}
              className="hidden md:flex gap-1.5 border-white/[0.08] bg-white/[0.02] text-white/50 hover:text-white/70 hover:bg-white/[0.04] text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              New chat
            </Button>

            {/* Clear history */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearHistory}
              disabled={isClearing || !activeSession || sessions.length === 0}
              className="gap-1.5 border-white/[0.08] bg-white/[0.02] text-white/30 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/5 text-xs disabled:opacity-30 transition-all"
            >
              {isClearing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">Clear chat</span>
            </Button>
          </div>
        </div>

        {/* Chat interface */}
        <div className="flex-1 min-h-0">
          {activeSessionId ? (
            <ChatInterface
              key={activeSessionId}
              sessionId={activeSessionId}
              onFirstMessage={loadSessions}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-5 w-5 animate-spin text-white/20" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
