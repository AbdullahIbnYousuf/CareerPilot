"use client";

import { useEffect, useState } from "react";
import { JobCard } from "@/components/job-card";
import { supabase } from "@/lib/supabase";
import type { Job } from "@/types";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Briefcase, MapPin, Sparkles } from "lucide-react";

export default function JobsPage() {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const loadUser = async () => {
      const { data, error: authError } = await supabase.auth.getUser();
      if (!authError) setUserId(data.user?.id ?? null);
    };
    loadUser();
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    if (!userId) { setError("Please sign in to search for jobs."); return; }

    setLoading(true);
    setError("");
    setSearched(true);

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
      setJobs(data.jobs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

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

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Results */}
      {jobs.length > 0 ? (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-white/30">
              Found <span className="text-white font-semibold">{jobs.length}</span> matching roles
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {jobs.map((job, i) => <JobCard key={i} job={job} />)}
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
                Enter a job title and location above to find AI-scored opportunities.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
