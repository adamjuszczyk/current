-- Current V1 sandbox — initial schema.
--
-- Run this against the dedicated Supabase project (SQL editor, or
-- `supabase db push` once the project is linked). It is not applied
-- automatically by this repo.

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
-- Every table is locked to "signed in at all" — since only one account
-- can ever authenticate against this project, an authenticated session
-- and "that user" are the same thing. No session (anon key alone) means
-- auth.uid() is null, so every policy below denies the row.

alter table areas  enable row level security;
alter table blocks enable row level security;
alter table tasks  enable row level security;
alter table notes  enable row level security;

create policy "authenticated user only" on areas
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

create policy "authenticated user only" on blocks
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

create policy "authenticated user only" on tasks
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

create policy "authenticated user only" on notes
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);
