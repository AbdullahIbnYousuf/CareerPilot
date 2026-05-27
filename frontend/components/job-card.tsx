"use client";

import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { FitScoreBadge } from "./fit-score-badge";
import {
  MapPin,
  Building2,
  ExternalLink,
  Calendar,
  DollarSign,
  X,
  Briefcase,
  ChevronRight,
} from "lucide-react";
import type { Job } from "@/types";

export function JobCard({ job }: { job: Job }) {
  const [showModal, setShowModal] = useState(false);

  const salary = job.salary_range || "Not Disclosed";
  const deadline = job.deadline || "Rolling / Open";

  return (
    <>
      {/* ── Card ── */}
      <div className="group relative flex flex-col rounded-2xl border border-white/[0.06] bg-[#0E0E12] overflow-hidden transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
        {/* Hover glow strip */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Header */}
        <div className="p-5 pb-4">
          <div className="flex justify-between items-start gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-white leading-snug line-clamp-2 group-hover:text-primary transition-colors duration-200">
                {job.title}
              </h3>
              <div className="flex flex-col gap-1 mt-2">
                <span className="flex items-center gap-1.5 text-sm">
                  <Building2 className="h-3.5 w-3.5 shrink-0 text-white/30" />
                  <span className="truncate font-medium text-white/70">{job.company || "Unknown"}</span>
                </span>
                <span className="flex items-center gap-1.5 text-xs text-white/30">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{job.location || "N/A"}</span>
                </span>
              </div>
            </div>
            {job.fit_score !== undefined && job.fit_score > 0 && (
              <div className="shrink-0">
                <FitScoreBadge score={job.fit_score} explanation={job.fit_explanation} />
              </div>
            )}
          </div>
        </div>

        {/* Meta row */}
        <div className="mx-5 mb-4 flex items-center gap-3 rounded-xl bg-white/[0.03] border border-white/[0.04] px-3 py-2 text-xs text-white/30">
          <span className="flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5 text-primary/60" />
            {salary}
          </span>
          <span className="h-3 w-px bg-white/10" />
          <span className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-primary/60" />
            {deadline}
          </span>
        </div>

        {/* Description */}
        <div className="px-5 flex-1">
          <p className="text-sm text-white/40 line-clamp-3 leading-relaxed">{job.description}</p>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-4 mt-3 border-t border-white/[0.04] flex items-center gap-2">
          <span className="text-[10px] text-white/20 bg-white/[0.04] px-2 py-0.5 rounded-md font-mono uppercase tracking-wider">
            {job.source}
          </span>
          <div className="flex gap-2 ml-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowModal(true)}
              className="text-xs text-white/40 hover:text-white hover:bg-white/[0.06] rounded-lg gap-1"
            >
              Details <ChevronRight className="h-3 w-3" />
            </Button>
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary/90 hover:bg-primary text-white text-xs font-medium px-3 py-1.5 transition-colors duration-150"
            >
              Apply <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>

      {/* ── Detail Modal ── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
        >
          <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border border-white/[0.08] bg-[#0E0E12] shadow-2xl shadow-black/60 overflow-hidden">
            {/* Modal header */}
            <div className="flex justify-between items-start p-6 border-b border-white/[0.06] bg-white/[0.02]">
              <div className="flex-1 min-w-0 pr-4">
                <span className="text-[10px] text-white/20 bg-white/[0.05] px-2 py-0.5 rounded font-mono uppercase tracking-wider">
                  {job.source}
                </span>
                <h2 className="text-xl font-bold text-white mt-2 leading-snug">{job.title}</h2>
                <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-white/40">
                  <span className="flex items-center gap-1.5 text-white/70 font-medium">
                    <Building2 className="h-4 w-4 text-white/30" /> {job.company}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" /> {job.location}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="h-8 w-8 flex items-center justify-center rounded-lg border border-white/[0.08] text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Fit score */}
              {job.fit_score !== undefined && job.fit_score > 0 && (
                <div className="flex flex-col md:flex-row gap-4 items-center md:items-start rounded-xl bg-primary/5 border border-primary/15 p-4">
                  <div className="shrink-0"><FitScoreBadge score={job.fit_score} /></div>
                  <div className="space-y-1 text-center md:text-left">
                    <p className="text-xs font-semibold text-primary uppercase tracking-wider">Fit Match</p>
                    <p className="text-sm text-white/60 italic leading-relaxed">&ldquo;{job.fit_explanation}&rdquo;</p>
                  </div>
                </div>
              )}

              {/* Quick info */}
              <div className="grid grid-cols-2 gap-4 rounded-xl bg-white/[0.03] border border-white/[0.05] p-4 text-xs">
                <div className="space-y-1">
                  <span className="text-white/30 block">Salary Range</span>
                  <span className="text-white font-semibold flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5 text-primary" /> {salary}
                  </span>
                </div>
                <div className="space-y-1 pl-4 border-l border-white/[0.05]">
                  <span className="text-white/30 block">Deadline</span>
                  <span className="text-white font-semibold flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-primary" /> {deadline}
                  </span>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <h3 className="text-[11px] font-bold text-white/30 uppercase tracking-wider flex items-center gap-1.5">
                  <Briefcase className="h-3.5 w-3.5" /> Job Description
                </h3>
                <div className="rounded-xl bg-white/[0.02] border border-white/[0.05] p-4 text-sm text-white/50 leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
                  {job.description}
                </div>
              </div>
            </div>

            {/* Modal footer */}
            <div className="p-4 border-t border-white/[0.06] flex justify-end gap-2 bg-white/[0.02]">
              <Button variant="ghost" size="sm" onClick={() => setShowModal(false)} className="text-white/40 hover:text-white">
                Close
              </Button>
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-sm font-medium px-4 py-2 transition-colors duration-150"
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
