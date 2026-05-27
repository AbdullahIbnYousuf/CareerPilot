"use client";

import { useState } from "react";
import { CvUpload } from "@/components/cv-upload";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Code2,
  Briefcase,
  GraduationCap,
  FolderKanban,
  User2,
} from "lucide-react";

interface CVUploadResult {
  cv_id: string;
  file_name: string;
  file_url: string | null;
  parsed_data: {
    skills: string;
    experience: string;
    education: string;
    projects: string;
  };
  chunks_stored: number;
  parsed_at: string;
  message: string;
}

const sectionConfig = [
  { key: "skills", label: "Skills", icon: Code2 },
  { key: "experience", label: "Experience", icon: Briefcase },
  { key: "education", label: "Education", icon: GraduationCap },
  { key: "projects", label: "Projects", icon: FolderKanban },
] as const;

export default function ProfilePage() {
  const [result, setResult] = useState<CVUploadResult | null>(null);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-6 w-6 rounded-md bg-primary/20 flex items-center justify-center">
            <User2 className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="text-xs font-semibold text-primary uppercase tracking-widest">Workspace</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Profile</h1>
        <p className="text-white/40 text-sm mt-1">
          Upload your CV to enable AI-powered job matching and chat features.
        </p>
      </div>

      {!result ? (
        <CvUpload onUploadSuccess={(data) => setResult(data)} />
      ) : (
        <div className="space-y-6">
          {/* Success banner */}
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
            <div>
              <p className="font-semibold text-white">
                {result.file_name} — parsed successfully!
              </p>
              <p className="text-sm text-white/50">
                {result.chunks_stored} chunks embedded and stored for semantic
                search.
              </p>
            </div>
          </div>

          {/* Parsed sections */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {sectionConfig.map(({ key, label, icon: Icon }) => {
              const content = result.parsed_data[key];
              return (
                <Card key={key} className="bg-[#0E0E12] border border-white/[0.06] rounded-2xl shadow-xl shadow-black/30">
                  <CardHeader className="pb-3 border-b border-white/[0.04] mb-3">
                    <CardTitle className="flex items-center gap-2 text-base font-bold text-white">
                      <Icon className="h-4 w-4 text-[#7C74DB]" />
                      {label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-white/70 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                      {content || `No ${label.toLowerCase()} extracted.`}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="flex justify-center pt-2">
            <Button
              className="bg-[#1E1B3A]/40 border border-white/[0.06] text-white hover:bg-[#1E1B3A]/80 hover:text-white rounded-xl h-10 px-6 transition-colors"
              onClick={() => setResult(null)}
            >
              Upload a different CV
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
