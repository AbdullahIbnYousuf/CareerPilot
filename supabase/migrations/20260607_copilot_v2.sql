-- Copilot V2: persistent preferences and confirmed-action audit trail.

create table if not exists career_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferred_name text,
  target_roles jsonb not null default '[]'::jsonb,
  preferred_locations jsonb not null default '[]'::jsonb,
  work_modes jsonb not null default '[]'::jsonb,
  seniority text,
  weekly_capacity_hours int check (weekly_capacity_hours is null or weekly_capacity_hours >= 0),
  target_start_date date,
  industries jsonb not null default '[]'::jsonb,
  updated_at timestamptz default now()
);

create table if not exists copilot_action_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  action_type text not null,
  status text not null check (status in ('validated', 'executed', 'rejected', 'failed')),
  source text not null default 'widget',
  summary text,
  action jsonb not null default '{}'::jsonb,
  created_records jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz default now()
);

create index if not exists copilot_action_events_user_created_idx
  on copilot_action_events(user_id, created_at desc);

alter table career_preferences enable row level security;
alter table copilot_action_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'career_preferences'
      and policyname = 'Users can read own career preferences'
  ) then
    create policy "Users can read own career preferences"
      on career_preferences for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'career_preferences'
      and policyname = 'Users can insert own career preferences'
  ) then
    create policy "Users can insert own career preferences"
      on career_preferences for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'career_preferences'
      and policyname = 'Users can update own career preferences'
  ) then
    create policy "Users can update own career preferences"
      on career_preferences for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'copilot_action_events'
      and policyname = 'Users can read own copilot action events'
  ) then
    create policy "Users can read own copilot action events"
      on copilot_action_events for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'copilot_action_events'
      and policyname = 'Service role can manage copilot action events'
  ) then
    create policy "Service role can manage copilot action events"
      on copilot_action_events for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;
