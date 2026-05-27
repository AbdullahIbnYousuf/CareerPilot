"use client";

import { ChatInterface } from "@/components/chat-interface";
import { Bot } from "lucide-react";

export default function AiPage() {
  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-100px)]">
      {/* Page header */}
      <div className="space-y-1 shrink-0">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-6 w-6 rounded-md bg-primary/20 flex items-center justify-center">
            <Bot className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="text-xs font-semibold text-primary uppercase tracking-widest">Co-Pilot</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white">AI Assistant</h1>
        <p className="text-white/40 text-sm mt-1">
          Chat with an AI that knows your CV inside out.
        </p>
      </div>

      <div className="flex-1 min-h-0">
        <ChatInterface />
      </div>
    </div>
  );
}
