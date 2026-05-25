"use client";

import { useState } from "react";
import { JobCard, Job } from "@/components/job-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search } from "lucide-react";

export default function JobsPage() {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError("");
    setSearched(true);

    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

      const response = await fetch(`${baseUrl}/jobs/hunt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: "test-user-id",
          query: query.trim(),
          location: location.trim(),
        }),
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Job Hunter</h1>
        <p className="text-muted-foreground mt-2">
          Search for jobs and get personalized fit scores based on your CV.
        </p>
      </div>

      <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Job title, keywords, or company"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1"
        />
        <Input
          placeholder="City, country, or Remote"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="flex-1"
        />
        <Button type="submit" disabled={loading} className="sm:w-auto">
          {loading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Search className="h-4 w-4 mr-2" />
          )}
          Search
        </Button>
      </form>

      {error && (
        <div className="p-4 text-destructive bg-destructive/10 rounded-md text-sm">
          {error}
        </div>
      )}

      {jobs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {jobs.map((job, i) => (
            <JobCard key={i} job={job} />
          ))}
        </div>
      ) : searched && !loading ? (
        <div className="flex h-[300px] items-center justify-center rounded-md border border-dashed">
          <div className="flex flex-col items-center text-center max-w-sm">
            <Search className="h-10 w-10 text-muted-foreground mb-3" />
            <h3 className="font-semibold">No jobs found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Try different keywords or broaden your location.
            </p>
          </div>
        </div>
      ) : !searched ? (
        <div className="flex h-[300px] items-center justify-center rounded-md border border-dashed">
          <div className="flex flex-col items-center text-center max-w-sm">
            <Search className="h-10 w-10 text-muted-foreground mb-3" />
            <h3 className="font-semibold">Start searching</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Enter a job title and location to find matching opportunities.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
