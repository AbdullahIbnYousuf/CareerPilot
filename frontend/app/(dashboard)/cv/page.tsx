"use client";

import { useState } from "react";
import { CvUpload } from "@/components/cv-upload";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  FileText,
  Code2,
  Briefcase,
  GraduationCap,
  FolderKanban,
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

export default function CVPage() {
  const [result, setResult] = useState<CVUploadResult | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">CV Intelligence</h1>
        <p className="text-muted-foreground mt-2">
          Upload your CV to enable AI-powered job matching and chat features.
        </p>
      </div>

      {!result ? (
        <CvUpload onUploadSuccess={(data) => setResult(data)} />
      ) : (
        <div className="space-y-6">
          {/* Success banner */}
          <div className="p-4 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-lg flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-medium">
                {result.file_name} — parsed successfully!
              </p>
              <p className="text-sm opacity-80">
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
                <Card key={key}>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Icon className="h-4 w-4 text-primary" />
                      {label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                      {content || `No ${label.toLowerCase()} extracted.`}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="flex justify-center">
            <Button variant="ghost" onClick={() => setResult(null)}>
              Upload a different CV
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
