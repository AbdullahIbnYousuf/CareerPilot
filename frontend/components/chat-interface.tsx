"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Send, Loader2, Bot, User } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { ChatMessage } from "@/types";

export function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  useEffect(() => {
    const loadUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!error) {
        setUserId(data.user?.id ?? null);
      }
    };
    loadUser();
  }, []);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    if (!userId) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Please sign in to start chatting." },
      ]);
      return;
    }

    const userMsg: ChatMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsStreaming(true);

    // Add an empty assistant message that we'll stream into
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          session_id: "default-session",
          message: text,
        }),
      });

      if (!res.ok) throw new Error("Chat request failed");

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error("No response stream");

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") continue;

          try {
            const parsed = JSON.parse(payload);
            if (parsed.token) {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last.role === "assistant") {
                  last.content += parsed.token;
                }
                return updated;
              });
            }
            if (parsed.error) {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last.role === "assistant") {
                  last.content = `Error: ${parsed.error}`;
                }
                return updated;
              });
            }
          } catch {
            // skip non-JSON lines
          }
        }
      }
    } catch (err) {
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last.role === "assistant") {
          last.content =
            "Sorry, something went wrong connecting to the server.";
        }
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-5 pr-2 pb-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto py-12">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-[#534AB7]/20 to-[#7C74DB]/10 flex items-center justify-center shadow-lg shadow-primary/10 mb-6 border border-white/[0.04] animate-pulse">
              <Bot className="h-8 w-8 text-[#7C74DB]" />
            </div>
            <p className="text-xl font-bold text-white tracking-tight">CareerPilot AI</p>
            <p className="text-sm text-white/40 mt-2 leading-relaxed">
              Ask me anything about your career — job advice, CV tips, cover
              letters, or interview prep. I know your CV inside out.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-3 ${
              msg.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            {msg.role === "assistant" && (
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#534AB7] to-[#7C74DB] flex items-center justify-center shrink-0 mt-0.5 shadow-md shadow-[#534AB7]/10">
                <Bot className="h-4 w-4 text-white" />
              </div>
            )}

            <div
              className={`max-w-[75%] px-4 py-3 text-sm whitespace-pre-wrap rounded-2xl shadow-md border ${
                msg.role === "user"
                  ? "bg-gradient-to-br from-[#534AB7] to-[#7C74DB] text-white border-white/[0.08] rounded-tr-none"
                  : "bg-[#0E0E12] border-white/[0.06] text-white/90 rounded-tl-none"
              }`}
            >
              {msg.content || (
                <Loader2 className="h-4 w-4 animate-spin text-[#7C74DB]" />
              )}
            </div>

            {msg.role === "user" && (
              <div className="h-8 w-8 rounded-full bg-[#1E1B3A] border border-white/[0.08] flex items-center justify-center shrink-0 mt-0.5 shadow-sm text-[#AFA9EC]">
                <User className="h-4 w-4" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Input area */}
      <div className="border-t border-white/[0.06] pt-4 mt-2">
        <div className="flex gap-3 items-end p-2 rounded-2xl border border-white/[0.06] bg-[#0E0E12] focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask CareerPilot anything..."
            rows={1}
            className="flex-1 bg-transparent border-none px-3 py-2 text-white placeholder:text-white/20 focus:outline-none focus:ring-0 resize-none min-h-[44px] max-h-[160px] text-sm leading-relaxed"
            disabled={isStreaming}
          />
          <Button
            onClick={handleSend}
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
      </div>
    </div>
  );
}
