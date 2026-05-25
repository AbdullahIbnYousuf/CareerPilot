"use client";

import { ChatInterface } from "@/components/chat-interface";

export default function ChatPage() {
  return (
    <div className="space-y-4 flex flex-col h-[calc(100vh-100px)]">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Assistant</h1>
        <p className="text-muted-foreground mt-1">
          Chat with an AI that knows your CV inside out.
        </p>
      </div>

      <div className="flex-1 min-h-0">
        <ChatInterface />
      </div>
    </div>
  );
}
