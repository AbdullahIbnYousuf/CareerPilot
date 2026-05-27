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
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#534AB7] via-[#6B63CC] to-[#7C74DB] p-[1px] shadow-lg shadow-[#534AB7]/10">
      <div className="relative flex items-center justify-between gap-4 rounded-[15px] bg-[#0E0E12]/95 px-5 py-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1E1B3A] border border-white/[0.04] text-[#AFA9EC]">
            <Sparkles className="h-4 w-4" />
          </div>
          <p className="text-sm font-medium text-white/90">
            <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#7C74DB] to-[#AFA9EC] mr-1">AI Nudge:</span>
            {message}
          </p>
        </div>
        <button
          onClick={() => setIsVisible(false)}
          className="text-white/40 hover:text-white transition-colors shrink-0"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Dismiss</span>
        </button>
      </div>
    </div>
  );
}
