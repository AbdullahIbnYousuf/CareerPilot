"use client";

import { useState } from "react";
import { X, Sparkles } from "lucide-react";

interface NudgeBannerProps {
  message: string;
}

export function NudgeBanner({ message }: NudgeBannerProps) {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 p-1">
      <div className="relative flex items-center justify-between gap-4 rounded-lg bg-background/90 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <p className="text-sm font-medium">
            <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-pink-500 mr-1">AI Nudge:</span>
            {message}
          </p>
        </div>
        <button
          onClick={() => setIsVisible(false)}
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Dismiss</span>
        </button>
      </div>
    </div>
  );
}
