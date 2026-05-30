export interface Job {
  id?: string;
  title: string;
  company: string;
  location: string;
  url: string;
  description: string;
  source: string;
  fit_score?: number;
  fit_explanation?: string;
  salary_range?: string;
  deadline?: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
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
  applied_at: string;
  // Joined from jobs table
  title?: string;
  company?: string;
  location?: string;
  url?: string;
  fit_score?: number;
}

export interface Snapshot {
  applications_sent: number;
  streak_days: number;
  roadmap_pct: number;
}

export interface StatusCounts {
  saved: number;
  applied: number;
  interviewing: number;
  offer: number;
  rejected: number;
}

export interface Nudge {
  id: string;
  message: string;
  seen: boolean;
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
}
