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
  notes?: string | null;
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

export interface SkillGrowth {
  skills_added_this_week: number;
  recent_skills_added: string[];
  profile_skills_count: number;
}

export interface Nudge {
  id: string;
  message: string;
  seen: boolean;
  job_ids?: string[];
  jobs?: {
    id: string;
    title: string;
    company: string;
    fit_score?: number | null;
    url?: string;
  }[];
}

export interface Goal {
  id: string;
  user_id: string;
  title: string;
  target_date?: string;
  completed: boolean;
  target_skill?: string | null;
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

export interface ProfileSaveResult {
  profile: UserProfile;
  cv_id: string;
  chunks_stored: number;
  message: string;
}

export type CopilotProfileStatus = "unknown" | "no_profile" | "has_profile";

export interface CopilotOnboardingState {
  completed: boolean;
  name: string;
  targetRoles: string[];
  location: string;
  workMode: string;
  careerStage: string;
  lastStep: "name" | "target_role" | "location_work_mode" | "career_stage" | "cv_status" | "complete";
  updatedAt: string;
}

export interface CopilotContextOnboarding {
  name?: string;
  targetRoles?: string[];
  location?: string;
  workMode?: string;
  careerStage?: string;
  completed?: boolean;
}

export type CopilotAppState = Record<string, unknown>;

export interface CopilotClientContext {
  current_path: string;
  current_page_label: string;
  profile_status: CopilotProfileStatus;
  onboarding: CopilotContextOnboarding;
  preferences?: CareerPreferences;
  copilot_state?: CopilotGuideState;
  app_state?: CopilotAppState;
  app_map: string;
}

export interface CareerPreferences {
  user_id: string;
  preferred_name?: string | null;
  target_roles: string[];
  preferred_locations: string[];
  work_modes: string[];
  seniority?: string | null;
  weekly_capacity_hours?: number | null;
  target_start_date?: string | null;
  industries: string[];
  updated_at?: string | null;
}

export type CopilotGuideStep =
  | "welcome"
  | "preferences"
  | "profile_setup"
  | "job_search"
  | "job_review"
  | "applications"
  | "goals_tasks"
  | "calendar"
  | "progress"
  | "today";

export type CopilotGuidanceLevel = "first_run" | "guided" | "light" | "minimal";

export interface CopilotGuideState {
  onboarding: CopilotContextOnboarding;
  completed_steps: CopilotGuideStep[];
  remaining_steps: CopilotGuideStep[];
  feature_exposures: Record<string, { count?: number; last_seen_at?: string }>;
  guidance_level: CopilotGuidanceLevel;
  next_step?: CopilotGuideStep | null;
  next_step_prompt?: string | null;
  guide_steps?: CopilotGuideStep[];
}

export interface CopilotOpenRouteAction {
  type: "open_route";
  label: string;
  href: string;
}

export interface CopilotPrefillJobSearchAction {
  type: "prefill_job_search";
  label: string;
  query: string;
  location?: string;
  auto?: boolean;
}

export interface CopilotGoalDraft {
  title: string;
  target_date?: string | null;
}

export interface CopilotTodoDraft {
  title: string;
  due_date?: string | null;
}

export interface CopilotRoadmapGoalDraft extends CopilotGoalDraft {
  todos: CopilotTodoDraft[];
}

export interface CopilotCreateGoalWithTodosAction {
  type: "create_goal_with_todos";
  label: string;
  goal: CopilotGoalDraft;
  todos: CopilotTodoDraft[];
}

export interface CopilotCreateRoadmapAction {
  type: "create_roadmap_with_tasks";
  label: string;
  goals: CopilotRoadmapGoalDraft[];
}

export interface CopilotCreateTodoAction {
  type: "create_todo";
  label: string;
  todo: CopilotTodoDraft;
}

export interface CopilotPrefillGoalWithTodosAction {
  type: "prefill_goal_with_todos";
  label: string;
  goal: CopilotGoalDraft;
  todos: CopilotTodoDraft[];
}

export interface CopilotPrefillTodoAction {
  type: "prefill_todo";
  label: string;
  todo: CopilotTodoDraft;
}

export interface CopilotSaveApplicationAction {
  type: "save_application";
  label: string;
  job_id: string;
  status?: ApplicationStatus;
}

export interface CopilotUpdateApplicationStatusAction {
  type: "update_application_status";
  label: string;
  application_id: string;
  status: ApplicationStatus;
}

export interface CopilotSaveApplicationNoteAction {
  type: "save_application_note";
  label: string;
  application_id: string;
  note: string;
}

export interface CopilotPrefillApplicationNoteAction {
  type: "prefill_application_note";
  label: string;
  application_id: string;
  note: string;
}

export interface CopilotFeatureExplainerAction {
  type: "show_feature_explainer";
  label: string;
  feature: string;
  body?: string;
  href?: string | null;
}

export type CopilotAction =
  | CopilotOpenRouteAction
  | CopilotPrefillJobSearchAction
  | CopilotCreateGoalWithTodosAction
  | CopilotCreateRoadmapAction
  | CopilotCreateTodoAction
  | CopilotPrefillGoalWithTodosAction
  | CopilotPrefillTodoAction
  | CopilotSaveApplicationAction
  | CopilotUpdateApplicationStatusAction
  | CopilotSaveApplicationNoteAction
  | CopilotPrefillApplicationNoteAction
  | CopilotFeatureExplainerAction;

export interface CopilotValidatedAction {
  valid: boolean;
  action: CopilotAction;
  action_type: CopilotAction["type"];
  label: string;
  summary: string;
  is_mutating: boolean;
  confirmation_label: string;
  href?: string;
}

export interface CopilotActionEvent {
  id: string;
  user_id: string;
  action_type: string;
  status: "validated" | "executed" | "rejected" | "failed";
  source: string;
  summary?: string | null;
  created_records: Record<string, unknown>;
  error?: string | null;
  created_at: string;
}
