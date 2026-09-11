# TASKS.md — Current V2 Sandbox

Generated from `CURRENT-V2-SANDBOX-SPEC.md`. Scoped strictly to that document — nothing here anticipates a later version. Where the spec is silent, this plan takes the narrowest reading that satisfies it and says so; where the silence has a real product consequence, it goes to **Open decisions** instead of being guessed at.

V1's plan is `TASKS-V1.md`, kept for the record. Phase numbers below are v2's own and restart at 1 — v1's phases 0–5 are that file's, not this one's.

Build order is top to bottom. Each phase leaves the app in a usable state.

**One thing is different from v1: the database is no longer empty.** V1 is live and has been used for real — that use is the entire reason v2 exists. Phase 2b rewrites the shape of live data, so it is a migration with something to lose, not a greenfield one — which is exactly why writing and proving the migration (2a) is kept separate from running it against the live project (2b).

---

## Data model

V1's four tables stay. Everything below is the delta the spec forces, and nothing else — the shape of `supabase/migrations/0002_v2.sql`.

Two things the spec might look like it needs and doesn't:

- **No `waiting` column.** "Entries, not one field" — a project is Waiting exactly when it has at least one Waiting entry. Ready is likewise derived, never stored.
- **No `position` column, anywhere.** A step-by-step list's order is its creation order. The spec's task CRUD is add / edit / delete / mark complete; reordering is not among them, so nothing needs a column to reorder against.

```sql
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

-- 4. Focused is a flag. Waiting is not (see above).
alter table blocks add column focused boolean not null default false;

-- 5. Connections. Acyclicity is not expressible here — see 6.2.
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
```

**This delta has been run, not just written.** Against a scratch Postgres 16 seeded with representative v1 data — two Areas, a block with tasks, a block without, tasks in a second Area, and notes — the whole chain applies clean and every task survives into a Flat list under its original block, with its completed state intact. The blocks-without-tasks case correctly gets no list. Also confirmed there: the `notes` one-parent check accepts existing rows and both new shapes while rejecting neither-and-both; `lists.kind` and `waiting_entries.kind` reject unknown values; a self-connection and a duplicate connection are both refused; and the full cascade chain holds from an Area delete down through lists, tasks, notes at both levels, connections and Waiting entries. What the database does **not** catch is a two-block cycle — it accepts `A→B` and `B→A` quite happily, which is exactly why 6.3 puts acyclicity in the client.

`connections.area_id` is the one denormalised column here. Both endpoints already imply the Area, so it is redundant — but the canvas loads every connection in an Area on every render, and nothing in this app moves a block between Areas, so it cannot drift. It earns its place as a query key, not as flexibility.

`on delete cascade` continues to carry every delete rule: Area → its Blocks, Area-level Notes and Connections; Block → its Lists, project Notes, Waiting entries and Connections at either end; List → its Tasks.

---

## Phase 1 — Expanding text inputs

The one thing v1 got wrong that has nothing to do with the new data model. First because it needs no migration, so it lands whatever happens with Phase 2b's gate — and because every later phase that renders text reuses what it builds.

- [x] **1.1** One auto-growing text component. Height follows content, no fixed rows, no inner scrollbar, and it shrinks back when content is removed.
- [x] **1.2** Applied to Note content (`NoteCard`), Area-level today and project-level in Phase 3.
- [x] **1.3** Applied to task text — both the inline edit field and the add field in the block popup.
  - **Acceptance verified 2026-09-10** in a headless browser against a temporary in-memory mock of the Supabase client (written over `src/lib/supabase.ts`, restored before committing, same pattern as every v1 phase): a note and a task each filled with three long paragraphs grew from a single-line 28-32px box to ~270-350px, `scrollHeight` matched `clientHeight` (no inner scrollbar, `overflow-y: hidden`) and every line was visible in a screenshot with nothing clipped; clearing the content back out returned both boxes to their original single-line height. The "Add a task" field grows the same way, and switching it to a textarea meant Enter inserted a newline instead of submitting — confirmed a newline typed mid-entry stayed in the field until the Add button was clicked, after which the field emptied and shrank back down. **That part is superseded by the fix chunk below: Enter adds the task again.**
  - **Fix chunk, 2026-09-11 — two defects closed, see CONTEXT.md's Phase 1 build-log entry for the full measurements.** (a) `AutoGrowTextarea` was short by its border width on any bordered instance (`box-sizing: border-box` makes `style.height` set the border box while `scrollHeight` describes the content box) — invisible on the borderless Note field, real on the bordered task fields in `BlockEditPopup`. Fixed by adding `offsetHeight - clientHeight` back onto the written height. Measured before the fix on a bordered task field: `clientHeight 438`, `scrollHeight 440`, `scrollTopMax 2`; after: `clientHeight === scrollHeight`, `scrollTopMax 0`. (b) In "Add a task" only, Enter now submits the form (adds the task) again and Shift+Enter inserts a newline — restoring v1's verified Enter-adds behaviour without giving up multi-line entry. `TaskRow`'s inline edit field is unchanged: Enter still inserts a newline there, and it still commits on blur.

The spec names Task text and Note text specifically. Nothing else — Area names, Block names, List titles — is a multi-line field, so nothing else changes.

---

## Phase 2a — Schema and data migration, written and proven

Everything from here on depends on this shipping correctly. Per `CONTEXT.md`'s escalation criteria, a schema change is always Adam's, and this one is stronger than v1's: it rewrites rows that exist and are in real use. This chunk writes the migration and proves it against a scratch database — it does not touch the live project. That's Phase 2b, on its own, gated on a backup.

- [x] **2a.1** `supabase/migrations/0002_v2.sql`, exactly the delta in Data model above, in order: the new tables and changed columns, then the v1 → v2 data migration itself — before `tasks.block_id` is dropped, every block that has tasks gets one untitled Flat list holding them, placed at a fixed origin on its project canvas, and a block with no tasks gets no list. Runs once; it is not idempotent and does not need to be.
  - **Acceptance verified 2026-09-11**, fresh, against a scratch Postgres 16 database (not by citing an earlier run): seeded with two Areas ("Work", "Home"), three Blocks — one with three tasks (one completed) in "Work", one with zero tasks in "Work", one with two tasks (one completed) in "Home" — and two Area-level Notes. After running the committed `0002_v2.sql` verbatim: all 5 tasks survived, each still under its original block (via its new list's `block_id`), each in a `kind='flat'` list, `text` and `completed` unchanged for every row; the zero-task block got zero lists (`0` rows, confirmed by query); `tasks.block_id` no longer exists on the table (confirmed via `\d tasks`). Also exercised beyond the acceptance line: `notes_one_parent` accepts the two pre-existing area-only rows and a new block-only row, and rejects both-null and both-set; `lists.kind` and `waiting_entries.kind` reject a bogus value; `connections` rejects a self-edge and a duplicate edge but — as documented above — accepts both directions of a 2-block cycle; and the full cascade from an `areas` delete removes the Area's blocks, their lists, their tasks, area-level and block-level notes under it, connections touching its blocks, and waiting entries/picks on those blocks, while a sibling Area is untouched (row counts confirmed before and after with SQL, not inferred).
- [x] **2a.2** RLS on all four new tables, pinned to the same owner UUID as `0001_init.sql` — same policy shape, same reason.
  - **Acceptance — verified 2026-09-11, but not by `npm run verify:rls` itself.** This container has Postgres 16 and `psql` but no Supabase CLI, no PostgREST, and no GoTrue, so `verify:rls` cannot actually run end to end here — it was extended (all four `writeProbes` plus `lists`, `connections`, `waiting_entries`, `waiting_entry_tasks`) and is verified **by reading only**; it has not been executed against anything in this chunk. A real PostgREST was attempted first (`docker pull postgrest/postgrest`) and blocked by the environment's egress allowlist (`Forbidden` fetching the image blob from Docker Hub's CDN), confirming the container genuinely can't reach it rather than the attempt being skipped. In its place: a minimal `auth.uid()` stub and `anon`/`authenticated` roles were created directly in the scratch database (mirroring Supabase's own setup), and all eight tables were probed as `anon` under two identities — no `request.jwt.claims` set at all, and a `claims` value naming a different uid — each doing a `select`, an `insert`, an `update`, and a `delete` inside a rolled-back transaction. Result, all eight tables, both identities: `select count(*)` is `0`; `insert` fails with Postgres SQLSTATE `42501` ("new row violates row-level security policy for table …" — confirmed the literal SQLSTATE via a `DO` block, since that is exactly the code PostgREST surfaces as its error `code`); `update`/`delete` affect `0` rows (there is nothing for `using()` to make visible to them — the same reason `verify-rls.mjs` itself only probes inserts for its write check). This is a genuine test of the same policies PostgREST would enforce, not a stand-in that skips the point — but it is SQL against Postgres directly, not `verify:rls` against PostgREST, and the script's own real run is still owed at 2b against the live project.
- [x] **2a.3** Client changes to keep v1's surface working unchanged on the new shape: `src/types.ts`, `useTasks` keyed by list rather than block, notes hooks handling either parent, and `BlockEditPopup` reading its block's list. Quick-capture in `BlockCreatePopup` writes its lines into one untitled Flat list — the same thing 2a.1's data migration does to existing data, so the two paths agree.
  - This is a stepping stone, not throwaway: Phase 3 generalises it to many lists of both kinds rather than replacing it.
  - **Acceptance verified 2026-09-11** in a headless browser (Chromium via Playwright, installed `--no-save` and removed afterward) driving the real `vite dev` app — unminified, real hooks, real mutation paths — against a hand-rolled PostgREST stand-in that forwards every `/rest/v1/*` request as real SQL to the **same scratch Postgres 2a.1 was proven against**, chosen over a hand-written in-memory fixture per the brief's preference. Signed in via a seeded `localStorage` session (no login screen); the pre-existing "Home" area from the scratch DB rendered correctly. Drove, in order, against real rows (every assertion below checked the scratch database directly, not the DOM): created an Area ("Errands"); renamed it via the edit popup (`AreaEditPopup` commits on form submit, not blur); created a Block with a two-line quick-capture ("Buy milk" / "Buy eggs") — confirmed exactly one `kind='flat'` list created at `(24, 24)` holding both tasks; opened that block's popup — both tasks shown; added a third task through the popup's own field — landed in the *same* list, no second list created; toggled one task complete — persisted; edited another's text inline — persisted; deleted one task — row removed; deleted the block itself — its list and remaining tasks cascaded away; created a second Block with an empty quick-capture — confirmed it got zero lists; opened its popup — rendered "No tasks yet." without crashing on the missing list; added a task through the popup — confirmed the lazy list-creation path created exactly one new `kind='flat'` list at the same fixed `(24, 24)` origin and put the task in it; created an Area-level Note, typed content, blurred — persisted with `area_id` set and `block_id` null; deleted the Area — its Block and Note cascaded with it. **20/20 checks passed**, two screenshots taken (block popup mid-edit; canvas with a note). One false failure surfaced and was fixed in the test itself, not the app: two quick-captured tasks inserted in one statement share a single `created_at` (transaction-time `now()`), so `order by created_at` has a genuine tie between them — exactly the "flat, unordered list, no ordering column" behaviour the code's own comments already describe; the check was rewritten to key off the row the checkbox actually targets (via its `aria-label`) instead of re-deriving order from a tied sort. **Not checked:** anything the shape doesn't support yet — step-list ordering/enforcement (Phase 3), Waiting/Connect/Focused (out of scope this phase) — or the live Supabase project (no credentials in this environment, by design; owed at 2b).

---

## Phase 2b — Apply the migration to the live database

The one irreversible action in the whole build. It is its own chunk, separate from 2a, specifically because of that: everything in 2a can be redone if it turns out wrong; this can't.

- [x] **2b.1** ~~Take a live backup from the Supabase dashboard.~~ **Replaced, by Adam's decision 2026-09-11, with an in-database snapshot built into the migration itself.**
  - V1's migration ran against an empty database and had nothing to lose; this one rewrites rows in real daily use. That reasoning is unchanged — what changed is how the restore point is taken.
  - Supabase paywalls scheduled backups and PITR. A manual `pg_dump` over the connection string is free on every tier and was offered; Adam chose the snapshot instead.
  - `0002_v2.sql` now opens by copying all four v1 tables into a `v1_backup` schema, **before** anything is altered — so `v1_backup.tasks` still carries the `block_id` that step 2 drops. The snapshot is created in its own schema rather than `public` on purpose: a table in `public` without RLS is served by PostgREST to anyone holding the anon key, which ships publicly in the client bundle, so a snapshot placed there would expose every task in the account. Verified: `anon` gets `permission denied for schema v1_backup`, and the schema grants no privileges to `anon` or `authenticated`.
  - **Know what this does and does not cover.** It makes *this migration* recoverable: if the v1 → v2 rewrite goes wrong, the pre-migration rows are still there to rebuild from. It is **not** a backup of the database — it lives inside the very database it protects, so it does nothing about the project being deleted, corrupted, or lost. A `pg_dump` remains the only restore point that survives that, and is still worth taking.
  - Drop the `v1_backup` schema once v2 has been in real use long enough to trust.
- [x] **2b.2** Run `0002_v2.sql`, as verified fresh in 2a.1, against the live project.
  - **Applied 2026-09-11 — by the Supabase GitHub integration, not by hand.** Confirmed from `supabase_migrations.schema_migrations`, which records `0001 (init)` and `0002 (v2)`; a script pasted into the SQL editor is not recorded there. The push that put `0002_v2.sql` on `main` at 07:31:41 is what applied it. See `CONTEXT.md`'s build log for what that meant for this phase's gate.
  - **Acceptance, task half — met.** Against the live data: 20 tasks, all 20 in a `flat` list, 0 in a non-flat list, 0 with no list; 8 lists across 8 blocks that hold tasks, no block with more than one list, no list without a block; 13 blocks total, so the other 5 correctly got no list; 7 Area-level notes, 0 block-level, no orphans.
  - **How "every task that existed before still exists" is established.** There is no pre-migration baseline for the live database, so it is not proven by comparing counts, and is not claimed to be. It follows structurally instead: `0002_v2.sql` contains no `delete` anywhere, and `alter column list_id set not null` would have failed had any task not been assigned a list from its own block. Both held.
  - **Acceptance, RLS half — met 2026-09-11.** `npm run verify:rls` passed against the live project for all eight tables: every one returned no rows with no session and refused writes with PostgREST `42501` ("new row violates row-level security policy"), and signup was refused with `422 signup_disabled`. Those codes could only come from the real Postgres and GoTrue, which is exactly what v1's false pass could not produce. The anon key was checked before use — its JWT decodes to `ref: ieszecmiijxkcrxirwuk`, `role: anon` (not `service_role`, which would bypass RLS and make the whole check meaningless) and is unexpired.
  - **The snapshot's isolation was verified from outside, too.** With the public anon key, `Accept-Profile: v1_backup` returns `PGRST106 — Invalid schema: v1_backup. Only the following schemas are exposed: public, graphql_public`, and `v1_backup_tasks` is not addressable from `public`. Meanwhile `public.tasks` returns `[]` rather than an error, proving the request path works and the key is live — so the refusal is isolation, not a broken request.
  - **Acceptance:** the same check as 2a.1's dry run, now against the real data — every task that existed before still exists, still under the same block, in a Flat list. `npm run verify:rls` passes against the live project for all eight tables.

---

## Phase 3 — Project canvas

What a Block contains, replaced. The largest change in v2, and everything after it depends on tasks living in Lists.

- [x] **3.1** The block popup is resizable, like a normal window. No fullscreen mode, no separate tab — both deferred.
  - The size is live, not remembered: the spec asks for resizable, not for a remembered size, and remembering it would need a column. Session-only, no schema.
  - **Acceptance verified 2026-09-11** in a headless browser (Chromium via Playwright, `npm install --no-save`) against `vite dev`, real hooks, through a hand-rolled relay translating `/rest/v1/*` into real SQL against a scratch Postgres 16 seeded with `0001`+`0002`+`0003` (RLS genuinely enforced via `SET LOCAL ROLE authenticated` + `request.jwt.claims`, the same mechanism PostgREST itself uses — not bypassed via the superuser). `getComputedStyle(popupEl).resize === 'both'` (native CSS `resize`, no library); dragging the popup's bottom-right corner by (120, 80) grew both `offsetWidth`/`offsetHeight` by more than 50px each — measured before/after, not just eyeballed. Nothing about the resized size persisted across a reload — confirmed by inspection of `updateBlock`'s payload shape (name/status only) and the absence of any width/height column in `0002_v2.sql`.
- [x] **3.2** Inside the popup, a freeform canvas — the same placement model as Blocks on an Area, one level down. Lists and Notes render at their stored `x`/`y` and are draggable. No zoom, no pan.
  - **Acceptance verified 2026-09-11**, same harness: created a Step-by-step list, dragged it by (80, 60) via its header strip (pointer events, the exact `BlockCard`/`NoteCard` approach — no drag-and-drop library added), and the scratch database's `lists.x`/`y` changed accordingly (queried directly, not read off the DOM). Lists and Notes coexist and overlap freely with no anti-overlap logic, matching "freeform" — visible in the screenshots below.
- [x] **3.3** Create a List: kind chosen at creation, Step-by-step or Flat, plus an optional title line. Kind is fixed afterwards.
  - **Acceptance verified 2026-09-11**: created one list choosing "Step-by-step" with title "Setup steps" and a second choosing the default "Flat" with title "Errands" — both rows' `kind`/`title` confirmed by direct SQL query immediately after creation. No update path exists anywhere in the client for `lists.kind` (`useLists`/`useCreateList`/`useUpdateListPosition`/`useDeleteList` is the full set of list mutations — no `useUpdateList`), so kind cannot change after creation by construction, not by a guard that could be bypassed.
- [x] **3.4** Full CRUD on tasks within a list — add, edit inline, toggle complete, delete. Task delete goes through the confirm dialog, as in v1.
  - **Acceptance verified 2026-09-11**: added three tasks to the step list and two to the flat list through each list's own "Add a task" field, confirmed as 3 and 2 rows respectively via SQL; toggled completion (below, under 3.6); task text is inline-editable via the same `AutoGrowTextarea`/blur-commit pattern as Phase 4's original `TaskRow`. Delete is covered under 3.5/3.8's own verification, since every delete in this list also exercises the confirm gate.
- [x] **3.5** Deleting a task first checks whether any Waiting entry, on any project, holds it as a pick. If one does, the confirm dialog names the waiting project in its message, alongside the ordinary delete warning. Once confirmed, the pick is removed and, if it was that entry's last pick, the entry is removed with it — automatically, with no second confirmation; the warning already shown is what stands in for one.
  - Built here because this is where a task's own delete lives, and cross-referenced from Phase 4 (4.9) because it's Waiting entries this affects. The check has nothing to find until Phase 4 adds entries — the tables exist from 2a.1, but nothing can populate them before then — so this item is inert on its own build and becomes live the moment Phase 4 ships. Nothing about it needs revisiting when that happens.
  - This is the build for Open decision 2 from the previous plan, now resolved rather than defaulted: the pick disappearing was already what the database's cascade did on its own; what's new is the dialog naming the waiting project before it happens, so the loss is disclosed instead of merely tidied up after the fact.
  - **Acceptance verified 2026-09-11**, with the tables seeded directly by SQL since no UI can populate them yet (exactly the "inert on its own build" the plan anticipated): created a second block ("Other Project") in the same Area, inserted a `waiting_entries` row (`kind='tasks'`) on it holding one pick on a task in the step list, then deleted that task through the UI. The confirm dialog's message was read from the DOM and contained "Other Project" alongside the ordinary "Delete task ... ?" warning. After confirming: the task row was gone; its `waiting_entry_tasks` pick was gone (the FK cascade, not hand-written); and — the part that needed real code, not just the cascade — the now-empty `waiting_entries` row was also gone, removed by `removeEmptiedWaitingEntries`, with no second confirm dialog ever appearing.
- [x] **3.6** Step-by-step enforcement: a task cannot be marked complete until the one before it is. Order is creation order; there is no reorder affordance, because the spec's CRUD list doesn't have one.
  - Un-completing is gated the same way, from the other end: only the last completed task can be un-completed. That is what keeps completed tasks a contiguous prefix, which is what "strictly ordered" means. The alternative — gate only completion — allows task 1 incomplete while task 2 is complete, which is the exact state the rule exists to prevent.
  - A Flat list gates nothing: any task, any order, any time.
  - **Acceptance verified 2026-09-11 with the exact sequence the plan calls for**, against a real 3-task step list (Task 1/2/3) and, side by side in the same project, a real 2-task flat list — every assertion below checked the checkbox's `disabled` state *and* the database row, not just one or the other:
    - Step list: task 2's checkbox was `disabled` while task 1 was incomplete; a forced click on it left `tasks.completed` at `false` in the database. Completing task 1 succeeded and enabled task 2's checkbox; completing task 2 then succeeded. With both complete, task 1's checkbox was `disabled` (only the *last* completed task — task 2 — may un-complete) and a forced click left it `true` in the database. Un-completing task 2 succeeded and enabled task 1's checkbox; un-completing task 1 then succeeded.
    - Flat list, same project: task 2's checkbox was enabled while task 1 was still incomplete, and completing it (out of order) succeeded and persisted, with task 1 still `false` — no gating in either direction, confirmed by then un-completing it too.
- [x] **3.7** Notes on the project canvas, behaving exactly as Area notes do — created empty and focused, discarded automatically if never given real content, explicit confirm-gated delete once it has content. Same component, different parent.
  - **Acceptance verified 2026-09-11**: `BlockEditPopup`'s "+ Note" calls the same `useCreateNote`/`NoteCard` as the Area canvas, passing `{ blockId }` — the first real caller of that shape (2a.3 built the hook, nothing used it). Created a note, typed "Remember to update the changelog", blurred: the row persisted with `block_id` set and `area_id` null (queried directly). Created a second note and blurred it with no typing: the block's note count was unchanged before/after (auto-discarded, no confirm). `NoteCard` itself was not forked — zero changes to `src/components/NoteCard.tsx` this phase.
- [x] **3.8** List delete goes through the confirm dialog and takes its tasks with it (cascade).
  - **Acceptance verified 2026-09-11**: confirmed the flat list ("Errands") held 2 tasks, clicked "Delete list", confirmed the dialog (message named the list's title), and confirmed both the `lists` row and both `tasks` rows were gone — `useDeleteList` only deletes the `lists` row; the tasks are gone via `on delete cascade`, not a second client-side delete. Also checked, beyond the acceptance line: deleting the block itself cascades its remaining list, that list's remaining tasks, and its note in one action (the same cascade Phase 4 already relied on, now proven with real project-canvas content underneath it).
  - **Acceptance (whole-phase):** one project held a Step-by-step list ("Setup steps") and a Flat list ("Errands") plus two Notes, all four independently dragged/placed on the same project canvas (screenshots taken); the step list refused to complete task 2 before task 1 and refused to un-complete task 1 before task 2, in both directions, while the flat list in the same project refused neither.
  - **Known defect closed by construction, not by patching it.** `BlockEditPopup.handleAddTask`'s lazy "create the block's one list if it has none, then add the task" path — the one with the create-then-retry race the brief described — no longer exists. Phase 3 replaces the "`lists[0]` is the list" model entirely: a task can only be added to a list the user already created via "+ Add list" (a real, already-persisted `list.id` passed into `ListCard`), so there is no code path left that lazily creates a list on the interactive add-task flow, and so no race to reintroduce. `useCreateBlock`'s quick-capture path (block + one Flat list + its tasks, all in one mutation call) is unaffected and was not the path described — a failed retry there creates a whole new Block, not a duplicate list under an existing one, so it was never exposed to this defect.
  - **Not checked:** anything against the live Supabase project (this environment has no `.env`/credentials, by design — same as every phase since 2a). RLS itself was not re-verified this phase (no schema change, `verify:rls` unchanged from 2a.2/2b.2), though every write in this phase's harness ran through the `authenticated` role with the owner UUID under genuinely enforced RLS policies, not a superuser bypass.

---

## Phase 4 — Waiting

Needs Phase 3: the task picker picks tasks, and tasks now live in Lists.

- [ ] **4.1** Waiting entries on a block, multiple at once, available on Active projects.
  - There is no separate "mark as Waiting" step and no Waiting flag. A project is Waiting exactly while it holds at least one entry — adding the first is what turns it on, deleting the last is what turns it off. This follows directly from "Entries, not one field."
- [ ] **4.2** Two entry types, chosen per entry: free-typed text, or one or more picked tasks. One entry can hold several picked tasks, and resolves only when every one of them is Done.
- [ ] **4.3** The picker offers tasks from other projects **in the same Area only** — never the project's own tasks, and never another Area's.
  - Resolved by Adam, closing what was the last open decision. Waiting now matches Connect's explicit "within the same Area — not across Areas" (6.1); the spec's silence on the point was an omission, not a deliberate contrast.
  - Consequence worth stating, since it is the reason the restriction is cheap: a pick and the task it points at always live in the same Area, so the picker's candidate query is scoped by the Area already loaded for the canvas, and no cross-Area read is needed to render a Waiting card.
- [ ] **4.4** Ready, derived on read and never stored: the project holds at least one entry, every entry is a picked-task entry holding at least one pick, and every picked task across every entry is Done. A single free-text entry anywhere on the project means Ready can never be reached automatically — free text is cleared by hand, like any note or task.
  - Both "at least one" clauses are load-bearing, and both guard against a vacuous truth rather than a hypothetical. Without the first, a project with no entries at all would read as Ready. Without the second, so would a project whose only entry lost its last pick — which is a state the database really does produce: deleting a task cascades away the pick but leaves the entry standing (verified). 3.5 has the client tidy that entry up automatically, as part of that task's own delete flow, but Ready must not depend on the tidy-up having happened.
    - *That reason changed when 4.3 was resolved, but the rule did not.* It used to rest on the task being deletable from another Area entirely; with the picker confined to one Area, that particular route is gone. The clause stays because the tidy-up is client-side and therefore not guaranteed: the delete can fail (v1 built the error banner precisely because writes do fail), the client can be stale, and a row can be removed outside the app altogether through the Supabase dashboard. Ready is derived on read, so it has to be correct against whatever the database actually holds, not against an assumption that the client got to tidy up first.
- [ ] **4.5** A project cannot leave Active — to either Upcoming or Done — while it is genuinely Waiting: holding at least one entry that hasn't reached the Ready state defined in 4.4. It must reach Ready first before a status change off Active is allowed.
  - A project holding zero Waiting entries is never Waiting in the first place (per 4.1), so this gates nothing for it — same as today.
  - This resolves what was Open decision 1 in the previous plan. It replaces that decision's default outright, rather than extending it: a project no longer leaves Active with entries hidden behind it, waiting to reappear — it simply cannot leave while genuinely blocked. What becomes of a project's (now-Ready) entries once it does leave Active is unchanged from how Waiting already behaves elsewhere; nothing here clears or hides them.
  - **Acceptance:** attempting to change status away from Active while any non-Ready Waiting entry exists is refused, with a message naming what's still outstanding; the same project becomes changeable the moment it reaches Ready.
- [ ] **4.6** The Waiting card on the block, on the Area canvas. Folded by default, showing a one-line preview and a clear expand affordance. Expanded, it lists every entry.
  - A picked task that becomes Done stays listed, struck through. It does not disappear — the card exists so that nothing is silently forgotten.
- [ ] **4.7** Waiting visual: a dimmed version of the block's normal Active colour.
- [ ] **4.8** Ready visual: a distinct badge or dot layered on top of the Waiting treatment — deliberately not another outline, because it has to be noticed rather than blend into the colour state.
- [ ] **4.9** Entry delete goes through the confirm dialog.
  - This is deleting a Waiting entry directly. A picked task being deleted at its source, in another project's list, is handled where that delete already lives — see 3.5 — and does not raise a second confirmation here.
- [ ] **4.10** Waiting is fully independent of Connect: picking a task never creates a connection, and no connection ever creates an entry.
  - **Acceptance:** a project with two entries — one free text, one holding two picked tasks — shows both when expanded; completing both picked tasks strikes them through and does not reach Ready while the free-text entry is present; deleting the free-text entry then shows Ready immediately, with no transition to trigger.

---

## Phase 5 — Focused

After Waiting, because the mutual exclusion needs something to be mutually exclusive with.

- [ ] **5.1** Focused on Active projects, any number at once.
- [ ] **5.2** Mutually exclusive with Waiting. Turning one on while the other is on is refused, and says which one has to be cleared first — the spec says "turning one on requires turning the other off first", so nothing is silently swapped or discarded on the user's behalf.
- [ ] **5.3** Marking a Focused project Done clears Focused with it.
- [ ] **5.4** Focused visual: an outline around the block.
- [ ] **5.5** The Focus screen — a dedicated view listing every currently-Focused project. Clicking one switches to its Area if it is in another, scrolls its position into view on the canvas, and opens its project popup.
  - "Every" is read as across all Areas, not just the active one; grouped by Area so the jump isn't a surprise.
  - The Area canvas's Filter (Phase 7) does not apply here — it is a different view, and a filter that could hide a Focused project from the screen built to list them would defeat it.
  - No "what's next" pointer inside a project. The step-by-step list already gives that for free, and anything beyond it is deferred.
  - **Acceptance:** three projects Focused across two Areas all appear on the screen; clicking the one in the other Area lands on that Area's canvas with its popup open; marking it Done removes it from the screen.

---

## Phase 6 — Connect

Last of the feature phases, because it is the only one whose layout has to account for how tall a block actually is — and after Phase 4 a block can carry a Waiting card.

- [ ] **6.1** Connect two blocks within the same Area — never across Areas. Direction is source → target, left to right, meaning "comes before". It is informational and gates nothing; what actually blocks a project is Waiting's job.
- [ ] **6.2** Any number of incoming and outgoing connections per block.
- [ ] **6.3** Acyclic. A connection is refused if the target already reaches the source. Enforced in the client on the create path — Postgres cannot express reachability in a check constraint, and a recursive trigger is far more machinery than a single-account sandbox warrants. The unique constraint and the self-edge check cover the two trivial cases in the database.
- [ ] **6.4** Connections render as left-to-right lines between blocks.
- [ ] **6.5** Auto-layout by connection graph. Every block with at least one connection is positioned by the shape of its component; a block with zero connections stays freely draggable exactly as today, with nothing to compute.
  - Algorithm: longest-path layering. A block's column is the longest path to it from any source in its component; columns run left to right at a uniform pitch; within a column, blocks are ordered by `created_at` so the result is deterministic and stable across reloads. Rows use a uniform pitch too — an expanded Waiting card overflows its slot rather than reflowing the graph, which is why folded is the card's default.
  - Layout writes `x`/`y` back to the same block rows. There is no second position model and no component anchor: "the algorithm owns the shape" is a rule about what is allowed to set those coordinates, not a reason to store them somewhere else.
- [ ] **6.6** Dragging any connected block moves its whole component rigidly — the same delta applied to every block reachable through any connection, all persisted together. No connected block has an independent position.
- [ ] **6.7** Adding a connection recomputes the resulting component's internal shape but never its position. When a new edge merges two components, the larger one by block count keeps its position and the smaller is pulled into the shape around it; on a tie, the upstream (source) side's position wins.
- [ ] **6.8** Removing a connection repositions nothing — a layout that satisfied a graph still satisfies it with one constraint fewer. Same when deleting a block removes several connections at once, even if that splits a component into more than two pieces. Any block left with zero connections becomes freely draggable again.
- [ ] **6.9** Removing a connection is a delete, so it goes through the confirm dialog like everything else.
  - **Acceptance:** a four-block chain lays out left to right; dragging any one of them moves all four by the same delta and changes the shape not at all; connecting a lone block to that chain leaves all four exactly where they were and places the newcomer around them; deleting a middle connection moves nothing, and the blocks orphaned by it drag freely again.

---

## Phase 7 — Filter and the content marker

Last, because it needs every kind of content to exist before "holding anything" means anything.

- [ ] **7.1** Three independent on/off toggles on the Area canvas — Active, Upcoming, Done — controlling which blocks are visible. All on by default. No Waiting/Focused toggle; Visuals carry that distinction instead.
  - Transient UI state in the Zustand store, alongside the active Area and the open popup. Not persisted, not per-Area — the spec asks for toggles, not for remembered ones.
- [ ] **7.2** Filtering is a view concern only. A hidden block's connections are hidden with it, positions are untouched, and nothing re-lays-out — hiding a block must never move the ones still on screen.
- [ ] **7.3** Content marker: a block holding at least one List or Note gets a marker distinguishing it from a block that is still just a name.
  - Tasks only exist inside Lists, so "has a list or a note" is the whole test — a task implies a list. An empty list counts, because the spec names lists themselves as content.
  - Waiting entries do not count. The spec names a task, a list and a note; Waiting already has its own card and colour.
  - **Acceptance:** toggling Done off hides every Done block and every connection touching one, and moves no remaining block by a pixel; a block with only a name carries no marker and gains one the moment a list or a note is created inside it.

---

## Open decisions

**None. All three are resolved and folded into the phases they govern**, rather than living here as defaults:

- Leaving Active while genuinely Waiting is gated in **4.5**.
- A picked task deleted by the project that owns it is handled at the point of that deletion, in **3.5**.
- Whether the task picker reaches across Areas is answered in **4.3**: it does not. Connect's same-Area restriction (6.1) now applies to Waiting too.

No phase is waiting on an answer. Per `CONTEXT.md`'s escalation criteria, a *new* open decision is not to be settled with a default — if the build turns one up, it stops and asks.

---

## Out of scope

Not built, not scaffolded for, not designed around. Carried over from v1 and untouched this round: Vision, Phase and everything on it (scrollable timeline, End Phase, Plan Next Phase, breadcrumb, "back to current"), theming, and any visual design pass — the Visuals in Phase 4, 5 and 7 are functional state markers, not an aesthetic pass.

Deferred this round, each for a stated reason rather than by default: task-level Waiting; shared tasks between blocks; "Today" as a working set separate from Active/Focused; an explicit "next step" pointer beyond what a step-by-step list already gives; projects-within-projects, zoom/pan, and fullscreen/tab mode for the project popup; an Upcoming-level equivalent of Waiting; and Goal #3 from the original feedback with its residual OneNote overlap.

No schema columns, abstraction layers, or component seams exist in anticipation of any of it. A fuller version of this product exists outside this repo, deliberately — it shaped nothing here and should shape nothing in the build. When one of these is actually wanted, it gets built then, against what real use of v2 has shown.
