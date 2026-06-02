-- Add completed_at timestamptz to todos table if missing
alter table todos add column if not exists completed_at timestamptz;

-- Backfill completed todos with created_at if completed_at is null and completed is true
update todos
set completed_at = created_at
where completed = true and completed_at is null;
