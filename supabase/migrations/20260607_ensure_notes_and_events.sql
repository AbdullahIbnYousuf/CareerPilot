-- Ensure notes and updated_at columns exist on applications table
alter table applications
  add column if not exists notes text,
  add column if not exists updated_at timestamptz default now();

-- Ensure application_events table exists
create table if not exists application_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  application_id uuid references applications(id) on delete cascade not null,
  event_type text not null check (event_type in ('created', 'status_changed', 'note_updated')),
  from_status text,
  to_status text,
  note text,
  created_at timestamptz default now()
);

-- Indexes (idempotent)
create index if not exists application_events_application_idx
  on application_events(application_id, created_at desc);

create index if not exists application_events_user_idx
  on application_events(user_id, created_at desc);

-- Enable RLS
alter table application_events enable row level security;

-- RLS policies (drop and recreate to be idempotent)
drop policy if exists "Users can read own application events" on application_events;
create policy "Users can read own application events"
  on application_events for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own application events" on application_events;
create policy "Users can insert own application events"
  on application_events for insert
  with check (auth.uid() = user_id);

-- Service role bypass policy (allows backend service role inserts)
drop policy if exists "Service role can manage application events" on application_events;
create policy "Service role can manage application events"
  on application_events for all
  using (true)
  with check (true);
