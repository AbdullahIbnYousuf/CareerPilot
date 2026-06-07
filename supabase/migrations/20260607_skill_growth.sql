-- Migration: Skill Growth Through Goals
-- Adds target_skill to goals and creates profile_skill_events audit table.

-- 1. Add target_skill column to goals
alter table goals
  add column if not exists target_skill text;

-- 2. Create profile_skill_events table
create table if not exists profile_skill_events (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete cascade not null,
  skill          text not null,
  event_type     text not null check (event_type in ('added')),
  source_goal_id uuid references goals(id) on delete set null,
  created_at     timestamptz default now()
);

-- 3. Indexes
create index if not exists profile_skill_events_user_created_idx
  on profile_skill_events(user_id, created_at desc);

-- Prevent duplicate events for the same user+skill+goal combination
create unique index if not exists profile_skill_events_user_skill_goal_idx
  on profile_skill_events(user_id, lower(skill), source_goal_id)
  where source_goal_id is not null;
