"use client";

import { useState, useRef, useEffect } from "react";
import { Compass, Loader2, FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import type { CVUploadResult } from "@/types";

interface CvUploadProps {
  onUploadSuccess: (data: CVUploadResult) => void;
}

export function CvUpload({ onUploadSuccess }: CvUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadUser = async () => {
      const { data, error: authError } = await supabase.auth.getUser();
      if (!authError) {
        setUserId(data.user?.id ?? null);
      }
    };
    loadUser();
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = async (file: File) => {
    const name = file.name.toLowerCase();
    if (!name.endsWith(".pdf") && !name.endsWith(".docx")) {
      setError("Please upload a PDF or DOCX file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("File is too large. Maximum size is 5 MB.");
      return;
    }

    if (!userId) {
      setError("Please sign in to upload your CV.");
      return;
    }

    setError("");
    setFileName(file.name);
    setIsUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const url = `${baseUrl}/api/cv/upload?user_id=${encodeURIComponent(userId)}`;

      const response = await fetch(url, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to upload CV");
      }

      const data: CVUploadResult = await response.json();
      localStorage.removeItem(`careerPilot_lastJobSearch:v2:${userId}`);
      window.dispatchEvent(
        new CustomEvent("careerpilot:cv-updated", {
          detail: { userId, cvId: data.cv_id },
        }),
      );
      onUploadSuccess(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="w-full">
      <div
        className={`cp-map-lines border border-dashed rounded-2xl p-16 flex flex-col items-center justify-center text-center transition-all duration-300 cursor-pointer bg-[var(--cp-surface-glass)] backdrop-blur-md shadow-xl shadow-black/20 ${
          isDragging
            ? "border-[var(--cp-border-strong)] bg-[rgba(201,130,74,0.10)] scale-[1.01]"
            : "border-[var(--cp-border-medium)] hover:border-[var(--cp-border-strong)] hover:shadow-black/30"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        {isUploading ? (
          <>
            <div className="h-14 w-14 rounded-2xl bg-[var(--cp-bg-deep)] flex items-center justify-center border border-[var(--cp-border-soft)] mb-4">
              <Loader2 className="h-6 w-6 text-[var(--cp-copper-strong)] animate-spin" />
            </div>
            <p className="text-sm font-semibold text-[var(--cp-text-main)]">Parsing {fileName}...</p>
            <p className="text-xs text-[var(--cp-text-muted)] mt-1 max-w-xs leading-relaxed">
              Extracting skills, experience, education, and projects via AI
            </p>
          </>
        ) : (
          <>
            <div className="h-14 w-14 rounded-2xl bg-[rgba(201,130,74,0.14)] flex items-center justify-center border border-[var(--cp-border-medium)] mb-4 shadow-lg shadow-[var(--cp-glow-copper)]">
              <Compass className="h-5 w-5 text-[var(--cp-champagne)]" />
            </div>
            <h3 className="font-display text-3xl font-semibold tracking-normal text-[var(--cp-text-main)] mb-2">
              Turn your CV into a career engine.
            </h3>
            <p className="max-w-xl text-sm leading-6 text-[var(--cp-text-muted)] mb-2">
              Upload your resume and CareerPilot will build your profile, match jobs, and personalize guidance.
            </p>
            <p className="text-xs text-[var(--cp-text-subtle)] mb-5">
              Supports PDF and DOCX - max 5 MB.
            </p>
            <Button
              type="button"
              className="rounded-xl h-10 px-4"
            >
              <FileUp className="mr-2 h-4 w-4" /> Browse Files
            </Button>
          </>
        )}

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileInput}
          accept=".pdf,.docx"
          className="hidden"
        />
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
