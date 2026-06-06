-- Create application_events table to track state changes and note updates
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

-- Index for fast lookups per application
create index if not exists application_events_application_idx
  on application_events(application_id, created_at desc);

-- Index for fast user lookups
create index if not exists application_events_user_idx
  on application_events(user_id, created_at desc);

-- Enable Row Level Security
alter table application_events enable row level security;

-- Policies for Row Level Security
create policy "Users can read own application events"
  on application_events for select
  using (auth.uid() = user_id);

create policy "Users can insert own application events"
  on application_events for insert
  with check (auth.uid() = user_id);
