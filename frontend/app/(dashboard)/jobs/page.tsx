"use client";

import { useEffect, useState } from "react";
import { JobCard } from "@/components/job-card";
import { supabase } from "@/lib/supabase";
import type { Job } from "@/types";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Briefcase, MapPin, Sparkles, CheckCircle2 } from "lucide-react";

export default function JobsPage() {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  // Batch scoring state
  const [calculatingAll, setCalculatingAll] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalToScoreCount, setTotalToScoreCount] = useState(0);
  const [allScored, setAllScored] = useState(false);
  const [scoreError, setScoreError] = useState("");

  useEffect(() => {
    const loadUserAndHistory = async () => {
      const { data, error: authError } = await supabase.auth.getUser();
      if (!authError && data.user) {
        const id = data.user.id;
        setUserId(id);

        // Load saved jobs search history from localStorage
        const saved = localStorage.getItem(`careerPilot_lastJobSearch:${id}`);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (parsed.jobs) setJobs(parsed.jobs);
            if (parsed.query) setQuery(parsed.query);
            if (parsed.location) setLocation(parsed.location);
            if (parsed.jobs && parsed.jobs.length > 0) {
              setSearched(true);
            }
          } catch (e) {
            console.error("Failed to load saved jobs search", e);
          }
        }
      }
    };
    loadUserAndHistory();
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    if (!userId) {
      setError("Please sign in to search for jobs.");
      return;
    }

    setLoading(true);
    setError("");
    setSearched(true);
    setAllScored(false);
    setProgress(0);
    setScoreError("");

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${baseUrl}/jobs/hunt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, query: query.trim(), location: location.trim() }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to fetch jobs");
      }

      const data = await response.json();
      const huntedJobs = data.jobs || [];
      setJobs(huntedJobs);

      // Save to localStorage immediately after search
      const state = {
        jobs: huntedJobs,
        query: query.trim(),
        location: location.trim(),
        timestamp: Date.now(),
      };
      localStorage.setItem(`careerPilot_lastJobSearch:${userId}`, JSON.stringify(state));
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleCalculateAllScores = async () => {
    if (!userId) return;
    const unscoredJobs = jobs.filter(
      (job) => job.id && (job.fit_score === undefined || job.fit_score === null || job.fit_score <= 0)
    );
    if (unscoredJobs.length === 0) {
      setAllScored(true);
      return;
    }

    setCalculatingAll(true);
    setScoreError("");
    setAllScored(false);
    setProgress(0);
    setTotalToScoreCount(unscoredJobs.length);

    let currentJobsState = [...jobs];
    let completedCount = 0;
    const chunkSize = 2;
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

    try {
      for (let i = 0; i < unscoredJobs.length; i += chunkSize) {
        const chunk = unscoredJobs.slice(i, i + chunkSize);

        const promises = chunk.map(async (job) => {
          if (!job.id) return;
          const response = await fetch(`${baseUrl}/jobs/score/${job.id}?user_id=${userId}`, {
            method: "POST",
          });
          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.detail || `Failed to score job ${job.title}`);
          }
          const scoreData = await response.json();
          currentJobsState = currentJobsState.map((j) => {
            if (j.id === job.id) {
              return {
                ...j,
                fit_score: scoreData.fit_score,
                fit_explanation: scoreData.fit_explanation,
              };
            }
            return j;
          });
          completedCount += 1;
          setProgress(completedCount);
          setJobs(currentJobsState);
        });

        await Promise.all(promises);

        // Brief delay between batches to respect rate limits
        if (i + chunkSize < unscoredJobs.length) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      // Sort by fit score descending
      const sortedJobs = [...currentJobsState].sort((a, b) => {
        const scoreA = a.fit_score ?? 0;
        const scoreB = b.fit_score ?? 0;
        return scoreB - scoreA;
      });

      setJobs(sortedJobs);
      setAllScored(true);

      // Persist sorted state to localStorage
      const state = {
        jobs: sortedJobs,
        query: query.trim(),
        location: location.trim(),
        timestamp: Date.now(),
      };
      localStorage.setItem(`careerPilot_lastJobSearch:${userId}`, JSON.stringify(state));
    } catch (err) {
      setScoreError(err instanceof Error ? err.message : "An error occurred while calculating fit scores.");
    } finally {
      setCalculatingAll(false);
    }
  };

  const handleScoreUpdated = (jobId: string, fitScore: number, fitExplanation: string) => {
    setJobs((prevJobs) => {
      const updatedJobs = prevJobs.map((j) => {
        if (j.id === jobId) {
          return {
            ...j,
            fit_score: fitScore,
            fit_explanation: fitExplanation,
          };
        }
        return j;
      });

      // Save updated to localStorage
      if (userId) {
        const state = {
          jobs: updatedJobs,
          query: query.trim(),
          location: location.trim(),
          timestamp: Date.now(),
        };
        localStorage.setItem(`careerPilot_lastJobSearch:${userId}`, JSON.stringify(state));
      }
      return updatedJobs;
    });
  };

  const unscoredCount = jobs.filter(
    (job) => job.id && (job.fit_score === undefined || job.fit_score === null || job.fit_score <= 0)
  ).length;

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-6 w-6 rounded-md bg-primary/20 flex items-center justify-center">
            <Briefcase className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="text-xs font-semibold text-primary uppercase tracking-widest">AI-Powered</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Job Hunter</h1>
        <p className="text-white/40 text-sm mt-1">
          Search for jobs and get personalized fit scores based on your CV.
        </p>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="relative">
        <div className="flex flex-col sm:flex-row gap-3 p-4 rounded-2xl border border-white/[0.06] bg-[#0E0E12]">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20 pointer-events-none" />
            <Input
              placeholder="Job title, skills, or company..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 h-11 bg-white/[0.04] border-white/[0.06] text-white placeholder:text-white/20 focus-visible:border-primary/50 focus-visible:ring-primary/20 rounded-xl"
            />
          </div>
          <div className="relative flex-1 sm:max-w-[200px]">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20 pointer-events-none" />
            <Input
              placeholder="City or Remote"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="pl-9 h-11 bg-white/[0.04] border-white/[0.06] text-white placeholder:text-white/20 focus-visible:border-primary/50 focus-visible:ring-primary/20 rounded-xl"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="h-11 px-6 flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#534AB7] to-[#6B63CC] hover:from-[#5E55CC] hover:to-[#7A73DD] disabled:opacity-50 text-white text-sm font-medium transition-all duration-200 shadow-lg shadow-primary/20 shrink-0"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Sparkles className="h-4 w-4" /> Search</>}
          </button>
        </div>
      </form>

      {/* Errors */}
      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}
      {scoreError && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {scoreError}
        </div>
      )}

      {/* Results */}
      {jobs.length > 0 ? (
        <>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border border-white/[0.06] bg-[#0E0E12]/80 backdrop-blur-md">
            <div>
              <p className="text-sm text-white/40">
                Found <span className="text-white font-semibold">{jobs.length}</span> matching roles
              </p>
              {unscoredCount > 0 && (
                <p className="text-xs text-white/25 mt-0.5">
                  {unscoredCount} jobs do not have fit scores calculated.
                </p>
              )}
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {calculatingAll && (
                <div className="flex flex-col sm:items-end gap-1 px-2 shrink-0">
                  <div className="flex items-center gap-2 text-xs text-primary">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Calculating scores: {progress} / {totalToScoreCount}</span>
                  </div>
                  <div className="w-40 h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#534AB7] to-[#6B63CC] transition-all duration-300"
                      style={{ width: `${(progress / totalToScoreCount) * 100}%` }}
                    />
                  </div>
                </div>
              )}
              {allScored && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 px-2">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>All jobs scored & ranked!</span>
                </div>
              )}
              {unscoredCount > 0 && !calculatingAll && (
                <button
                  onClick={handleCalculateAllScores}
                  className="h-9 px-4 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#534AB7]/20 to-[#6B63CC]/20 hover:from-[#534AB7]/30 hover:to-[#6B63CC]/30 border border-primary/30 text-white text-xs font-medium transition-all duration-200"
                >
                  <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse" />
                  Calculate Fit Scores & Rank
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {jobs.map((job, i) => (
              <JobCard key={i} job={job} onScoreUpdated={handleScoreUpdated} />
            ))}
          </div>
        </>
      ) : searched && !loading ? (
        <div className="flex h-[300px] items-center justify-center rounded-2xl border border-dashed border-white/[0.06]">
          <div className="flex flex-col items-center text-center max-w-sm gap-3">
            <div className="h-12 w-12 rounded-2xl bg-white/[0.04] flex items-center justify-center">
              <Search className="h-5 w-5 text-white/20" />
            </div>
            <div>
              <p className="font-semibold text-white/50">No jobs found</p>
              <p className="text-sm text-white/25 mt-1">Try different keywords or broaden your location.</p>
            </div>
          </div>
        </div>
      ) : !searched ? (
        <div className="flex h-[320px] items-center justify-center rounded-2xl border border-dashed border-white/[0.05]">
          <div className="flex flex-col items-center text-center max-w-sm gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-primary/20 to-primary/10 flex items-center justify-center shadow-lg shadow-primary/10">
              <Briefcase className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-white/60">Ready to hunt</p>
              <p className="text-sm text-white/25 mt-1">
                Enter a job title and location above to find jobs and personalize fit scores.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
