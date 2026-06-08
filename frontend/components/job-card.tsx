"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FitScoreBadge } from "./fit-score-badge";
import {
  MapPin,
  Building2,
  ExternalLink,
  Calendar,
  DollarSign,
  X,
  Briefcase,
  ChevronRight,
  BookmarkPlus,
  Check,
  Sparkles,
  Loader2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Job } from "@/types";

type ScoreUpdate = Pick<Job, "scored_cv_id" | "fit_score_calculated_at" | "fit_score_version">;

interface ScoreResponse extends ScoreUpdate {
  fit_score: number;
  fit_explanation: string;
}

const htmlEntities: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeHtmlEntities(value: string) {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity.startsWith("#x")) {
      const codePoint = Number.parseInt(entity.slice(2), 16);
      return Number.isNaN(codePoint) ? match : String.fromCodePoint(codePoint);
    }

    if (entity.startsWith("#")) {
      const codePoint = Number.parseInt(entity.slice(1), 10);
      return Number.isNaN(codePoint) ? match : String.fromCodePoint(codePoint);
    }

    return htmlEntities[entity] ?? match;
  });
}

function cleanJobDescription(description: string | null | undefined) {
  const raw = description ?? "";
  const withBreaks = raw.replace(/<\/?(br|p|div|li|ul|ol|section|article|h[1-4])[^>]*>/gi, "\n");

  return decodeHtmlEntities(withBreaks.replace(/<[^>]+>/g, " "))
    .replace(/\u00a0/g, " ")
    .replace(/[ \t\r\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function JobCard({
  job,
  onScoreUpdated,
}: {
  job: Job;
  onScoreUpdated?: (jobId: string, fitScore: number, fitExplanation: string, scoreUpdate: ScoreUpdate) => void;
}) {
  const [showModal, setShowModal] = useState(false);
  const [savedToTracker, setSavedToTracker] = useState(false);
  const [savingToTracker, setSavingToTracker] = useState(false);
  const [saveToTrackerError, setSaveToTrackerError] = useState("");

  // Local score states
  const [localFitScore, setLocalFitScore] = useState<number | null>(job.fit_score ?? null);
  const [localFitExplanation, setLocalFitExplanation] = useState<string | null>(job.fit_explanation ?? null);
  const [calculatingFitScore, setCalculatingFitScore] = useState(false);
  const [fitScoreError, setFitScoreError] = useState("");

  // Sync state in render if props change (e.g. after parent batch calculations)
  const [prevJobScore, setPrevJobScore] = useState<number | undefined | null>(job.fit_score);
  const [prevJobExplanation, setPrevJobExplanation] = useState<string | undefined | null>(job.fit_explanation);
  const hasFitScore = typeof localFitScore === "number";

  if (job.fit_score !== prevJobScore || job.fit_explanation !== prevJobExplanation) {
    setPrevJobScore(job.fit_score);
    setPrevJobExplanation(job.fit_explanation);
    setLocalFitScore(job.fit_score ?? null);
    setLocalFitExplanation(job.fit_explanation ?? null);
  }

  const salary = job.salary_range || "Not Disclosed";
  const deadline = job.deadline || "Rolling / Open";
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const cleanDescription = cleanJobDescription(job.description);

  const handleSaveToTracker = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (savedToTracker || savingToTracker || !job.id) return;

    setSavingToTracker(true);
    setSaveToTrackerError("");
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId || !job.id) {
        throw new Error("Please sign in to save jobs to your tracker.");
      }

      const response = await fetch(`${baseUrl}/tracker/applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          job_id: job.id,
          status: "saved",
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to save job to tracker.");
      }

      const data = await response.json();
      if (!data.application?.id) {
        throw new Error("Tracker did not confirm the saved job.");
      }

      setSavedToTracker(true);
      void fetch(`${baseUrl}/copilot/state?user_id=${encodeURIComponent(userId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mark_step_complete: "applications",
          feature_exposure: { feature: "save_to_applications" },
        }),
      }).catch(() => undefined);
    } catch (err) {
      setSavedToTracker(false);
      setSaveToTrackerError(err instanceof Error ? err.message : "Failed to save job to tracker.");
    } finally {
      setSavingToTracker(false);
    }
  };

  const handleCheckFitScore = async () => {
    if (!job.id) return;
    setCalculatingFitScore(true);
    setFitScoreError("");

    try {
      const { data: userData, error: authError } = await supabase.auth.getUser();
      if (authError || !userData?.user) {
        throw new Error("Please sign in to check your fit score.");
      }
      const userId = userData.user.id;

      const response = await fetch(`${baseUrl}/jobs/score/${job.id}?user_id=${userId}`, {
        method: "POST",
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to calculate fit score");
      }

      const scoreData: ScoreResponse = await response.json();
      setLocalFitScore(scoreData.fit_score);
      setLocalFitExplanation(scoreData.fit_explanation);

      if (onScoreUpdated) {
        onScoreUpdated(job.id, scoreData.fit_score, scoreData.fit_explanation, {
          scored_cv_id: scoreData.scored_cv_id,
          fit_score_calculated_at: scoreData.fit_score_calculated_at,
          fit_score_version: scoreData.fit_score_version,
        });
      }
    } catch (err) {
      setFitScoreError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setCalculatingFitScore(false);
    }
  };

  return (
    <>
      {/* ── Card ── */}
      <div className="group cp-surface relative flex flex-col rounded-2xl overflow-hidden transition-all duration-300 hover:border-[var(--cp-border-medium)]">
        {/* Hover glow strip */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--cp-champagne)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Header */}
        <div className="p-5 pb-4">
          <div className="flex justify-between items-start gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-[var(--cp-text-main)] leading-snug line-clamp-2 group-hover:text-[var(--cp-champagne)] transition-colors duration-200">
                {job.title}
              </h3>
              <div className="flex flex-col gap-1 mt-2">
                <span className="flex items-center gap-1.5 text-sm">
                  <Building2 className="h-3.5 w-3.5 shrink-0 text-[var(--cp-text-subtle)]" />
                  <span className="truncate font-medium text-[var(--cp-text-soft)]">{job.company || "Unknown"}</span>
                </span>
                <span className="flex items-center gap-1.5 text-xs text-[var(--cp-text-muted)]">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{job.location || "N/A"}</span>
                </span>
              </div>
            </div>
            {hasFitScore && (
              <div className="shrink-0">
                <FitScoreBadge score={localFitScore} explanation={localFitExplanation ?? undefined} />
              </div>
            )}
          </div>
        </div>

        {/* Meta row */}
        <div className="mx-5 mb-4 flex items-center gap-3 rounded-xl bg-white/[0.03] border border-[var(--cp-border-soft)] px-3 py-2 text-xs text-[var(--cp-text-muted)]">
          <span className="flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5 text-primary/60" />
            {salary}
          </span>
          <span className="h-3 w-px bg-white/10" />
          <span className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-primary/60" />
            {deadline}
          </span>
        </div>

        {/* Description */}
        <div className="px-5 flex-1">
          <p className="text-sm text-[var(--cp-text-muted)] line-clamp-3 leading-relaxed">{cleanDescription}</p>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-4 mt-3 border-t border-[var(--cp-border-soft)] flex items-center gap-2">
          <span className="text-[10px] text-[var(--cp-text-subtle)] bg-white/[0.04] px-2 py-0.5 rounded-md font-mono uppercase tracking-wider">
            {job.source}
          </span>
          <div className="flex flex-wrap justify-end gap-2 ml-auto items-center min-w-0">
            {/* Save to Tracker button */}
            {job.id && (
              <button
                onClick={handleSaveToTracker}
                disabled={savingToTracker || savedToTracker}
                title={savedToTracker ? "Saved to Tracker" : "Save to Tracker"}
                className={`h-7 inline-flex shrink-0 whitespace-nowrap items-center gap-1.5 px-2.5 rounded-lg text-[11px] font-medium border transition-all duration-200 ${
                  savedToTracker
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 cursor-default"
                    : "border-[var(--cp-border-soft)] bg-white/[0.02] text-[var(--cp-text-muted)] hover:text-[var(--cp-text-main)] hover:border-[var(--cp-border-medium)] hover:bg-[rgba(201,130,74,0.10)]"
                } disabled:opacity-60`}
              >
                {savedToTracker ? (
                  <>
                    <Check className="h-3 w-3 shrink-0" />
                    Saved to Tracker
                  </>
                ) : (
                  <>
                    <BookmarkPlus className="h-3 w-3 shrink-0" />
                    Save to Tracker
                  </>
                )}
              </button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowModal(true)}
              className="text-xs rounded-lg gap-1"
            >
              Details <ChevronRight className="h-3 w-3" />
            </Button>
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--cp-border-strong)] bg-gradient-to-r from-[var(--cp-copper-deep)] to-[var(--cp-copper-strong)] text-[var(--cp-bg-deep)] text-xs font-semibold px-3 py-1.5 transition-all duration-150 hover:brightness-110"
            >
              Apply <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
        {saveToTrackerError && (
          <p className="px-5 pb-4 -mt-3 text-xs text-red-400">{saveToTrackerError}</p>
        )}
      </div>

      {/* ── Detail Modal ── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
        >
          <div className="cp-surface-elevated w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl overflow-hidden">
            {/* Modal header */}
            <div className="flex justify-between items-start p-6 border-b border-[var(--cp-border-soft)] bg-white/[0.02]">
              <div className="flex-1 min-w-0 pr-4">
                <span className="text-[10px] text-white/20 bg-white/[0.05] px-2 py-0.5 rounded font-mono uppercase tracking-wider">
                  {job.source}
                </span>
                <h2 className="font-display text-2xl font-semibold text-[var(--cp-text-main)] mt-2 leading-snug">{job.title}</h2>
                <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-white/40">
                  <span className="flex items-center gap-1.5 text-white/70 font-medium">
                    <Building2 className="h-4 w-4 text-white/30" /> {job.company}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" /> {job.location}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="h-8 w-8 flex items-center justify-center rounded-lg border border-white/[0.08] text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Fit score calculation section */}
              {hasFitScore ? (
                <div className="flex flex-col md:flex-row gap-4 items-center md:items-start rounded-xl bg-[rgba(201,130,74,0.08)] border border-[var(--cp-border-medium)] p-4">
                  <div className="shrink-0">
                    <FitScoreBadge score={localFitScore} />
                  </div>
                  <div className="space-y-1 text-center md:text-left flex-1">
                    <p className="text-xs font-semibold text-[var(--cp-copper-strong)] uppercase tracking-wider">Fit Match</p>
                    <p className="text-sm text-[var(--cp-text-muted)] italic leading-relaxed">
                      &ldquo;{localFitExplanation}&rdquo;
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {calculatingFitScore ? (
                    <div className="flex items-center justify-center gap-2 rounded-xl bg-white/[0.03] border border-white/[0.05] p-4 text-sm text-white/60">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span>Calculating your fit...</span>
                    </div>
                  ) : (
                    <button
                      onClick={handleCheckFitScore}
                      className="w-full flex items-center justify-center gap-2 rounded-xl border border-[var(--cp-border-strong)] bg-gradient-to-r from-[var(--cp-copper-deep)] via-[var(--cp-copper)] to-[var(--cp-copper-strong)] text-[var(--cp-bg-deep)] text-sm font-semibold py-3 px-4 transition-all duration-200 shadow-md shadow-[var(--cp-glow-copper)] hover:brightness-110"
                    >
                      <Sparkles className="h-4 w-4 text-white animate-pulse" />
                      Check My Fit Score
                    </button>
                  )}
                  {fitScoreError && (
                    <p className="text-xs text-red-400 text-center mt-1">{fitScoreError}</p>
                  )}
                </div>
              )}

              {/* Quick info */}
              <div className="grid grid-cols-2 gap-4 rounded-xl bg-white/[0.03] border border-[var(--cp-border-soft)] p-4 text-xs">
                <div className="space-y-1">
                  <span className="text-white/30 block">Salary Range</span>
                  <span className="text-white font-semibold flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5 text-primary" /> {salary}
                  </span>
                </div>
                <div className="space-y-1 pl-4 border-l border-white/[0.05]">
                  <span className="text-white/30 block">Deadline</span>
                  <span className="text-white font-semibold flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-primary" /> {deadline}
                  </span>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <h3 className="text-[11px] font-bold text-white/30 uppercase tracking-wider flex items-center gap-1.5">
                  <Briefcase className="h-3.5 w-3.5" /> Job Description
                </h3>
                <div className="rounded-xl bg-white/[0.02] border border-white/[0.05] p-4 text-sm text-white/50 leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
                  {cleanDescription}
                </div>
              </div>
            </div>

            {/* Modal footer */}
            <div className="p-4 border-t border-white/[0.06] flex flex-col-reverse gap-2 bg-white/[0.02] sm:flex-row sm:justify-end">
              <Button variant="ghost" size="sm" onClick={() => setShowModal(false)} className="text-white/40 hover:text-white">
                Close
              </Button>
              {job.id && (
                <button
                  onClick={handleSaveToTracker}
                  disabled={savingToTracker || savedToTracker}
                  className={`inline-flex shrink-0 whitespace-nowrap items-center justify-center gap-1.5 rounded-lg border text-sm font-medium px-4 py-2 transition-all duration-200 ${
                    savedToTracker
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 cursor-default"
                      : "border-white/[0.08] bg-white/[0.04] text-white/60 hover:text-white hover:border-primary/40 hover:bg-primary/10"
                  } disabled:opacity-60`}
                >
                  {savedToTracker ? (
                    <><Check className="h-4 w-4 shrink-0" /> Saved to Tracker</>
                  ) : (
                    <><BookmarkPlus className="h-4 w-4 shrink-0" /> Save to Tracker</>
                  )}
                </button>
              )}
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 whitespace-nowrap items-center justify-center gap-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-sm font-medium px-4 py-2 transition-colors duration-150"
              >
                Apply Now <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              </a>
            </div>
            {saveToTrackerError && (
              <p className="px-4 pb-4 -mt-2 text-right text-xs text-red-400">{saveToTrackerError}</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
