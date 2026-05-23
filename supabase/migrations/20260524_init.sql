-- 1. Enable pgvector extension
create extension if not exists vector;

-- 2. Create cvs table
create table cvs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  file_name text not null,
  file_url text,
  parsed_at timestamptz,
  created_at timestamptz default now()
);

-- Index for fast user lookups
create index cvs_user_id_idx on cvs(user_id);

-- 3. Create cv_chunks table
create table cv_chunks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  cv_id uuid references cvs(id) on delete cascade,
  section text not null check (section in ('skills', 'experience', 'education', 'projects')),
  content text not null,
  embedding vector(1024),
  fts tsvector generated always as (to_tsvector('english', content)) stored,
  created_at timestamptz default now()
);

-- HNSW index for fast vector similarity search
create index cv_chunks_embedding_idx on cv_chunks
  using hnsw (embedding vector_cosine_ops);

-- GIN index for full-text search
create index cv_chunks_fts_idx on cv_chunks using gin(fts);

-- Index for user lookups
create index cv_chunks_user_id_idx on cv_chunks(user_id);

-- 4. Create jobs table
create table jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  external_id text,
  title text not null,
  company text not null,
  location text,
  salary_range text,
  deadline text,
  description text,
  source text not null,
  fit_score int check (fit_score >= 0 and fit_score <= 100),
  fit_explanation text,
  cached_at timestamptz default now()
);

create index jobs_user_id_idx on jobs(user_id);
create index jobs_fit_score_idx on jobs(fit_score desc);

-- 5. Create applications table
create table applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  job_id uuid references jobs(id) on delete cascade,
  status text not null check (status in ('saved', 'applied', 'interviewing', 'offer', 'rejected')),
  applied_at timestamptz,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index applications_user_id_idx on applications(user_id);
create index applications_status_idx on applications(status);

-- 6. Create chat_messages table
create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  session_id uuid not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz default now()
);

create index chat_messages_session_idx on chat_messages(session_id, created_at);
create index chat_messages_user_id_idx on chat_messages(user_id);

-- 7. Create goals and todos tables
-- Goals
create table goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  target_date date,
  completed boolean default false,
  created_at timestamptz default now()
);

-- To-dos linked to goals
create table todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  goal_id uuid references goals(id) on delete set null,
  title text not null,
  due_date date,
  completed boolean default false,
  created_at timestamptz default now()
);

create index goals_user_id_idx on goals(user_id);
create index todos_user_id_idx on todos(user_id);
create index todos_due_date_idx on todos(due_date);

-- 8. Create nudges table
create table nudges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  message text not null,
  job_ids uuid[],
  seen boolean default false,
  created_at timestamptz default now()
);

create index nudges_user_id_idx on nudges(user_id);
create index nudges_seen_idx on nudges(seen) where seen = false;

-- 9. Create progress_snapshots table
create table progress_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  week_start date not null,
  applications_sent int default 0,
  skills_added int default 0,
  roadmap_pct int default 0 check (roadmap_pct >= 0 and roadmap_pct <= 100),
  streak_days int default 0,
  created_at timestamptz default now()
);

create index progress_snapshots_user_id_idx on progress_snapshots(user_id);
create unique index progress_snapshots_user_week_idx on progress_snapshots(user_id, week_start);

-- 10. Create hybrid_search stored procedure
create or replace function hybrid_search(
  query_embedding vector(1024),
  query_text text,
  match_count int,
  p_user_id uuid,
  p_section text default null
)
returns table (id uuid, content text, section text, score float)
language sql
as $$
  with semantic as (
    select
      cv_chunks.id,
      cv_chunks.content,
      cv_chunks.section,
      row_number() over (order by cv_chunks.embedding <=> query_embedding) as rank
    from cv_chunks
    where cv_chunks.user_id = p_user_id
      and (p_section is null or cv_chunks.section = p_section)
    order by cv_chunks.embedding <=> query_embedding
    limit 20
  ),
  keyword as (
    select
      cv_chunks.id,
      cv_chunks.content,
      cv_chunks.section,
      row_number() over (
        order by ts_rank(cv_chunks.fts, plainto_tsquery('english', query_text)) desc
      ) as rank
    from cv_chunks
    where cv_chunks.user_id = p_user_id
      and (p_section is null or cv_chunks.section = p_section)
      and cv_chunks.fts @@ plainto_tsquery('english', query_text)
    limit 20
  ),
  rrf as (
    select
      coalesce(s.id, k.id) as id,
      coalesce(s.content, k.content) as content,
      coalesce(s.section, k.section) as section,
      coalesce(1.0 / (60 + s.rank), 0.0) + coalesce(1.0 / (60 + k.rank), 0.0) as score
    from semantic s
    full outer join keyword k on s.id = k.id
  )
  select rrf.id, rrf.content, rrf.section, rrf.score
  from rrf
  order by rrf.score desc
  limit match_count;
$$;
