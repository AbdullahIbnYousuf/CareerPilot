-- Copilot guided assistant state: whole-app onboarding and feature exposure.

create table if not exists copilot_user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  onboarding jsonb not null default '{}'::jsonb,
  completed_steps jsonb not null default '[]'::jsonb,
  feature_exposures jsonb not null default '{}'::jsonb,
  guidance_level text not null default 'first_run'
    check (guidance_level in ('first_run', 'guided', 'light', 'minimal')),
  last_suggested_step text,
  updated_at timestamptz default now()
);

alter table copilot_user_state enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'copilot_user_state'
      and policyname = 'Users can read own copilot state'
  ) then
    create policy "Users can read own copilot state"
      on copilot_user_state for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'copilot_user_state'
      and policyname = 'Users can insert own copilot state'
  ) then
    create policy "Users can insert own copilot state"
      on copilot_user_state for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'copilot_user_state'
      and policyname = 'Users can update own copilot state'
  ) then
    create policy "Users can update own copilot state"
      on copilot_user_state for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'copilot_user_state'
      and policyname = 'Service role can manage copilot state'
  ) then
    create policy "Service role can manage copilot state"
      on copilot_user_state for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;
