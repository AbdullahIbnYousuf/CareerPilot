"use client";

import { useState, useRef, useEffect } from "react";
import { UploadCloud, Loader2, FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

interface CvUploadProps {
  onUploadSuccess: (data: any) => void;
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

      const data = await response.json();
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
        className={`border border-dashed rounded-2xl p-16 flex flex-col items-center justify-center text-center transition-all duration-300 cursor-pointer bg-[#0E0E12]/80 backdrop-blur-md shadow-xl shadow-black/20 ${
          isDragging
            ? "border-[#7C74DB] bg-[#7C74DB]/5 scale-[1.01]"
            : "border-white/[0.08] hover:border-white/[0.15] hover:shadow-black/30"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        {isUploading ? (
          <>
            <div className="h-14 w-14 rounded-2xl bg-[#0E0E12] flex items-center justify-center border border-white/[0.06] mb-4">
              <Loader2 className="h-6 w-6 text-[#7C74DB] animate-spin" />
            </div>
            <p className="text-sm font-semibold text-white">Parsing {fileName}...</p>
            <p className="text-xs text-white/40 mt-1 max-w-xs leading-relaxed">
              Extracting skills, experience, education, and projects via AI
            </p>
          </>
        ) : (
          <>
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-[#534AB7]/20 to-[#7C74DB]/10 flex items-center justify-center border border-white/[0.04] mb-4 shadow-lg shadow-[#534AB7]/5">
              <UploadCloud className="h-6 w-6 text-[#7C74DB]" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">
              Drag &amp; drop your CV here
            </h3>
            <p className="text-sm text-white/40 mb-5">
              Supports PDF and DOCX — max 5 MB
            </p>
            <Button
              type="button"
              className="bg-[#1E1B3A]/40 border border-white/[0.06] text-white hover:bg-[#1E1B3A]/80 hover:text-white rounded-xl h-10 px-4 transition-colors"
            >
              <FileUp className="mr-2 h-4 w-4 text-[#AFA9EC]" /> Browse Files
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
