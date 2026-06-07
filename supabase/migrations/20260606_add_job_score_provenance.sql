alter table jobs
  add column if not exists scored_cv_id uuid references cvs(id) on delete set null,
  add column if not exists fit_score_calculated_at timestamptz,
  add column if not exists fit_score_version text;

create index if not exists jobs_user_scored_cv_fit_score_idx
  on jobs(user_id, scored_cv_id, fit_score desc);
