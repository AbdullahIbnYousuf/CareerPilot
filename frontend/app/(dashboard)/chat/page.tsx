"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import type { ChatSession } from "@/types";

interface ChatSessionRow {
  id: string;
  title: string;
  created_at: string | null;
  updated_at: string | null;
}

const DEFAULT_SESSION_TITLE = "New conversation";
const SESSION_TITLE_LIMIT = 42;
const ACTIVE_SESSION_KEY_PREFIX = "careerpilot:active-chat:";

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function truncate(str: string, n: number) {
  return str.length > n ? str.slice(0, n) + "..." : str;
}

function activeSessionStorageKey(userId: string) {
  return `${ACTIVE_SESSION_KEY_PREFIX}${userId}`;
}

function mapChatSession(row: ChatSessionRow): ChatSession {
  const createdAt = row.created_at ?? row.updated_at ?? new Date().toISOString();
  return {
    id: row.id,
    title: row.title || DEFAULT_SESSION_TITLE,
    createdAt,
    updatedAt: row.updated_at ?? createdAt,
  };
}

function sortSessions(sessions: ChatSession[]) {
  return [...sessions].sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export default function AiPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [userId, setUserId] = useState<string | null>(null);
  const [isMobileDropdownOpen, setIsMobileDropdownOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const activeSessionIdRef = useRef("");

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data, error }) => {
      if (!error && data.user) {
        setUserId(data.user.id);
      } else {
        setUserId(null);
        setLoadingSessions(false);
      }
    });
  }, []);

  const persistActiveSessionId = useCallback(
    (sessionId: string) => {
      setActiveSessionId(sessionId);
      activeSessionIdRef.current = sessionId;

      if (userId) {
        window.localStorage.setItem(
          activeSessionStorageKey(userId),
          sessionId
        );
      }
    },
    [userId]
  );

  const createSession = useCallback(
    async (makeActive = true): Promise<ChatSession | null> => {
      if (!userId) return null;

      const now = new Date().toISOString();
      const session: ChatSession = {
        id: generateUUID(),
        title: DEFAULT_SESSION_TITLE,
        createdAt: now,
        updatedAt: now,
      };

      const { error } = await supabase.from("chat_sessions").insert({
        id: session.id,
        user_id: userId,
        title: session.title,
        created_at: session.createdAt,
        updated_at: session.updatedAt,
      });

      if (error) return null;

      setSessions((prev) =>
        sortSessions([session, ...prev.filter((s) => s.id !== session.id)])
      );

      if (makeActive) {
        persistActiveSessionId(session.id);
      }

      setIsMobileDropdownOpen(false);
      return session;
    },
    [persistActiveSessionId, userId]
  );

  const loadSessions = useCallback(async () => {
    if (!userId) return;

    setLoadingSessions(true);
    try {
      const { data, error } = await supabase
        .from("chat_sessions")
        .select("id, title, created_at, updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });

      if (error || !data) {
        if (!activeSessionIdRef.current) {
          await createSession();
        }
        return;
      }

      const sorted = sortSessions((data as ChatSessionRow[]).map(mapChatSession));
      setSessions(sorted);

      const storedSessionId = window.localStorage.getItem(
        activeSessionStorageKey(userId)
      );
      const currentSessionId = activeSessionIdRef.current;
      const nextActiveSession =
        sorted.find((s) => s.id === currentSessionId)?.id ??
        sorted.find((s) => s.id === storedSessionId)?.id ??
        sorted[0]?.id;

      if (nextActiveSession) {
        persistActiveSessionId(nextActiveSession);
      } else {
        await createSession();
      }
    } finally {
      setLoadingSessions(false);
    }
  }, [createSession, persistActiveSessionId, userId]);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      if (!cancelled) {
        void loadSessions();
      }
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [loadSessions, userId]);

  const handleNewChat = async () => {
    await createSession();
  };

  const handleSelectSession = (sessionId: string) => {
    persistActiveSessionId(sessionId);
    setIsMobileDropdownOpen(false);
  };

  const handleClearHistory = async () => {
    if (!userId || !activeSessionId || isClearing) return;

    const sessionIdToClear = activeSessionId;
    setIsClearing(true);
    try {
      await supabase
        .from("chat_messages")
        .delete()
        .eq("user_id", userId)
        .eq("session_id", sessionIdToClear);

      await supabase
        .from("chat_sessions")
        .delete()
        .eq("user_id", userId)
        .eq("id", sessionIdToClear);

      setSessions((prev) => prev.filter((s) => s.id !== sessionIdToClear));
      window.localStorage.removeItem(activeSessionStorageKey(userId));
      setActiveSessionId("");
      activeSessionIdRef.current = "";
      await createSession();
    } finally {
      setIsClearing(false);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!userId || deletingSessionId) return;

    const session = sessions.find((s) => s.id === sessionId);
    const confirmed = window.confirm(
      `Delete "${session?.title ?? "this chat"}"? This cannot be undone.`
    );

    if (!confirmed) return;

    setDeletingSessionId(sessionId);
    try {
      const { error } = await supabase
        .from("chat_sessions")
        .delete()
        .eq("user_id", userId)
        .eq("id", sessionId);

      if (error) return;

      const remainingSessions = sessions.filter((s) => s.id !== sessionId);
      setSessions(remainingSessions);

      if (sessionId !== activeSessionIdRef.current) return;

      const nextSession = remainingSessions[0];
      if (nextSession) {
        persistActiveSessionId(nextSession.id);
      } else {
        window.localStorage.removeItem(activeSessionStorageKey(userId));
        setActiveSessionId("");
        activeSessionIdRef.current = "";
        await createSession();
      }
    } finally {
      setDeletingSessionId(null);
    }
  };

  const handleFirstMessage = (text: string) => {
    const now = new Date().toISOString();
    const title = truncate(text.trim(), SESSION_TITLE_LIMIT);

    setSessions((prev) => {
      const exists = prev.some((s) => s.id === activeSessionId);
      if (exists) {
        return sortSessions(
          prev.map((s) =>
            s.id === activeSessionId ? { ...s, title, updatedAt: now } : s
          )
        );
      }

      return sortSessions([
        {
          id: activeSessionId,
          title,
          createdAt: now,
          updatedAt: now,
        },
        ...prev,
      ]);
    });
  };

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  return (
    <div className="flex h-[calc(100vh-100px)] gap-0">
      <aside className="hidden md:flex flex-col w-60 shrink-0 bg-white/[0.015] border border-white/[0.05] rounded-2xl mr-4 overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/[0.05]">
          <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">
            Chats
          </span>
          <button
            onClick={() => {
              void handleNewChat();
            }}
            title="New chat"
            className="h-7 w-7 rounded-lg border border-white/[0.07] flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/[0.05] transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

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
            <div
              key={s.id}
              className={`w-full flex items-start gap-2.5 px-3 py-2.5 rounded-xl mx-1 text-left transition-all duration-150 group ${
                s.id === activeSessionId
                  ? "bg-[#1E1B3A] text-[#AFA9EC]"
                  : "text-white/35 hover:bg-white/[0.03] hover:text-white/60"
              }`}
            >
              <button
                type="button"
                onClick={() => handleSelectSession(s.id)}
                className="flex min-w-0 flex-1 items-start gap-2.5 text-left"
              >
                <MessageSquare className="h-3.5 w-3.5 shrink-0 mt-0.5 opacity-60" />
                <span className="min-w-0 text-xs leading-snug line-clamp-2">
                  {s.title}
                </span>
              </button>
              <button
                type="button"
                title="Delete chat"
                aria-label={`Delete ${s.title}`}
                disabled={deletingSessionId !== null}
                onClick={() => {
                  void handleDeleteSession(s.id);
                }}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-white/20 opacity-0 transition-all hover:bg-red-500/10 hover:text-red-400 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30 disabled:pointer-events-none group-hover:opacity-100"
              >
                {deletingSessionId === s.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Trash2 className="h-3 w-3" />
                )}
              </button>
            </div>
          ))}
        </div>
      </aside>

      <div className="flex flex-col flex-1 min-w-0">
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
              {activeSession?.title &&
              activeSession.title !== DEFAULT_SESSION_TITLE
                ? truncate(activeSession.title, 60)
                : "Chat with an AI that knows your CV inside out."}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 mt-1">
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
                    onClick={() => {
                      void handleNewChat();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-white/60 hover:bg-white/[0.05] transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    New conversation
                  </button>
                  <div className="border-t border-white/[0.05] max-h-60 overflow-y-auto">
                    {sessions.map((s) => (
                      <div
                        key={s.id}
                        className={`w-full flex items-start gap-2 px-3 py-2.5 text-left transition-colors ${
                          s.id === activeSessionId
                            ? "bg-[#1E1B3A] text-[#AFA9EC]"
                            : "text-white/40 hover:bg-white/[0.04]"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleSelectSession(s.id)}
                          className="flex min-w-0 flex-1 items-start gap-2 text-left"
                        >
                          <MessageSquare className="h-3 w-3 shrink-0 mt-0.5 opacity-60" />
                          <span className="min-w-0 text-xs line-clamp-1">
                            {s.title}
                          </span>
                        </button>
                        <button
                          type="button"
                          title="Delete chat"
                          aria-label={`Delete ${s.title}`}
                          disabled={deletingSessionId !== null}
                          onClick={() => {
                            void handleDeleteSession(s.id);
                          }}
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-white/30 transition-colors hover:bg-red-500/10 hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30 disabled:pointer-events-none"
                        >
                          {deletingSessionId === s.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void handleNewChat();
              }}
              className="hidden md:flex gap-1.5 border-white/[0.08] bg-white/[0.02] text-white/50 hover:text-white/70 hover:bg-white/[0.04] text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              New chat
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void handleClearHistory();
              }}
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

        <div className="flex-1 min-h-0">
          {activeSessionId ? (
            <ChatInterface
              key={activeSessionId}
              sessionId={activeSessionId}
              onFirstMessage={handleFirstMessage}
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
