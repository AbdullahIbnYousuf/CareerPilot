"use client";

import { useState } from "react";
import { Compass, X, ExternalLink } from "lucide-react";

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
    <div className="relative overflow-hidden rounded-2xl border border-[var(--cp-border-medium)] bg-[rgba(201,130,74,0.08)] shadow-lg shadow-[var(--cp-glow-copper)] animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="relative flex flex-col gap-3 rounded-[15px] bg-[var(--cp-surface-elevated)] px-5 py-4 backdrop-blur-md">
        {/* Main message row */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(201,130,74,0.14)] border border-[var(--cp-border-soft)] text-[var(--cp-champagne)] shrink-0">
              <Compass className="h-4 w-4" />
            </div>
            <p className="text-sm font-medium text-[var(--cp-text-main)]">
              {message}
            </p>
          </div>
          <button
            id="nudge-dismiss-btn"
            onClick={handleDismiss}
            className="text-[var(--cp-text-muted)] hover:text-[var(--cp-text-main)] transition-colors shrink-0 mt-0.5"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Dismiss</span>
          </button>
        </div>

        {/* Linked Jobs list */}
        {jobs && jobs.length > 0 && (
          <div className="mt-1 border-t border-white/[0.06] pt-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--cp-text-muted)] mb-2">Suggested roles</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              {jobs.slice(0, 3).map((job) => (
                <div 
                  key={job.id} 
                  className="flex items-center justify-between rounded-xl bg-white/[0.02] border border-[var(--cp-border-soft)] p-3 hover:border-[var(--cp-border-medium)] hover:bg-white/[0.04] transition-all"
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="text-xs font-semibold text-[var(--cp-text-main)] truncate">{job.title}</p>
                    <p className="text-[10px] text-[var(--cp-text-muted)] truncate mt-0.5">{job.company}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {job.fit_score !== undefined && job.fit_score !== null && (
                      <span className={`text-[10px] font-bold ${
                        job.fit_score >= 85 ? "text-[var(--cp-fit-high)]" : job.fit_score >= 55 ? "text-[var(--cp-fit-good)]" : "text-[var(--cp-fit-low)]"
                      }`}>
                        {job.fit_score}%
                      </span>
                    )}
                    {job.url && (
                      <a
                        href={job.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-[rgba(201,130,74,0.14)] text-[var(--cp-champagne)] hover:bg-[rgba(201,130,74,0.24)] transition-all border border-[var(--cp-border-medium)]"
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
