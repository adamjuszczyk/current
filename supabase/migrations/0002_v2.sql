-- Current V2 sandbox — schema delta and v1 -> v2 data migration.
--
-- Run this against the dedicated Supabase project (SQL editor, or
-- `supabase db push`), the same way as 0001_init.sql. It is not applied
-- automatically by this repo.
--
-- This is Phase 2a's chunk: the delta is written and proven against a
-- scratch database. It does NOT run against the live project — that is
-- Phase 2b, gated on a confirmed backup, since this migration rewrites
-- rows that are in real daily use rather than an empty database.
--
-- The data migration below runs once. It is not idempotent and is not
-- written to be: every block with tasks gets exactly one new Flat list
-- created for it, so running this a second time would create a second
-- list and move tasks again in ways this migration doesn't account for.
--
-- ============================================================
-- RLS policies below are pinned to the same owner UUID already
-- substituted into supabase/migrations/0001_init.sql. If this project
-- is ever rebuilt against a different Supabase project or account,
-- every occurrence of the UUID here must be replaced with that
-- account's UUID too, exactly as 0001_init.sql's own header explains.
-- ============================================================

-- 0. Pre-migration snapshot — the restore point for step 2's one
--    destructive act, dropping tasks.block_id.
--
--    Adam's call, taking the place of the live backup 2b.1 asks for:
--    Supabase paywalls scheduled backups and PITR, and he chose this
--    over a manual pg_dump. It needs no plan and no external storage,
--    and because it is copied here BEFORE anything is altered, the
--    pre-v2 state of all four v1 tables — tasks still carrying their
--    block_id — survives inside the database itself.
--
--    It lives in its own schema, deliberately NOT in public. A table
--    sitting in public without RLS is served by PostgREST to anyone
--    holding the anon key, which ships publicly in the client bundle —
--    so a snapshot put there would hand a stranger every task in the
--    account. PostgREST only exposes public, so v1_backup is
--    unreachable through the API; the revoke below is the second layer,
--    the same belt-and-braces reasoning as pinning the RLS policies to
--    the owner UUID *and* disabling signups.
--
--    To restore: the rows are plain copies, so `insert into tasks
--    select ... from v1_backup.tasks` after recreating a block_id
--    column, or simply read them to rebuild by hand. Drop the schema
--    once v2 has been in real use long enough to trust.

create schema if not exists v1_backup;
revoke all on schema v1_backup from anon, authenticated;

create table v1_backup.areas  as select * from areas;
create table v1_backup.blocks as select * from blocks;
create table v1_backup.tasks  as select * from tasks;
create table v1_backup.notes  as select * from notes;

revoke all on all tables in schema v1_backup from anon, authenticated;

-- 1. Lists. Kind is fixed at creation, per the spec ("chosen when it's created").
create table lists (
  id         uuid primary key default gen_random_uuid(),
  block_id   uuid not null references blocks(id) on delete cascade,
  kind       text not null check (kind in ('step', 'flat')),
  title      text not null default '',
  x          double precision not null,
  y          double precision not null,
  created_at timestamptz not null default now()
);

-- 2. Tasks move from blocks into lists, carrying every existing row with them.
--    Ordering within a step list is created_at, so no column is added for it.
alter table tasks add column list_id uuid references lists(id) on delete cascade;

insert into lists (block_id, kind, title, x, y, created_at)
select b.id, 'flat', '', 24, 24, b.created_at
from blocks b
where exists (select 1 from tasks t where t.block_id = b.id);

update tasks t
set list_id = l.id
from lists l
where l.block_id = t.block_id;

alter table tasks alter column list_id set not null;
alter table tasks drop column block_id;

-- 3. Notes live at the Area level or inside one project — exactly one parent.
alter table notes alter column area_id drop not null;
alter table notes add column block_id uuid references blocks(id) on delete cascade;
alter table notes add constraint notes_one_parent
  check ((area_id is null) <> (block_id is null));

-- 4. Focused is a flag. Waiting is not (see TASKS.md's Data model section).
alter table blocks add column focused boolean not null default false;

-- 5. Connections. Acyclicity is not expressible here — enforced client-side.
create table connections (
  id         uuid primary key default gen_random_uuid(),
  area_id    uuid not null references areas(id) on delete cascade,
  source_id  uuid not null references blocks(id) on delete cascade,
  target_id  uuid not null references blocks(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (source_id <> target_id),
  unique (source_id, target_id)
);

-- 6. Waiting entries, and the tasks a picked-task entry holds.
create table waiting_entries (
  id         uuid primary key default gen_random_uuid(),
  block_id   uuid not null references blocks(id) on delete cascade,
  kind       text not null check (kind in ('text', 'tasks')),
  text       text not null default '',
  created_at timestamptz not null default now()
);

create table waiting_entry_tasks (
  entry_id   uuid not null references waiting_entries(id) on delete cascade,
  task_id    uuid not null references tasks(id) on delete cascade,
  primary key (entry_id, task_id)
);

-- Row Level Security on the four new tables, same shape and same reason as
-- 0001_init.sql: one owner-pinned "for all" policy per table, since none
-- of these tables have a user_id column to filter by either.

alter table lists              enable row level security;
alter table connections        enable row level security;
alter table waiting_entries    enable row level security;
alter table waiting_entry_tasks enable row level security;

create policy "owner only" on lists
  for all
  using (auth.uid() = 'ceb87b61-c057-4fa9-a192-5ca046a01676')
  with check (auth.uid() = 'ceb87b61-c057-4fa9-a192-5ca046a01676');

create policy "owner only" on connections
  for all
  using (auth.uid() = 'ceb87b61-c057-4fa9-a192-5ca046a01676')
  with check (auth.uid() = 'ceb87b61-c057-4fa9-a192-5ca046a01676');

create policy "owner only" on waiting_entries
  for all
  using (auth.uid() = 'ceb87b61-c057-4fa9-a192-5ca046a01676')
  with check (auth.uid() = 'ceb87b61-c057-4fa9-a192-5ca046a01676');

create policy "owner only" on waiting_entry_tasks
  for all
  using (auth.uid() = 'ceb87b61-c057-4fa9-a192-5ca046a01676')
  with check (auth.uid() = 'ceb87b61-c057-4fa9-a192-5ca046a01676');
