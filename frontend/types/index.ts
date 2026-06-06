export interface Job {
  id?: string;
  title: string;
  company: string;
  location: string;
  url: string;
  description: string;
  source: string;
  fit_score?: number | null;
  fit_explanation?: string | null;
  scored_cv_id?: string | null;
  fit_score_calculated_at?: string | null;
  fit_score_version?: string | null;
  salary_range?: string;
  deadline?: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export type ApplicationStatus =
  | "saved"
  | "applied"
  | "interviewing"
  | "offer"
  | "rejected";

export interface Application {
  id: string;
  user_id: string;
  job_id: string;
  status: ApplicationStatus;
  applied_at: string | null;
  // Joined from jobs table
  title?: string;
  company?: string;
  location?: string;
  url?: string;
  fit_score?: number | null;
  deadline?: string | null;
}

export interface Snapshot {
  applications_sent: number;
  streak_days: number;
  roadmap_pct: number;
}

export interface SnapshotHistory {
  week_start: string;
  applications_sent: number;
  streak_days: number;
  roadmap_pct: number;
}

export interface FitScoreDistribution {
  range: string;
  count: number;
}

export interface StatusDistribution {
  status: ApplicationStatus;
  label: string;
  count: number;
}

export interface StatusCounts {
  saved: number;
  applied: number;
  interviewing: number;
  offer: number;
  rejected: number;
}

export interface DashboardAttention {
  high_fit_saved: number;
  overdue_tasks: number;
  active_goals: number;
  completed_goals: number;
  interviews: number;
}

export interface Nudge {
  id: string;
  message: string;
  seen: boolean;
  job_ids?: string[];
}

export interface Goal {
  id: string;
  user_id: string;
  title: string;
  target_date?: string;
  completed: boolean;
}

export interface Todo {
  id: string;
  user_id: string;
  goal_id?: string;
  title: string;
  due_date?: string;
  completed: boolean;
  completed_at?: string | null;
}

export interface ProfileLink {
  label: string;
  url: string;
}

export interface ProfileExperience {
  title: string;
  company: string;
  location: string;
  start_date: string;
  end_date: string;
  description: string;
}

export interface ProfileEducation {
  institution: string;
  degree: string;
  field: string;
  start_year: string;
  end_year: string;
  details: string;
}

export interface ProfileProject {
  title: string;
  description: string;
  technologies: string[];
  url: string;
}

export interface ProfilePayload {
  full_name: string;
  headline: string;
  location: string;
  email: string;
  phone: string;
  links: ProfileLink[];
  summary: string;
  skills: string[];
  experience: ProfileExperience[];
  education: ProfileEducation[];
  projects: ProfileProject[];
  certifications: string[];
}

export interface UserProfile extends ProfilePayload {
  user_id: string;
  active_cv_id?: string | null;
  raw_sections: Record<string, string>;
  generated_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface CVUploadResult {
  cv_id: string;
  file_name: string;
  file_url: string | null;
  parsed_data: {
    skills: string;
    experience: string;
    education: string;
    projects: string;
  };
  profile: UserProfile;
  chunks_stored: number;
  parsed_at: string;
  message: string;
}
