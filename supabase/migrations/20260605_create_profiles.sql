create table profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active_cv_id uuid references cvs(id) on delete set null,
  full_name text,
  headline text,
  location text,
  email text,
  phone text,
  links jsonb not null default '[]'::jsonb,
  summary text,
  skills jsonb not null default '[]'::jsonb,
  experience jsonb not null default '[]'::jsonb,
  education jsonb not null default '[]'::jsonb,
  projects jsonb not null default '[]'::jsonb,
  certifications jsonb not null default '[]'::jsonb,
  raw_sections jsonb not null default '{}'::jsonb,
  generated_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index profiles_active_cv_id_idx on profiles(active_cv_id);
