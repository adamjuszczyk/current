# TASKS.md — Current V1 Sandbox

Generated from `CURRENT-V1-SANDBOX-SPEC.md`. Scoped strictly to that document — nothing here anticipates a later version.

Build order is top to bottom. Each phase leaves the app in a usable state.

---

## Data model

Everything in the spec, nothing more. No ordering columns anywhere (blocks, tasks, and notes are all explicitly unordered). No soft deletes.

```sql
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
```

`on delete cascade` covers both delete rules in the spec: Area → its Blocks and Notes; Block → its Tasks.

---

## Phase 0 — Project setup

- [x] **0.1** Vite + React + TypeScript project at repo root.
- [x] **0.2** Tailwind configured. No theme customisation, no design tokens — defaults only. Visual design is explicitly not part of this pass.
- [x] **0.3** Supabase client wired to the dedicated project; URL and anon key from `.env` (`.env` gitignored, `.env.example` committed).
  - Supabase email auth, one account. RLS policies on `areas`, `blocks`, `tasks`, and `notes` restrict every row to that authenticated user — the anon key alone must never be sufficient to read or write real data.
  - One login screen; no sign-up flow beyond the single account, no OAuth providers, no multi-user support.
  - **Acceptance:** with RLS enabled and no session, all four tables return no rows and reject writes.
  - Code side complete: migration (`supabase/migrations/0001_init.sql`), client, and login screen are all written. The migration's RLS policies are pinned to the owner's UID (a sentinel placeholder until the real account exists — see the comment at the top of the migration file), not merely to "signed in," since Supabase allows email signups by default and the anon key ships publicly in the client bundle. The other half of the fix — disabling email signups in the Supabase dashboard so no second account can ever exist — has to happen there, not in code. The acceptance criterion itself is unverified — it needs a live Supabase project, which this session has no credentials for. `npm run verify:rls` checks it mechanically (including that signup is rejected) once Adam provisions the project, disables signups, fills in the real UUID, and fills in `.env`. See `CONTEXT.md`.
- [x] **0.4** TanStack Query provider at the app root.
- [x] **0.5** Zustand store for transient UI state only (which popup is open, which area tab is active). No persisted or server data in it.

**Not installed in this build:** Dexie, vite-plugin-pwa, Recharts. The spec has no offline requirement, no installability requirement, and nothing to chart. They stay in the declared stack in `CONTEXT.md` for when something actually needs them — installing and configuring them now would be setup for a version this build is deliberately not planning for.

---

## Phase 1 — Shared primitives

Two things every later phase depends on. Built once, kept plain.

- [x] **1.1** Popup/modal shell. Opens over the app, closes on Escape and on backdrop click. One component, reused by every popup in the spec.
- [x] **1.2** Confirm dialog. Takes a message, resolves confirm or cancel.
  - **Acceptance:** no delete path in the app can complete without passing through this. Covers Area, Block, and Task — the spec's "no silent, instant deletes anywhere."

---

## Phase 2 — Areas

- [ ] **2.1** Area tab row across the top. One tab per Area, ordered by `created_at`. Clicking a tab makes it the active Area.
  - No reordering, no drag — the spec doesn't have it.
- [ ] **2.2** "+" button at the end of the tab row → popup with a single name field. Submitting creates the Area and makes it active.
- [ ] **2.3** Double-clicking a tab → popup with the name editable and a Delete action.
- [ ] **2.4** Deleting an Area goes through the confirm dialog, then deletes the Area and everything inside it (cascade). Active tab falls back to the first remaining Area, or an empty state if none.
  - **Acceptance:** deleting an Area with blocks, tasks, and notes in it leaves no orphaned rows.

---

## Phase 3 — Canvas and Blocks

- [ ] **3.1** Canvas fills the space below the tab row and renders the active Area's blocks at their stored `x`/`y`.
  - No zoom, no pan controls — both are explicitly out. Native scroll only, if content runs past the viewport.
- [ ] **3.2** Blocks are draggable and persist `x`/`y` on drop. Freeform placement, no snapping, no grid, no auto-stacking.
- [ ] **3.3** "+ Add block" action → popup with a name field and a quick-capture task field: type a line, press Enter, next line, each line becoming a task on creation.
  - Tasks are optional here — a block can be created with a name alone.
- [ ] **3.4** Block status rendering, three states:
  - `active` — full, normal colour.
  - `done` — dimmed/desaturated.
  - `upcoming` — same dimmed treatment as `done`, plus one small coloured marker so the two don't read identically at a glance.
- [ ] **3.5** New blocks are created at a fixed default position (centre of the visible canvas). The person using it drags them where they want.
  - This is the minimum needed to give a new block coordinates. It is not an arrangement rule — nothing repositions a block after creation.

---

## Phase 4 — Block popup

Double-clicking a Block opens one popup that does everything below.

- [ ] **4.1** Block name editable.
- [ ] **4.2** Status set manually here — Upcoming / Active / Done. No automatic transitions; completing every task does not move a block to Done.
- [ ] **4.3** Tasks as a flat, unordered list. Add, edit inline, toggle complete, delete individually.
- [ ] **4.4** Task delete goes through the confirm dialog.
- [ ] **4.5** Block delete goes through the confirm dialog, then deletes the block and all its tasks (cascade).
  - **Acceptance:** full CRUD on tasks works without leaving the popup; no task ordering UI exists.

---

## Phase 5 — Free Notes

- [ ] **5.1** "+ Note" action creates an empty note immediately — no popup — placed on the canvas and focused for typing.
- [ ] **5.2** Note content saves on blur. Notes are draggable and persist `x`/`y`, same as blocks.
- [ ] **5.3** A note left empty is discarded automatically on blur. Covers only a note that was never given real content.
- [ ] **5.4** A note with real content gets its own explicit delete action, gated by the same confirm dialog as everything else — not deleted indirectly by clearing its text.
- [ ] **5.5** Multiple notes per Area. No connections, no ordering.

---

## Open decisions

Both resolved.

1. **Database access.** Supabase email auth, one account, RLS locking every table to that user — see Phase 0.3.
2. **Deleting a non-empty note.** Its own explicit delete action, gated by the confirm dialog — see Phase 5.4. Auto-discard-on-empty-blur (5.3) still covers only a note that was never given real content.

---

## Out of scope

Not built, not scaffolded for, not designed around: Vision, Phase and everything with it (scrollable timeline, End Phase, Plan Next Phase, breadcrumb, "back to current"), block-to-block connections of any kind (sequencing, branching, merging, blocking, Waiting status), sub-Projects and nested steps, project detail as a modal-or-tab with resize/fullscreen, zoom, pan, status filtering, theming, and any visual design pass.

No schema columns, abstraction layers, or component seams exist in anticipation of these. When one of them is actually wanted, it gets built then, against what real use of this sandbox has shown.
