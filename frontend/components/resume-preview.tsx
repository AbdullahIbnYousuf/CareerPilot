"use client";

import type { UserProfile } from "@/types";
import type { ReactNode } from "react";

interface ResumePreviewProps {
  profile: UserProfile;
  printMode?: boolean;
}

const hasText = (value: string | null | undefined) => Boolean(value?.trim());

const dateRange = (start?: string, end?: string) =>
  [start, end].filter((value) => value && value.trim()).join(" - ");

export function ResumePreview({ profile, printMode = false }: ResumePreviewProps) {
  const contact = [profile.location, profile.email, profile.phone].filter(hasText);
  const hasLinks = profile.links.some((link) => hasText(link.url) || hasText(link.label));
  const hasExperience = profile.experience.length > 0;
  const hasProjects = profile.projects.length > 0;
  const hasEducation = profile.education.length > 0;

  return (
    <article
      className={[
        "mx-auto w-full max-w-[840px] bg-white px-8 py-9 text-slate-950 shadow-2xl shadow-black/30 md:px-12 md:py-11",
        printMode ? "shadow-none" : "",
      ].join(" ")}
    >
      <header className="border-b border-slate-300 pb-4">
        <h2 className="text-3xl font-bold leading-tight text-slate-950">
          {profile.full_name || "Your Name"}
        </h2>
        {hasText(profile.headline) && (
          <p className="mt-1 text-base font-medium text-slate-700">{profile.headline}</p>
        )}
        {(contact.length > 0 || hasLinks) && (
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-600">
            {contact.map((item) => (
              <span key={item}>{item}</span>
            ))}
            {profile.links
              .filter((link) => hasText(link.url) || hasText(link.label))
              .map((link, index) => (
                <span key={`${link.url}-${index}`}>
                  {link.label || link.url}
                  {link.label && link.url ? `: ${link.url}` : ""}
                </span>
              ))}
          </div>
        )}
      </header>

      <div className="mt-6 space-y-5">
        {hasText(profile.summary) && (
          <ResumeSection title="Summary">
            <p>{profile.summary}</p>
          </ResumeSection>
        )}

        {profile.skills.length > 0 && (
          <ResumeSection title="Skills">
            <p>{profile.skills.join(", ")}</p>
          </ResumeSection>
        )}

        {hasExperience && (
          <ResumeSection title="Experience">
            <div className="space-y-4">
              {profile.experience.map((item, index) => (
                <div key={`${item.company}-${item.title}-${index}`} className="break-inside-avoid">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h4 className="font-semibold text-slate-950">
                        {[item.title, item.company].filter(hasText).join(", ") || "Experience"}
                      </h4>
                      {hasText(item.location) && (
                        <p className="text-sm text-slate-600">{item.location}</p>
                      )}
                    </div>
                    {dateRange(item.start_date, item.end_date) && (
                      <p className="text-sm font-medium text-slate-600">
                        {dateRange(item.start_date, item.end_date)}
                      </p>
                    )}
                  </div>
                  {hasText(item.description) && (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {item.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </ResumeSection>
        )}

        {hasProjects && (
          <ResumeSection title="Projects">
            <div className="space-y-4">
              {profile.projects.map((item, index) => (
                <div key={`${item.title}-${index}`} className="break-inside-avoid">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <h4 className="font-semibold text-slate-950">{item.title || "Project"}</h4>
                    {hasText(item.url) && (
                      <p className="text-sm font-medium text-slate-600">{item.url}</p>
                    )}
                  </div>
                  {item.technologies.length > 0 && (
                    <p className="mt-1 text-sm font-medium text-slate-600">
                      {item.technologies.join(", ")}
                    </p>
                  )}
                  {hasText(item.description) && (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {item.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </ResumeSection>
        )}

        {hasEducation && (
          <ResumeSection title="Education">
            <div className="space-y-3">
              {profile.education.map((item, index) => (
                <div key={`${item.institution}-${index}`} className="break-inside-avoid">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h4 className="font-semibold text-slate-950">
                        {item.institution || "Education"}
                      </h4>
                      <p className="text-sm text-slate-700">
                        {[item.degree, item.field].filter(hasText).join(", ")}
                      </p>
                    </div>
                    {dateRange(item.start_year, item.end_year) && (
                      <p className="text-sm font-medium text-slate-600">
                        {dateRange(item.start_year, item.end_year)}
                      </p>
                    )}
                  </div>
                  {hasText(item.details) && (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {item.details}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </ResumeSection>
        )}

        {profile.certifications.length > 0 && (
          <ResumeSection title="Certifications">
            <p>{profile.certifications.join(", ")}</p>
          </ResumeSection>
        )}
      </div>
    </article>
  );
}

function ResumeSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="break-inside-avoid">
      <h3 className="mb-2 border-b border-slate-200 pb-1 text-xs font-bold uppercase text-slate-700">
        {title}
      </h3>
      <div className="text-sm leading-6 text-slate-700">{children}</div>
    </section>
  );
}
