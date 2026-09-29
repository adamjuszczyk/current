# DECISIONS.md — Current

Decisions Adam made in earlier builds that still constrain the code. Each entry is answered: what was decided, and the answer. Decisions that have since been overtaken, or whose effect is finished, are not kept here (the story is in `HISTORY.md`). A new question that isn't settled by an entry here or by the spec is not settled with a default — it stops the build and is asked.

Every entry here is **answered**. There are no blocking (unanswered) entries.

---

## D1 — Who can read and write rows (2026-09-08)

**Decided:** how to close the hole where any self-registered user could read and write every table.
**Answer:** pin every RLS policy to the owner's UID *and* disable email signups in the Supabase dashboard — both layers, without adding `user_id` columns.
**Constrains:** every table, including any new one, gets a `for all` policy with `using` and `with check` comparing `auth.uid()` directly to the owner UUID. No `user_id` column. Signups stay disabled. `verify:rls` must cover the table.

## D2 — Baseline error handling needs no sign-off (2026-09-09)

**Decided:** whether the two spec gaps (silent failed writes; a failed load looking like an empty account) needed Adam's approval, and what the default should be.
**Answer:** no — baseline behaviour doesn't need his sign-off. Failed writes surface in a dismissible banner naming the real cause; loading, failed and genuinely empty are three separate states, so "No areas yet" only ever means zero areas exist.
**Constrains:** new mutations and queries get this for free through the `MutationCache` and must not swallow errors; new list views need all three states.

## D3 — A project cannot leave Active while genuinely Waiting (2026-09-10)

**Decided:** what happens when a project tries to leave Active (to Upcoming or Done) while it has Waiting entries.
**Answer:** a hard gate. Any Waiting entry that isn't Ready blocks the change until the project reaches Ready. This replaced an earlier default (clear Focused on any exit; keep entries but hide them).
**Constrains:** the status-change path refuses with the reason (`describeOutstanding()`); nothing is auto-cleared or hidden.

## D4 — Deleting a task that something is Waiting on (2026-09-10)

**Decided:** what happens to a Waiting entry's pick when the task it points at is deleted.
**Answer:** the pick goes with the task, and an entry that loses its last pick goes with it. The task-delete confirm dialog checks first and names the waiting project, so the loss is disclosed. No second confirmation. Deleting a Waiting entry directly is a separate confirm-gated path.
**Constrains:** `findWaitingHolds` checks every project's entries, not just the current Area's; Ready is computed on read and does not rely on the tidy-up having happened.

## D5 — The Waiting task-picker stays in one Area (2026-09-10)

**Decided:** whether the Waiting picker offers tasks from other Areas.
**Answer:** no. It offers tasks from *other projects in the same Area only* — never the project's own, never another Area's. This matches Connect's explicit same-Area restriction; the spec's silence was an omission.
**Constrains:** the picker query is scoped by Area; a pick and its task always share an Area.

## D6 — Enter in "Add a task" (2026-09-11)

**Decided:** what Enter does once task text fields became auto-growing textareas.
**Answer:** in the "Add a task" field only, Enter adds the task and Shift+Enter inserts a newline. A task's inline edit field is unchanged: Enter inserts a newline and blur commits. Block and Area name fields keep Enter-blurs / Enter-submits.
**Constrains:** `ListCard`'s add field and any equivalent capture field.

## D7 — Migrations auto-apply on merge to main, and the merge is Adam's (2026-09-11)

**Decided:** whether to keep the Supabase GitHub integration applying `supabase/migrations/*.sql` on push to `main`, after it applied `0002` before its backup gate.
**Answer:** keep it. Automatic apply is wanted; the process moves to fit it. A migration file reaches `main` only after it is proven against a scratch database *and* Adam says go — one sentence from him, but the merge is his. Everything that isn't a migration merges freely. No builder session ever creates a file in `supabase/migrations/`; a chunk that seems to need one stops and asks.
**Constrains:** all sessions; `scripts/check-migration.mjs` exists to flag branches whose migrations aren't provably data-safe.

## D8 — The v1 snapshot lives in the database, outside PostgREST (2026-09-11)

**Decided:** how to back up live v1 data before v2's migration rewrote task ownership, given Adam believed backups required paying.
**Answer:** the premise was wrong (a manual `pg_dump` is free), and given the real options Adam chose an in-database snapshot — the `v1_backup` schema, created by `0003_v1_backup_snapshot.sql`.
**Constrains:** `v1_backup` must never be moved into an exposed schema or granted to `anon`/`authenticated`. It is not a backup of the database itself; `pg_dump` remains the only restore point that survives losing the project.

## D9 — Connect's layout is incremental placement (2026-09-11)

**Decided:** how to resolve `TASKS.md` 6.5 (a block's column is its longest path) contradicting 6.8 (deleting a connection repositions nothing).
**Answer:** accept the implemented behaviour and correct 6.5's wording. Layout is incremental placement: a merge never moves the larger component, the smaller is rigidly translated beside the new edge, an edge inside one component shifts only its target's downstream closure by the minimum needed, and deleting a connection moves nothing. A column is not always longest-path depth, and build order can change the arrangement; no edge ever points target-left-of-source.
**Constrains:** `src/lib/layout.ts`; don't add a global recompute that can move unrelated blocks.

## D10 — What the v2 sandbox does and doesn't contain

**Decided:** the scope of the sandbox build (from `CURRENT-V2-SANDBOX-SPEC.md`).
**Answer:** carried forward from v1 unchanged — Areas, single-account auth with RLS, confirmation on every delete, Area-level free Notes, one kind of Block, three manual statuses. Not built: Vision, Phase and everything on it, theming, any visual design pass, task-level Waiting, shared tasks between blocks, "Today", an explicit next-step pointer, projects-within-projects, zoom/pan, fullscreen/tab mode. No ordering or `position` column, no `waiting` column.
**Constrains:** anything on the not-built list is a scope change — escalate, don't build.
