"use client";

import type {
  ProfileEducation,
  ProfileExperience,
  ProfileProject,
  UserProfile,
} from "@/types";
import type { ReactNode } from "react";

interface ResumePreviewProps {
  profile: UserProfile;
  printMode?: boolean;
}

type SkillGroup = {
  label: string;
  items: string[];
};

const styles = {
  page:
    "resume-page mx-auto w-full max-w-[840px] bg-white px-8 py-9 font-sans text-slate-900 shadow-2xl shadow-black/30 md:px-12 md:py-11 print:shadow-none",
  header: "resume-block border-b border-slate-300 pb-4",
  name: "text-[30px] font-bold leading-tight text-slate-950",
  headline: "mt-1 text-[12px] font-semibold uppercase text-slate-600",
  contact: "mt-3 flex flex-wrap gap-x-2 gap-y-1 text-[10px] leading-snug text-slate-600",
  section: "resume-block mt-4",
  sectionTitle:
    "border-b border-slate-300 pb-1 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-700",
  sectionBody: "mt-2 text-[10px] leading-[1.45] text-slate-700",
  item: "resume-block mt-3 first:mt-0",
  itemHeader: "grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1",
  itemTitle: "break-words text-[11px] font-bold leading-snug text-slate-950",
  itemMeta: "break-words text-[10px] leading-snug text-slate-600",
  itemDate: "text-right text-[9.5px] leading-snug text-slate-600 sm:whitespace-nowrap",
  bullets: "mt-1 list-disc space-y-1 pl-4 text-[10px] leading-[1.4] text-slate-700",
  compactText: "text-[10px] leading-[1.45] text-slate-700",
};

const cleanString = (value?: string | null) =>
  typeof value === "string" ? value.trim() : "";

const hasItems = <T,>(items?: T[] | null): items is T[] =>
  Array.isArray(items) && items.length > 0;

const joinNonEmpty = (
  items: Array<string | null | undefined>,
  separator = " | ",
) => items.map(cleanString).filter(Boolean).join(separator);

const formatDateRange = (startDate?: string, endDate?: string) =>
  joinNonEmpty([startDate, endDate], " - ");

const splitList = (value: string) =>
  value
    .split(/[,;\n]/)
    .map(cleanString)
    .filter(Boolean);

const bulletize = (value?: string | null, limit = 5) => {
  const text = cleanString(value);
  if (!text) return [];

  const explicitLines = text
    .split(/\r?\n/)
    .map((line) => cleanString(line.replace(/^[-*\u2022]\s*/, "")))
    .filter(Boolean);

  const source =
    explicitLines.length > 1
      ? explicitLines
      : text
          .split(/(?<=[.!?])\s+/)
          .map((line) => cleanString(line.replace(/^[-*\u2022]\s*/, "")))
          .filter(Boolean);

  return source.slice(0, limit);
};

const formatLink = (label?: string, url?: string) => {
  const cleanLabel = cleanString(label);
  const cleanUrl = cleanString(url);

  if (!cleanLabel && !cleanUrl) return "";
  if (!cleanLabel) return cleanUrl;
  if (!cleanUrl) return cleanLabel;
  if (cleanLabel === cleanUrl) return cleanUrl;
  if (cleanUrl.toLowerCase().includes(cleanLabel.toLowerCase())) return cleanUrl;
  return `${cleanLabel}: ${cleanUrl}`;
};

const groupSkills = (skills: string[]): SkillGroup[] => {
  const cleaned = skills.map(cleanString).filter(Boolean);
  if (!cleaned.length) return [];

  const groups: SkillGroup[] = [];
  const fallback: string[] = [];

  cleaned.forEach((skill) => {
    const [maybeLabel, ...rest] = skill.split(":");
    if (rest.length > 0 && cleanString(maybeLabel)) {
      const items = splitList(rest.join(":"));
      if (items.length) {
        groups.push({ label: cleanString(maybeLabel), items });
        return;
      }
    }
    fallback.push(skill);
  });

  if (fallback.length) {
    groups.unshift({ label: "Skills", items: fallback });
  }

  return groups;
};

export function ResumePreview({
  profile,
  printMode = false,
}: ResumePreviewProps) {
  const hasExperience = hasItems(profile.experience);
  const hasProjects = hasItems(profile.projects);
  const hasEducation = hasItems(profile.education);
  const hasCertifications = profile.certifications.some((item) => cleanString(item));
  const hasSkills = profile.skills.some((item) => cleanString(item));

  return (
    <article className={[styles.page, printMode ? "shadow-none" : ""].join(" ")}>
      <ResumeHeader profile={profile} />

      {cleanString(profile.summary) && (
        <ResumeSection title="Summary">
          <p className={styles.compactText}>{cleanString(profile.summary)}</p>
        </ResumeSection>
      )}

      {hasSkills && <SkillsSection skills={profile.skills} />}

      {hasExperience && <ExperienceSection items={profile.experience} />}

      {hasProjects && <ProjectsSection items={profile.projects} />}

      {hasEducation && <EducationSection items={profile.education} />}

      {hasCertifications && (
        <CertificationsSection items={profile.certifications} />
      )}
    </article>
  );
}

function ResumeHeader({ profile }: { profile: UserProfile }) {
  const contactItems = [
    cleanString(profile.location),
    cleanString(profile.email),
    cleanString(profile.phone),
    ...profile.links
      .map((link) => formatLink(link.label, link.url))
      .filter(Boolean),
  ].filter(Boolean);

  return (
    <header className={styles.header}>
      <h2 className={styles.name}>{cleanString(profile.full_name) || "Your Name"}</h2>
      {cleanString(profile.headline) && (
        <p className={styles.headline}>{cleanString(profile.headline)}</p>
      )}
      {contactItems.length > 0 && (
        <p className={styles.contact}>
          {contactItems.map((item, index) => (
            <span key={`${item}-${index}`}>
              {index > 0 && <span className="px-1 text-slate-400">|</span>}
              {item}
            </span>
          ))}
        </p>
      )}
    </header>
  );
}

function SkillsSection({ skills }: { skills: string[] }) {
  const groups = groupSkills(skills);
  if (!groups.length) return null;

  return (
    <ResumeSection title="Skills">
      <div className="space-y-1">
        {groups.map((group) => (
          <p key={group.label} className={styles.compactText}>
            <span className="font-semibold text-slate-900">{group.label}: </span>
            {group.items.join(", ")}
          </p>
        ))}
      </div>
    </ResumeSection>
  );
}

function ExperienceSection({ items }: { items: ProfileExperience[] }) {
  const visibleItems = items.filter((item) =>
    [
      item.title,
      item.company,
      item.location,
      item.start_date,
      item.end_date,
      item.description,
    ].some(cleanString),
  );
  if (!visibleItems.length) return null;

  return (
    <ResumeSection title="Experience">
      {visibleItems.map((item, index) => {
        const title = joinNonEmpty([item.title, item.company], ", ") || "Experience";
        const meta = cleanString(item.location);
        const dates = formatDateRange(item.start_date, item.end_date);
        const bullets = bulletize(item.description);

        return (
          <ResumeItem key={`${title}-${index}`} title={title} meta={meta} dates={dates}>
            {bullets.length > 0 && <BulletList items={bullets} />}
          </ResumeItem>
        );
      })}
    </ResumeSection>
  );
}

function ProjectsSection({ items }: { items: ProfileProject[] }) {
  const visibleItems = items.filter((item) =>
    [item.title, item.description, item.url, ...item.technologies].some(cleanString),
  );
  if (!visibleItems.length) return null;

  return (
    <ResumeSection title="Projects">
      {visibleItems.map((item, index) => {
        const title = cleanString(item.title) || "Project";
        const technologies = item.technologies.map(cleanString).filter(Boolean);
        const meta = joinNonEmpty([
          technologies.length ? `Tech: ${technologies.join(", ")}` : "",
          item.url,
        ]);
        const bullets = bulletize(item.description, 4);

        return (
          <ResumeItem key={`${title}-${index}`} title={title} meta={meta}>
            {bullets.length > 0 && <BulletList items={bullets} />}
          </ResumeItem>
        );
      })}
    </ResumeSection>
  );
}

function EducationSection({ items }: { items: ProfileEducation[] }) {
  const visibleItems = items.filter((item) =>
    [
      item.institution,
      item.degree,
      item.field,
      item.start_year,
      item.end_year,
      item.details,
    ].some(cleanString),
  );
  if (!visibleItems.length) return null;

  return (
    <ResumeSection title="Education">
      {visibleItems.map((item, index) => {
        const title = cleanString(item.institution) || "Education";
        const degree = joinNonEmpty([item.degree, item.field], ", ");
        const dates = formatDateRange(item.start_year, item.end_year);
        const details = bulletize(item.details, 3);

        return (
          <ResumeItem key={`${title}-${index}`} title={title} meta={degree} dates={dates}>
            {details.length > 0 && <BulletList items={details} />}
          </ResumeItem>
        );
      })}
    </ResumeSection>
  );
}

function CertificationsSection({ items }: { items: string[] }) {
  const cleaned = items.map(cleanString).filter(Boolean);
  if (!cleaned.length) return null;

  return (
    <ResumeSection title="Certifications">
      <p className={styles.compactText}>{cleaned.join(", ")}</p>
    </ResumeSection>
  );
}

function ResumeItem({
  title,
  meta,
  dates,
  children,
}: {
  title: string;
  meta?: string;
  dates?: string;
  children?: ReactNode;
}) {
  return (
    <div className={styles.item}>
      <div className={styles.itemHeader}>
        <div>
          <h4 className={styles.itemTitle}>{title}</h4>
          {cleanString(meta) && <p className={styles.itemMeta}>{meta}</p>}
        </div>
        {cleanString(dates) && <p className={styles.itemDate}>{dates}</p>}
      </div>
      {children}
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  const cleaned = items.map(cleanString).filter(Boolean);
  if (!cleaned.length) return null;

  return (
    <ul className={styles.bullets}>
      {cleaned.map((item, index) => (
        <li key={`${item}-${index}`}>{item}</li>
      ))}
    </ul>
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
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}
