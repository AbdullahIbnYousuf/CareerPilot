-- Persist AI Assistant chat tabs independently from individual messages.

create table if not exists chat_sessions (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null default 'New conversation',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists chat_sessions_user_updated_idx
  on chat_sessions(user_id, updated_at desc);

with first_user_messages as (
  select distinct on (user_id, session_id)
    user_id,
    session_id,
    content
  from chat_messages
  where user_id is not null
    and session_id is not null
    and role = 'user'
  order by user_id, session_id, created_at asc
),
session_bounds as (
  select
    user_id,
    session_id,
    min(created_at) as created_at,
    max(created_at) as updated_at
  from chat_messages
  where user_id is not null
    and session_id is not null
  group by user_id, session_id
)
insert into chat_sessions(id, user_id, title, created_at, updated_at)
select
  session_bounds.session_id,
  session_bounds.user_id,
  coalesce(
    nullif(
      case
        when length(first_user_messages.content) > 42
          then substring(first_user_messages.content from 1 for 42) || '...'
        else first_user_messages.content
      end,
      ''
    ),
    'New conversation'
  ) as title,
  session_bounds.created_at,
  session_bounds.updated_at
from session_bounds
left join first_user_messages
  on first_user_messages.user_id = session_bounds.user_id
 and first_user_messages.session_id = session_bounds.session_id
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chat_messages_session_id_fkey'
  ) then
    alter table chat_messages
      add constraint chat_messages_session_id_fkey
      foreign key (session_id) references chat_sessions(id)
      on delete cascade;
  end if;
end $$;

alter table chat_sessions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'chat_sessions'
      and policyname = 'Users can read own chat sessions'
  ) then
    create policy "Users can read own chat sessions"
      on chat_sessions for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'chat_sessions'
      and policyname = 'Users can insert own chat sessions'
  ) then
    create policy "Users can insert own chat sessions"
      on chat_sessions for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'chat_sessions'
      and policyname = 'Users can update own chat sessions'
  ) then
    create policy "Users can update own chat sessions"
      on chat_sessions for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'chat_sessions'
      and policyname = 'Users can delete own chat sessions'
  ) then
    create policy "Users can delete own chat sessions"
      on chat_sessions for delete
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'chat_messages'
      and policyname = 'Users can read own chat messages'
  ) then
    create policy "Users can read own chat messages"
      on chat_messages for select
      using (auth.uid() = user_id);
  end if;
end $$;
