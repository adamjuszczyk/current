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
  - **Acceptance verified 2026-09-10** in a headless browser against a temporary in-memory mock of the Supabase client (written over `src/lib/supabase.ts`, restored before committing, same pattern as every v1 phase): a note and a task each filled with three long paragraphs grew from a single-line 28-32px box to ~270-350px, `scrollHeight` matched `clientHeight` (no inner scrollbar, `overflow-y: hidden`) and every line was visible in a screenshot with nothing clipped; clearing the content back out returned both boxes to their original single-line height. The "Add a task" field grows the same way, and switching it to a textarea means Enter now inserts a newline instead of submitting — confirmed a newline typed mid-entry stayed in the field until the Add button was clicked, after which the field emptied and shrank back down.
  - **Fix chunk, 2026-09-11 — two defects closed, see CONTEXT.md's Phase 1 build-log entry for the full measurements.** (a) `AutoGrowTextarea` was short by its border width on any bordered instance (`box-sizing: border-box` makes `style.height` set the border box while `scrollHeight` describes the content box) — invisible on the borderless Note field, real on the bordered task fields in `BlockEditPopup`. Fixed by adding `offsetHeight - clientHeight` back onto the written height. Measured before the fix on a bordered task field: `clientHeight 438`, `scrollHeight 440`, `scrollTopMax 2`; after: `clientHeight === scrollHeight`, `scrollTopMax 0`. (b) In "Add a task" only, Enter now submits the form (adds the task) again and Shift+Enter inserts a newline — restoring v1's verified Enter-adds behaviour without giving up multi-line entry. `TaskRow`'s inline edit field is unchanged: Enter still inserts a newline there, and it still commits on blur.

The spec names Task text and Note text specifically. Nothing else — Area names, Block names, List titles — is a multi-line field, so nothing else changes.

---

## Phase 2a — Schema and data migration, written and proven

Everything from here on depends on this shipping correctly. Per `CONTEXT.md`'s escalation criteria, a schema change is always Adam's, and this one is stronger than v1's: it rewrites rows that exist and are in real use. This chunk writes the migration and proves it against a scratch database — it does not touch the live project. That's Phase 2b, on its own, gated on a backup.

- [ ] **2a.1** `supabase/migrations/0002_v2.sql`, exactly the delta in Data model above, in order: the new tables and changed columns, then the v1 → v2 data migration itself — before `tasks.block_id` is dropped, every block that has tasks gets one untitled Flat list holding them, placed at a fixed origin on its project canvas, and a block with no tasks gets no list. Runs once; it is not idempotent and does not need to be.
  - **Acceptance:** dry-run verified fresh, at build time, against a scratch database seeded with representative v1 data — not by citing the planning session's earlier run of the same SQL, since the file may have changed since. Every task that existed before still exists, still under the same block, in a Flat list; a block with no tasks correctly gets no list.
- [ ] **2a.2** RLS on all four new tables, pinned to the same owner UUID as `0001_init.sql` — same policy shape, same reason.
  - **Acceptance:** `npm run verify:rls`, extended to cover `lists`, `connections`, `waiting_entries` and `waiting_entry_tasks`, passes for all eight tables against the scratch database: no rows returned with no session, every write refused with a PostgREST error code.
- [ ] **2a.3** Client changes to keep v1's surface working unchanged on the new shape: `src/types.ts`, `useTasks` keyed by list rather than block, notes hooks handling either parent, and `BlockEditPopup` reading its block's list. Quick-capture in `BlockCreatePopup` writes its lines into one untitled Flat list — the same thing 2a.1's data migration does to existing data, so the two paths agree.
  - This is a stepping stone, not throwaway: Phase 3 generalises it to many lists of both kinds rather than replacing it.
  - **Acceptance:** every v1 flow still works against the scratch database on the new shape — create/rename/delete an Area, a Block, a Task, a Note, and the block popup's full task CRUD.

---

## Phase 2b — Apply the migration to the live database

The one irreversible action in the whole build. It is its own chunk, separate from 2a, specifically because of that: everything in 2a can be redone if it turns out wrong; this can't.

- [ ] **2b.1** Take a live backup from the Supabase dashboard.
  - V1's migration ran against an empty database and had nothing to lose; this one rewrites rows in real daily use.
- [ ] **2b.2** Run `0002_v2.sql`, as verified fresh in 2a.1, against the live project. Does not start until 2b.1's backup is confirmed to exist — confirmed immediately before running, not merely at some point since the phase began.
  - **Acceptance:** the same check as 2a.1's dry run, now against the real data — every task that existed before still exists, still under the same block, in a Flat list. `npm run verify:rls` passes against the live project for all eight tables.

---

## Phase 3 — Project canvas

What a Block contains, replaced. The largest change in v2, and everything after it depends on tasks living in Lists.

- [ ] **3.1** The block popup is resizable, like a normal window. No fullscreen mode, no separate tab — both deferred.
  - The size is live, not remembered: the spec asks for resizable, not for a remembered size, and remembering it would need a column. Session-only, no schema.
- [ ] **3.2** Inside the popup, a freeform canvas — the same placement model as Blocks on an Area, one level down. Lists and Notes render at their stored `x`/`y` and are draggable. No zoom, no pan.
- [ ] **3.3** Create a List: kind chosen at creation, Step-by-step or Flat, plus an optional title line. Kind is fixed afterwards.
- [ ] **3.4** Full CRUD on tasks within a list — add, edit inline, toggle complete, delete. Task delete goes through the confirm dialog, as in v1.
- [ ] **3.5** Deleting a task first checks whether any Waiting entry, on any project, holds it as a pick. If one does, the confirm dialog names the waiting project in its message, alongside the ordinary delete warning. Once confirmed, the pick is removed and, if it was that entry's last pick, the entry is removed with it — automatically, with no second confirmation; the warning already shown is what stands in for one.
  - Built here because this is where a task's own delete lives, and cross-referenced from Phase 4 (4.9) because it's Waiting entries this affects. The check has nothing to find until Phase 4 adds entries — the tables exist from 2a.1, but nothing can populate them before then — so this item is inert on its own build and becomes live the moment Phase 4 ships. Nothing about it needs revisiting when that happens.
  - This is the build for Open decision 2 from the previous plan, now resolved rather than defaulted: the pick disappearing was already what the database's cascade did on its own; what's new is the dialog naming the waiting project before it happens, so the loss is disclosed instead of merely tidied up after the fact.
  - **Acceptance:** deleting a task that something waits on shows the warning naming the waiting project; confirming removes the pick, and if it was the last one, removes the entry too, with nothing further to confirm.
- [ ] **3.6** Step-by-step enforcement: a task cannot be marked complete until the one before it is. Order is creation order; there is no reorder affordance, because the spec's CRUD list doesn't have one.
  - Un-completing is gated the same way, from the other end: only the last completed task can be un-completed. That is what keeps completed tasks a contiguous prefix, which is what "strictly ordered" means. The alternative — gate only completion — allows task 1 incomplete while task 2 is complete, which is the exact state the rule exists to prevent.
  - A Flat list gates nothing: any task, any order, any time.
- [ ] **3.7** Notes on the project canvas, behaving exactly as Area notes do — created empty and focused, discarded automatically if never given real content, explicit confirm-gated delete once it has content. Same component, different parent.
- [ ] **3.8** List delete goes through the confirm dialog and takes its tasks with it (cascade).
  - **Acceptance:** one project holds several lists of both kinds and several notes, each placed freely and independently draggable; a step-by-step list refuses to complete its second task while the first is incomplete, and a flat list in the same project refuses nothing.

---

## Phase 4 — Waiting

Needs Phase 3: the task picker picks tasks, and tasks now live in Lists.

- [ ] **4.1** Waiting entries on a block, multiple at once, available on Active projects.
  - There is no separate "mark as Waiting" step and no Waiting flag. A project is Waiting exactly while it holds at least one entry — adding the first is what turns it on, deleting the last is what turns it off. This follows directly from "Entries, not one field."
- [ ] **4.2** Two entry types, chosen per entry: free-typed text, or one or more picked tasks. One entry can hold several picked tasks, and resolves only when every one of them is Done.
- [ ] **4.3** The picker never offers the project's own tasks. See Open decision 1 for which other projects it does offer.
- [ ] **4.4** Ready, derived on read and never stored: the project holds at least one entry, every entry is a picked-task entry holding at least one pick, and every picked task across every entry is Done. A single free-text entry anywhere on the project means Ready can never be reached automatically — free text is cleared by hand, like any note or task.
  - Both "at least one" clauses are load-bearing, and both guard against a vacuous truth rather than a hypothetical. Without the first, a project with no entries at all would read as Ready. Without the second, so would a project whose only entry lost its last pick — which is a state the database really does produce: deleting a task cascades away the pick but leaves the entry standing (verified). 3.5 has the client tidy that entry up automatically, as part of that task's own delete flow, but Ready must not depend on the tidy-up having happened, since the task can be deleted from another Area entirely.
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

One, narrow, not blocking — it has a working default so the build can proceed if the answer comes late. The other two from the planning session are now resolved and folded into the phases they belong to rather than living here: leaving Active while genuinely Waiting is gated in 4.5, and a picked task being deleted from the project that owns it is handled at the point of that deletion in 3.5.

1. **Whether the task picker reaches across Areas.** Connect says "within the same Area — not across Areas" explicitly. Waiting says only "other projects" and does not restrict it.
   *Default taken:* the plain reading — any other project in any Area. Flagged because the contrast may be deliberate or may be an omission, and it is a one-word answer either way.

---

## Out of scope

Not built, not scaffolded for, not designed around. Carried over from v1 and untouched this round: Vision, Phase and everything on it (scrollable timeline, End Phase, Plan Next Phase, breadcrumb, "back to current"), theming, and any visual design pass — the Visuals in Phase 4, 5 and 7 are functional state markers, not an aesthetic pass.

Deferred this round, each for a stated reason rather than by default: task-level Waiting; shared tasks between blocks; "Today" as a working set separate from Active/Focused; an explicit "next step" pointer beyond what a step-by-step list already gives; projects-within-projects, zoom/pan, and fullscreen/tab mode for the project popup; an Upcoming-level equivalent of Waiting; and Goal #3 from the original feedback with its residual OneNote overlap.

No schema columns, abstraction layers, or component seams exist in anticipation of any of it. A fuller version of this product exists outside this repo, deliberately — it shaped nothing here and should shape nothing in the build. When one of these is actually wanted, it gets built then, against what real use of v2 has shown.
