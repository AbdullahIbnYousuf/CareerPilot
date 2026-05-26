"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { FitScoreBadge } from "./fit-score-badge";
import { MapPin, Building, ExternalLink, Calendar, DollarSign, X, Briefcase } from "lucide-react";
import type { Job } from "@/types";

export function JobCard({ job }: { job: Job }) {
  const [showModal, setShowModal] = useState(false);

  // Fallbacks for optional fields
  const salary = job.salary_range || "Not Disclosed";
  const deadline = job.deadline || "Rolling / Open";

  return (
    <>
      <Card className="flex flex-col h-full hover:border-primary/50 transition-all duration-300 hover:shadow-md relative overflow-hidden group">
        {/* Glow effect on hover */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

        <CardHeader className="pb-3 relative">
          <div className="flex justify-between items-start gap-3">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg leading-tight line-clamp-2 font-bold group-hover:text-primary transition-colors duration-200">
                {job.title}
              </CardTitle>
              <CardDescription className="flex flex-col gap-1 mt-2">
                <span className="flex items-center gap-1.5 text-sm">
                  <Building className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate font-medium text-foreground">{job.company || "Unknown"}</span>
                </span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{job.location || "N/A"}</span>
                </span>
              </CardDescription>
            </div>
            {job.fit_score !== undefined && job.fit_score > 0 && (
              <div className="shrink-0">
                <FitScoreBadge score={job.fit_score} explanation={job.fit_explanation} />
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="flex-1 pt-0 pb-4 relative">
          {/* Salary and Deadline Row */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3 bg-muted/30 p-2 rounded-md">
            <span className="flex items-center gap-1">
              <DollarSign className="h-3.5 w-3.5 shrink-0 text-primary/70" />
              <span>{salary}</span>
            </span>
            <span className="flex items-center gap-1 border-l pl-4">
              <Calendar className="h-3.5 w-3.5 shrink-0 text-primary/70" />
              <span>{deadline}</span>
            </span>
          </div>

          <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
            {job.description}
          </p>
        </CardContent>

        <CardFooter className="flex gap-2 items-center border-t pt-4 mt-auto">
          <span className="text-[10px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded font-mono uppercase tracking-wider">
            {job.source}
          </span>
          <div className="flex gap-2 ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowModal(true)}
              className="text-xs transition-transform duration-200 active:scale-95"
            >
              View Details
            </Button>
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "default", size: "sm" }) + " text-xs flex items-center gap-1 transition-transform duration-200 active:scale-95"}
            >
              Apply <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </CardFooter>
      </Card>

      {/* Premium Detail Modal Overlay */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-background border border-border/80 shadow-2xl rounded-xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 relative">
            
            {/* Modal Header */}
            <div className="flex justify-between items-start p-5 border-b bg-muted/10">
              <div className="flex-1 min-w-0 pr-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded font-mono uppercase">
                    {job.source}
                  </span>
                </div>
                <h2 className="text-xl font-bold leading-snug text-foreground">
                  {job.title}
                </h2>
                <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5 text-foreground font-medium">
                    <Building className="h-4 w-4 shrink-0 text-muted-foreground" />
                    {job.company}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 shrink-0" />
                    {job.location}
                  </span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowModal(false)}
                className="h-8 w-8 rounded-full border border-border/40 hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Modal Content (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Fit Score Spotlight */}
              {job.fit_score !== undefined && job.fit_score > 0 && (
                <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 flex flex-col md:flex-row gap-4 items-center md:items-start">
                  <div className="shrink-0 flex items-center justify-center">
                    <FitScoreBadge score={job.fit_score} />
                  </div>
                  <div className="space-y-1.5 text-center md:text-left">
                    <h3 className="font-semibold text-sm text-primary">Personalized Fit Match Explanation</h3>
                    <p className="text-xs font-medium leading-relaxed text-foreground italic">
                      &ldquo;{job.fit_explanation}&rdquo;
                    </p>
                  </div>
                </div>
              )}

              {/* Quick Info Grid */}
              <div className="grid grid-cols-2 gap-4 bg-muted/20 p-3.5 rounded-lg border border-border/40 text-xs">
                <div className="space-y-1">
                  <span className="text-muted-foreground block font-medium">Salary Range</span>
                  <span className="text-foreground font-bold flex items-center gap-1.5">
                    <DollarSign className="h-4.5 w-4.5 text-primary" />
                    {salary}
                  </span>
                </div>
                <div className="space-y-1 pl-4 border-l">
                  <span className="text-muted-foreground block font-medium">Application Deadline</span>
                  <span className="text-foreground font-bold flex items-center gap-1.5">
                    <Calendar className="h-4.5 w-4.5 text-primary" />
                    {deadline}
                  </span>
                </div>
              </div>

              {/* Job Description section */}
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                  <Briefcase className="h-4 w-4 text-primary" /> Job Description
                </h3>
                <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto pr-2 bg-muted/10 p-4 rounded-md border">
                  {job.description}
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t flex justify-end gap-2.5 bg-muted/10">
              <Button variant="outline" size="sm" onClick={() => setShowModal(false)}>
                Close
              </Button>
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: "default", size: "sm" }) + " flex items-center gap-1.5"}
              >
                Apply Now <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
