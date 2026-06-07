"use client";

import { useState } from "react";
import { X, Sparkles, ExternalLink } from "lucide-react";

interface NudgeBannerProps {
  message: string;
  jobs?: {
    id: string;
    title: string;
    company: string;
    fit_score?: number | null;
    url?: string;
  }[];
  /** Optional: called when the user dismisses. Parent handles DB PATCH. */
  onDismiss?: () => void;
}

export function NudgeBanner({ message, jobs, onDismiss }: NudgeBannerProps) {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#534AB7] via-[#6B63CC] to-[#7C74DB] p-[1px] shadow-lg shadow-[#534AB7]/10 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="relative flex flex-col gap-3 rounded-[15px] bg-[#0E0E12]/95 px-5 py-4 backdrop-blur-md">
        {/* Main message row */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1E1B3A] border border-white/[0.04] text-[#AFA9EC] shrink-0">
              <Sparkles className="h-4 w-4" />
            </div>
            <p className="text-sm font-medium text-white/90">
              {message}
            </p>
          </div>
          <button
            id="nudge-dismiss-btn"
            onClick={handleDismiss}
            className="text-white/40 hover:text-white transition-colors shrink-0 mt-0.5"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Dismiss</span>
          </button>
        </div>

        {/* Linked Jobs list */}
        {jobs && jobs.length > 0 && (
          <div className="mt-1 border-t border-white/[0.06] pt-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/35 mb-2">Suggested Roles</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              {jobs.slice(0, 3).map((job) => (
                <div 
                  key={job.id} 
                  className="flex items-center justify-between rounded-xl bg-white/[0.02] border border-white/[0.04] p-3 hover:bg-white/[0.04] transition-all"
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="text-xs font-semibold text-white/90 truncate">{job.title}</p>
                    <p className="text-[10px] text-white/40 truncate mt-0.5">{job.company}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {job.fit_score !== undefined && job.fit_score !== null && (
                      <span className={`text-[10px] font-bold ${
                        job.fit_score >= 70 ? "text-emerald-400" : job.fit_score >= 40 ? "text-amber-400" : "text-red-400"
                      }`}>
                        {job.fit_score}%
                      </span>
                    )}
                    {job.url && (
                      <a
                        href={job.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-[#534AB7]/20 text-[#AFA9EC] hover:bg-[#534AB7]/30 transition-all border border-[#534AB7]/20"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
