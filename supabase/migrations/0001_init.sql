-- Current V1 sandbox — initial schema.
--
-- Run this against the dedicated Supabase project (SQL editor, or
-- `supabase db push` once the project is linked). It is not applied
-- automatically by this repo.
--
-- ============================================================
-- STOP — READ BEFORE RUNNING
--
-- The RLS policies below are pinned to the sentinel UUID
-- '00000000-0000-0000-0000-000000000000'. You MUST replace every
-- occurrence of that sentinel with the real UUID of the single
-- account this app is for (Supabase dashboard → Authentication →
-- Users, after creating that account) before running this file.
--
-- The sentinel matches no real Supabase user, so if you forget to
-- replace it, every policy below denies every row to everyone —
-- the migration fails CLOSED, not open. Safe to forget; useless
-- until fixed.
-- ============================================================

create table areas (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

create table blocks (
  id         uuid primary key default gen_random_uuid(),
  area_id    uuid not null references areas(id) on delete cascade,
  name       text not null,
  status     text not null default 'upcoming'
             check (status in ('upcoming', 'active', 'done')),
  x          double precision not null,
  y          double precision not null,
  created_at timestamptz not null default now()
);

create table tasks (
  id         uuid primary key default gen_random_uuid(),
  block_id   uuid not null references blocks(id) on delete cascade,
  text       text not null,
  completed  boolean not null default false,
  created_at timestamptz not null default now()
);

create table notes (
  id         uuid primary key default gen_random_uuid(),
  area_id    uuid not null references areas(id) on delete cascade,
  content    text not null default '',
  x          double precision not null,
  y          double precision not null,
  created_at timestamptz not null default now()
);

-- Row Level Security: single-account app, no user_id column on any table.
-- Every policy is pinned to the one owner's UID (see the sentinel warning
-- at the top of this file) rather than to "signed in at all" — email
-- signups being open by default plus the anon key shipping in the client
-- bundle would otherwise let any stranger who signs themselves up read
-- and write every row. Pinning the UID, combined with disabling email
-- signups in the dashboard so no second account can ever exist, is what
-- actually restricts access to that one user.

alter table areas  enable row level security;
alter table blocks enable row level security;
alter table tasks  enable row level security;
alter table notes  enable row level security;

create policy "owner only" on areas
  for all
  using (auth.uid() = '00000000-0000-0000-0000-000000000000')
  with check (auth.uid() = '00000000-0000-0000-0000-000000000000');

create policy "owner only" on blocks
  for all
  using (auth.uid() = '00000000-0000-0000-0000-000000000000')
  with check (auth.uid() = '00000000-0000-0000-0000-000000000000');

create policy "owner only" on tasks
  for all
  using (auth.uid() = '00000000-0000-0000-0000-000000000000')
  with check (auth.uid() = '00000000-0000-0000-0000-000000000000');

create policy "owner only" on notes
  for all
  using (auth.uid() = '00000000-0000-0000-0000-000000000000')
  with check (auth.uid() = '00000000-0000-0000-0000-000000000000');
