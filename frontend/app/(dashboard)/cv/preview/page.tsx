"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, FileUp, Loader2, Pencil, Printer } from "lucide-react";
import { useRouter } from "next/navigation";
import { ResumePreview } from "@/components/resume-preview";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import type { UserProfile } from "@/types";

export default function ResumePreviewPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  useEffect(() => {
    const loadProfile = async () => {
      setIsLoading(true);
      setError("");

      const { data, error: authError } = await supabase.auth.getUser();
      if (authError || !data.user) {
        setProfile(null);
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `${apiBaseUrl}/api/cv/profile?user_id=${encodeURIComponent(data.user.id)}`,
        );

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.detail || "Failed to load profile");
        }

        const body: { profile: UserProfile | null } = await response.json();
        setProfile(body.profile);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load profile");
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [apiBaseUrl]);

  if (isLoading) {
    return (
      <div className="no-print flex h-[360px] items-center justify-center rounded-2xl border border-dashed border-white/[0.06] bg-[#0E0E12]/70">
        <div className="flex flex-col items-center gap-3 text-white/50">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm">Loading resume preview</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="no-print cp-surface rounded-2xl p-6">
        <div className="max-w-2xl space-y-3">
          <h1 className="font-display text-3xl font-semibold tracking-normal text-[var(--cp-text-main)]">No resume preview yet</h1>
          <p className="text-sm leading-6 text-[var(--cp-text-muted)]">
            Upload an existing CV or build your profile manually first. CareerPilot
            will use that saved profile to render your resume preview.
          </p>
          {error && (
            <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </p>
          )}
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button
            type="button"
            onClick={() => router.push("/cv?upload=1")}
            className="h-10 rounded-xl"
          >
            <FileUp className="mr-2 h-4 w-4" />
            Upload CV
          </Button>
          <Button
            type="button"
            onClick={() => router.push("/cv?build=1")}
            className="h-10 rounded-xl"
          >
            <Pencil className="mr-2 h-4 w-4" />
            Build profile manually
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-6 w-6 rounded-md border border-[var(--cp-border-medium)] bg-[rgba(201,130,74,0.14)] flex items-center justify-center">
              <Printer className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="text-xs font-semibold text-[var(--cp-copper-strong)] uppercase tracking-widest">
              Profile
            </span>
          </div>
          <h1 className="font-display text-4xl font-semibold tracking-normal text-[var(--cp-text-main)]">
            Resume Preview
          </h1>
          <p className="text-[var(--cp-text-muted)] text-sm mt-1">
            A clean resume view generated from your latest saved profile.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => router.push("/cv")}
            className="h-10 rounded-xl"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Profile
          </Button>
          <Button
            type="button"
            onClick={() => router.push("/cv?build=1")}
            className="h-10 rounded-xl"
          >
            <Pencil className="mr-2 h-4 w-4" />
            Edit Profile
          </Button>
          <Button
            type="button"
            onClick={() => window.print()}
            className="h-10 rounded-xl"
          >
            <Printer className="mr-2 h-4 w-4" />
            Print / Download PDF
          </Button>
        </div>
      </div>

      {error && (
        <div className="no-print rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <section className="resume-print-root rounded-2xl bg-[#d8d2ca]/10 p-6 shadow-2xl shadow-black/30">
        <ResumePreview profile={profile} />
      </section>
    </div>
  );
}
