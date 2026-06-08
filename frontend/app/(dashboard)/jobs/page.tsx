"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { JobCard } from "@/components/job-card";
import { supabase } from "@/lib/supabase";
import type { Job } from "@/types";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Briefcase, MapPin, Sparkles } from "lucide-react";

interface LastJobSearchState {
  jobs: Job[];
  query: string;
  location: string;
  timestamp: number;
  active_cv_id: string | null;
}

interface CvUpdatedDetail {
  userId: string;
  cvId: string;
}

function JobsPageContent() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [activeCvId, setActiveCvId] = useState<string | null>(null);
  const [profileMetadataLoaded, setProfileMetadataLoaded] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Hunting roles...");
  const autoSearchKeyRef = useRef<string | null>(null);
  const storageKey = userId ? `careerPilot_lastJobSearch:v2:${userId}` : null;
  const routeQuery = searchParams.get("query") ?? "";
  const routeLocation = searchParams.get("location") ?? "";
  const shouldAutoSearch = searchParams.get("auto") === "1";

  useEffect(() => {
    const loadUserAndHistory = async () => {
      setProfileMetadataLoaded(false);
      const { data, error: authError } = await supabase.auth.getUser();
      if (!authError && data.user) {
        const id = data.user.id;
        setUserId(id);

        localStorage.removeItem(`careerPilot_lastJobSearch:${id}`);

        let currentCvId: string | null = null;
        try {
          const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
          const profileResponse = await fetch(
            `${baseUrl}/api/cv/profile?user_id=${encodeURIComponent(id)}`,
          );
          if (profileResponse.ok) {
            const body: { profile?: { active_cv_id?: string | null } | null } = await profileResponse.json();
            currentCvId = body.profile?.active_cv_id ?? null;
            setActiveCvId(currentCvId);
          }
        } catch (e) {
          console.error("Failed to load active CV metadata", e);
        } finally {
          setProfileMetadataLoaded(true);
        }

        // Load saved scored jobs search history from localStorage
        const saved = localStorage.getItem(`careerPilot_lastJobSearch:v2:${id}`);
        if (saved) {
          try {
            const parsed = JSON.parse(saved) as Partial<LastJobSearchState>;
            const savedJobs = Array.isArray(parsed.jobs) ? parsed.jobs : [];
            const hasNumericScores = savedJobs.some((job: Job) => typeof job.fit_score === "number");
            const isSameCv = !currentCvId || parsed.active_cv_id === currentCvId;
            if (!hasNumericScores || !isSameCv) {
              localStorage.removeItem(`careerPilot_lastJobSearch:v2:${id}`);
              return;
            }
            setJobs(savedJobs);
            if (!routeQuery && parsed.query) setQuery(parsed.query);
            if (!routeLocation && parsed.location) setLocation(parsed.location);
            if (savedJobs.length > 0) {
              setSearched(true);
            }
          } catch (e) {
            console.error("Failed to load saved jobs search", e);
          }
        }
      } else {
        setProfileMetadataLoaded(true);
      }
    };
    loadUserAndHistory();
  }, [routeLocation, routeQuery]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (routeQuery) {
        setQuery(routeQuery);
      }
      if (routeLocation) {
        setLocation(routeLocation);
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [routeLocation, routeQuery]);

  useEffect(() => {
    const handleCvUpdated = (event: Event) => {
      const detail = (event as CustomEvent<CvUpdatedDetail>).detail;
      if (!userId || !detail || detail.userId !== userId) return;

      if (storageKey) {
        localStorage.removeItem(storageKey);
      }
      setActiveCvId(detail.cvId);
      setJobs([]);
      setSearched(false);
      setError("");
    };

    window.addEventListener("careerpilot:cv-updated", handleCvUpdated);
    return () => {
      window.removeEventListener("careerpilot:cv-updated", handleCvUpdated);
    };
  }, [storageKey, userId]);

  const runSearch = useCallback(async (searchQuery: string, searchLocation: string) => {
    const trimmedQuery = searchQuery.trim();
    const trimmedLocation = searchLocation.trim();
    if (!trimmedQuery) return;
    if (!userId) {
      setError("Please sign in to search for jobs.");
      return;
    }

    setLoading(true);
    setError("");
    setSearched(true);
    setLoadingMessage("Hunting roles...");
    const scoringTimer = window.setTimeout(() => {
      setLoadingMessage("Scoring matches...");
    }, 900);

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${baseUrl}/jobs/hunt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          query: trimmedQuery,
          location: trimmedLocation,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to fetch jobs");
      }

      const data: { jobs?: Job[] } = await response.json();
      const huntedJobs = data.jobs ?? [];
      const scoredCvId = huntedJobs.find((job: Job) => job.scored_cv_id)?.scored_cv_id ?? activeCvId;
      setActiveCvId(scoredCvId ?? null);
      setJobs(huntedJobs);

      // Save to localStorage immediately after search
      const state: LastJobSearchState = {
        jobs: huntedJobs,
        query: trimmedQuery,
        location: trimmedLocation,
        timestamp: Date.now(),
        active_cv_id: scoredCvId ?? null,
      };
      if (storageKey) {
        localStorage.setItem(storageKey, JSON.stringify(state));
      }
      void fetch(`${baseUrl}/copilot/state?user_id=${encodeURIComponent(userId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mark_step_complete: "job_review",
          feature_exposure: { feature: "jobs_results" },
        }),
      }).catch(() => undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      window.clearTimeout(scoringTimer);
      setLoading(false);
    }
  }, [activeCvId, storageKey, userId]);

  useEffect(() => {
    if (!shouldAutoSearch || !userId || !profileMetadataLoaded || loading) return;
    const trimmedQuery = routeQuery.trim();
    if (!trimmedQuery) return;

    const autoKey = `${trimmedQuery}|${routeLocation.trim()}`;
    if (autoSearchKeyRef.current === autoKey) return;

    autoSearchKeyRef.current = autoKey;
    void runSearch(trimmedQuery, routeLocation);
  }, [loading, profileMetadataLoaded, routeLocation, routeQuery, runSearch, shouldAutoSearch, userId]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    await runSearch(query, location);
  };

  const handleScoreUpdated = (
    jobId: string,
    fitScore: number,
    fitExplanation: string,
    scoreUpdate: Pick<Job, "scored_cv_id" | "fit_score_calculated_at" | "fit_score_version">,
  ) => {
    setJobs((prevJobs) => {
      const updatedJobs = prevJobs.map((j) => {
        if (j.id === jobId) {
          return {
            ...j,
            fit_score: fitScore,
            fit_explanation: fitExplanation,
            ...scoreUpdate,
          };
        }
        return j;
      });
      const updatedCvId = scoreUpdate.scored_cv_id ?? activeCvId;
      setActiveCvId(updatedCvId ?? null);

      // Save updated to localStorage
      if (storageKey) {
        const state: LastJobSearchState = {
          jobs: updatedJobs,
          query: query.trim(),
          location: location.trim(),
          timestamp: Date.now(),
          active_cv_id: updatedCvId ?? null,
        };
        localStorage.setItem(storageKey, JSON.stringify(state));
      }
      return updatedJobs;
    });
  };

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-6 w-6 rounded-md border border-[var(--cp-border-medium)] bg-[rgba(201,130,74,0.14)] flex items-center justify-center">
            <Briefcase className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="text-xs font-semibold text-[var(--cp-copper-strong)] uppercase tracking-widest">AI-Powered</span>
        </div>
        <h1 className="font-display text-4xl font-semibold tracking-normal text-[var(--cp-text-main)]">Job Hunter</h1>
        <p className="text-[var(--cp-text-muted)] text-sm mt-1">
          Search for jobs and get personalized fit scores based on your CV.
        </p>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="relative">
        <div className="cp-surface flex flex-col sm:flex-row gap-3 p-4 rounded-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--cp-text-subtle)] pointer-events-none" />
            <Input
              placeholder="Job title, skills, or company..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 h-11 rounded-xl"
            />
          </div>
          <div className="relative flex-1 sm:max-w-[200px]">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--cp-text-subtle)] pointer-events-none" />
            <Input
              placeholder="City or Remote"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="pl-9 h-11 rounded-xl"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="h-11 px-6 flex items-center gap-2 rounded-xl border border-[var(--cp-border-strong)] bg-gradient-to-r from-[var(--cp-copper-deep)] via-[var(--cp-copper)] to-[var(--cp-copper-strong)] disabled:opacity-50 text-[var(--cp-bg-deep)] text-sm font-semibold transition-all duration-200 shadow-lg shadow-[var(--cp-glow-copper)] hover:brightness-110 shrink-0"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {loadingMessage}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Search
              </>
            )}
          </button>
        </div>
      </form>

      {/* Errors */}
      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Results */}
      {jobs.length > 0 ? (
        <>
          <div className="cp-surface flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl backdrop-blur-md">
            <div>
              <p className="text-sm font-semibold text-[var(--cp-text-main)]">Best matches</p>
              <p className="text-xs text-[var(--cp-text-muted)] mt-0.5">Sorted by your CV fit score.</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[var(--cp-champagne)] px-2">
              <Sparkles className="h-4 w-4" />
              <span>CV-ranked</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {jobs.map((job, i) => (
              <JobCard key={i} job={job} onScoreUpdated={handleScoreUpdated} />
            ))}
          </div>
        </>
      ) : searched && !loading ? (
        <div className="cp-map-lines flex h-[300px] items-center justify-center rounded-2xl border border-dashed border-[var(--cp-border-medium)] bg-[rgba(255,255,255,0.015)]">
          <div className="flex flex-col items-center text-center max-w-sm gap-3">
            <div className="h-12 w-12 rounded-2xl bg-[rgba(201,130,74,0.12)] border border-[var(--cp-border-medium)] flex items-center justify-center">
              <Search className="h-5 w-5 text-[var(--cp-champagne)]" />
            </div>
            <div>
              <p className="font-semibold text-[var(--cp-text-soft)]">No jobs found</p>
              <p className="text-sm text-[var(--cp-text-muted)] mt-1">Try different keywords or broaden your location.</p>
            </div>
          </div>
        </div>
      ) : !searched ? (
        <div className="cp-map-lines flex h-[320px] items-center justify-center rounded-2xl border border-dashed border-[var(--cp-border-medium)] bg-[rgba(255,255,255,0.015)]">
          <div className="flex flex-col items-center text-center max-w-sm gap-4">
            <div className="h-14 w-14 rounded-2xl bg-[rgba(201,130,74,0.14)] border border-[var(--cp-border-medium)] flex items-center justify-center shadow-lg shadow-[var(--cp-glow-copper)]">
              <Briefcase className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-[var(--cp-text-soft)]">Ready to discover</p>
              <p className="text-sm text-[var(--cp-text-muted)] mt-1">
                Enter a job title and location to find roles and personalize fit scores.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function JobsPage() {
  return (
    <Suspense fallback={<div className="text-sm text-white/40">Loading jobs...</div>}>
      <JobsPageContent />
    </Suspense>
  );
}
