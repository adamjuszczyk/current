-- Current V1 sandbox — initial schema.
--
-- Run this against the dedicated Supabase project (SQL editor, or
-- `supabase db push` once the project is linked). It is not applied
-- automatically by this repo.
--
-- ============================================================
-- The RLS policies below are pinned to the real owner UUID of the
-- single account this app is for. The placeholder sentinel that
-- shipped with this file has been substituted — there is nothing
-- left to fill in.
--
-- If this project is ever rebuilt against a different Supabase
-- project or a different account, every occurrence of the UUID in
-- the policies below must be replaced with that account's UUID
-- (Supabase dashboard → Authentication → Users). A UUID matching
-- no real user denies every row to everyone: this fails CLOSED,
-- never open.
--
-- Pinning the UUID is only half the protection. The other half is
-- "Allow new users to signup" being off in Auth settings, so no
-- second account can exist to be pinned against.
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
  using (auth.uid() = 'ceb87b61-c057-4fa9-a192-5ca046a01676')
  with check (auth.uid() = 'ceb87b61-c057-4fa9-a192-5ca046a01676');

create policy "owner only" on blocks
  for all
  using (auth.uid() = 'ceb87b61-c057-4fa9-a192-5ca046a01676')
  with check (auth.uid() = 'ceb87b61-c057-4fa9-a192-5ca046a01676');

create policy "owner only" on tasks
  for all
  using (auth.uid() = 'ceb87b61-c057-4fa9-a192-5ca046a01676')
  with check (auth.uid() = 'ceb87b61-c057-4fa9-a192-5ca046a01676');

create policy "owner only" on notes
  for all
  using (auth.uid() = 'ceb87b61-c057-4fa9-a192-5ca046a01676')
  with check (auth.uid() = 'ceb87b61-c057-4fa9-a192-5ca046a01676');
