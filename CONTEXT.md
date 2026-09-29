# CONTEXT.md — Current

Current state only. Finished work, build logs and superseded plans live in `HISTORY.md`; decisions that still constrain the code (answered, plus any blocking or deferred entry, in the format at the top of that file) live in `DECISIONS.md`. Ceiling: 75 KB, checked by `node scripts/check-context-size.mjs` — when over, move what is no longer true into `HISTORY.md`, don't raise it.

## What this is

Current — a personal project/direction-tracking app for one user (Adam). V1 shipped and has been in daily use; v2, specced from that use, is built. Stack in use: React 19, TypeScript, Vite, Tailwind v4 (defaults only, no config file), Supabase, TanStack Query, Zustand, oxlint.

A fuller v2+/vision-scale version of this product exists, but is kept outside this repo on purpose, so it can't shape the build. It is not present here — don't look for it, don't reconstruct it, and its absence is not a gap to flag or escalate. Everything the current build needs is in `CURRENT-V2-SANDBOX-SPEC.md`.

## Where the build is

- **V1 — complete, live since 2026-09-09.** All 26 items in `TASKS-V1.md` done; acceptance met against the live project. `CURRENT-V1-SANDBOX-SPEC.md` and `TASKS-V1.md` are the record of what v1 was built to; the v2 spec supersedes the v1 spec entirely.
- **V2 sandbox — complete and reviewed, closed 2026-09-11.** All 43 items across `TASKS.md`'s eight chunks (1, 2a, 2b, 3, 4, 5, 6, 7) are ticked, each with an acceptance note. Spec: `CURRENT-V2-SANDBOX-SPEC.md`. Still a sandbox with no visual design pass.
- **Live database:** `0001`, `0002`, `0003` applied. `npm run verify:rls` passes against the live project on all eight tables. `v1_backup.tasks` holds 20 rows (confirmed by Adam) and is unreachable from the anon key (confirmed from outside: `PGRST106`).
- **`main`** carries the completed build (fast-forwarded 2026-09-12). Later additions on `main`: the migration-guard scripts and `scripts/check-context-size.mjs`.
- **Open decisions: none.** No build is in progress. The next step is v3's spec (it will be `SPEC.md`), or more daily use — v2 exists because using v1 produced its spec.
- **Not built, by design (out of scope for v2):** Vision, Phase and everything on it, theming, any visual design pass, task-level Waiting, shared tasks between blocks, "Today", an explicit next-step pointer, projects-within-projects, zoom/pan, fullscreen/tab mode. A *new* open decision is not settled with a default — stop and ask.
- **Not installed:** Dexie, vite-plugin-pwa, Recharts — nothing in either spec needs offline storage, installability or charts.

## What exists

Areas and shell
- **Auth:** `LoginScreen` (email + password, `signInWithPassword`, no sign-up form); `App` gates on `getSession`/`onAuthStateChange`. One account, created out of band; email signups disabled in the dashboard.
- **Areas:** tab row ordered by `created_at`; "+" creates, double-click edits (rename, confirm-gated delete). Delete removes only the `areas` row — everything under it goes by `on delete cascade`. The active tab falls back to the first remaining Area, but only after a *successful* load.
- **Popup shell:** `Popup` renders through a portal over a backdrop, moves focus in, closes on Escape only for the topmost popup (module-level stack), and closes on the backdrop only when mousedown and mouseup both land on it. Optional `contentClassName`/`contentStyle`.
- **Confirm dialog:** `useConfirm()` returns an awaitable `(message) => Promise<boolean>`; every delete path in the app awaits it. One pending confirmation at a time.
- **Failure handling:** every mutation failure is reported by the `MutationCache` into `ErrorBanner` (red, dismissible, one row per distinct message, never auto-hides); `errorMessage.ts` handles Supabase's plain-object errors; `settled.ts` wraps `mutateAsync` awaits. Loading, failed and genuinely empty are three separate states (also for blocks, notes, connections on the canvas). A popup whose write fails stays open with its input intact.
- **Client state:** Zustand `uiStore` holds transient UI state only — `activeAreaId`, open popup and its context, `activeView` (`canvas` | `focus`), `scrollToBlockId`, `connectMode`/`connectSourceId`, `visibleStatuses`. Nothing persisted; all server data lives in TanStack Query.

Area canvas
- **Canvas:** freeform, native scroll, no zoom or pan. Blocks and Notes are absolutely positioned at stored `x`/`y`. "+ Add block" and "+ Note" place at the current viewport centre (a one-time coordinate, not an arrangement rule); nothing moves a block after creation except the user's drag and Connect's layout.
- **Block:** `BlockCard` drags by pointer events with capture, no library; a pointer-up under 4 px is a click, two within 400 ms open `BlockEditPopup` (hand-rolled, not native `dblclick`); `x`/`y` are written only when they changed. Status (`upcoming` / `active` / `done`) is set only by explicit buttons — never inferred from tasks.
- **Block visuals:** Active full blue; Done and Upcoming the same dimmed grey (no CSS filter), Upcoming adds a yellow dot top-right; Waiting dims the Active colour and shows a folded Waiting card; Ready is a badge bottom-right; Focused is a real CSS purple outline; the content marker is a dark dot top-left. Positions differ on purpose so several can show at once.
- **Block create:** `BlockCreatePopup` — a name and a quick-capture textarea; each non-empty line becomes a Task in one new Flat list at (24, 24); empty capture creates no list.
- **Notes (Area or project):** `NoteCard` drags by its header strip only. Created empty and focused with no popup; content saves on blur and auto-grows. A note that never held content is silently discarded on blur; a note whose content was cleared survives and needs the confirm-gated Delete. "Ever held content" lives only in client state (`hadContentRef`). The `NoteParent` union (`{areaId}` | `{blockId}`) lets the same component and hooks serve both levels.
- **Expanding text:** `AutoGrowTextarea` sizes to content in both directions, includes the border width, and is used for Note text and every task text field. Area names, Block names and the quick-capture bulk field are plain inputs.
- **Filter:** three independent Active/Upcoming/Done checkboxes, all on by default, transient, not per-Area. It filters what renders; a connection touching a hidden block is hidden because `ConnectionLines` skips missing endpoints. It never writes `x`/`y` and never touches component membership — dragging a visible connected block still moves its hidden partner.
- **Content marker:** a block holding at least one List or Note gets the top-left dot (an empty list counts; a Waiting entry alone does not).

Project canvas (the block popup)
- **`BlockEditPopup`:** a resizable window (native CSS `resize: both`; starts 640×520, floor 380×320, ceiling 95vw/90vh; size not remembered). Header: name (commits on blur/Enter, popup stays open), status buttons, Focus toggle, "+ Add list", "+ Note", "+ Waiting entry", "Delete block" (confirm names its lists and notes). Body: a freeform canvas of `ListCard`s and `NoteCard`s at stored positions, same placement model as the Area canvas, one level down.
- **Lists:** `ListCreatePopup` picks kind (Step-by-step or Flat, Flat default) and an optional title, once. There is no update path for `kind` or `title` anywhere, so kind is fixed by construction. `ListCard` drags by its header; delete is confirm-gated and removes only the `lists` row (tasks cascade).
- **Tasks:** full CRUD inside a List (add, inline edit, complete toggle, delete). Order is `created_at` — no ordering column exists; two tasks inserted in one statement tie by design. In "Add a task", Enter adds and Shift+Enter inserts a newline; in a task's inline edit, Enter inserts a newline and blur commits.
- **Step-by-step gating:** a task can be completed only when the previous one is done, and un-completed only when no later one is done, so completed tasks are always a contiguous prefix. Enforced with the checkbox's `disabled` attribute (with an explanatory `title`). A Flat list gates nothing.
- **Deleting a task** first calls `findWaitingHolds`; if any Waiting entry on any project picks it, the confirm names the waiting project. On confirm the task goes (its picks cascade), then `removeEmptiedWaitingEntries` deletes any entry that lost its last pick. No second confirmation.

Waiting, Focused, Connect
- **Waiting:** a project is Waiting exactly while it holds at least one entry; there is no `waiting` column. An entry is free text, or one or more picked tasks (picker offers tasks from *other projects in the same Area only*, scoped in the query). **Ready** is derived on read, never stored: at least one entry, every entry a picked-task entry holding at least one pick, every picked task Done — one free-text entry means Ready is never reached automatically. A project cannot leave Active (to Upcoming or Done) while it has an entry that isn't Ready; the refusal names the outstanding entry and gates on `describeOutstanding()` being non-empty. Entry delete is confirm-gated. Waiting and Connect are fully independent.
- **Focused:** `blocks.focused`, toggled in `BlockEditPopup` on Active projects; mutually exclusive with Waiting in both directions (each refusal names the other state; nothing is swapped on the user's behalf); marking a Focused project Done clears Focused in the same write. `FocusScreen` (header button "Focus screen") lists every Focused project across every Area grouped by Area; clicking one switches Area, opens the popup and scrolls the block into view. It is not coupled to Filter.
- **Connect:** click-to-connect toggle on the Area canvas joins two blocks in the same Area; a directed edge draws as a line with an arrowhead (`ConnectionLines`, behind the cards; click the line to delete, confirm-gated). Acyclicity, self-edge and duplicate refusals run client-side *before* any write (`checkConnection` / `wouldCreateCycle`) — Postgres accepts both `A→B` and `B→A`. Layout (`src/lib/layout.ts`, pure, no React or Supabase) is incremental placement, not maintained longest-path layering: a merge never moves the larger component (ties to the source side), the smaller is rigidly translated one 220 px column beside the new edge; an edge inside one component shifts only its target's downstream closure by the minimum needed. Dragging any connected block moves its whole component rigidly by the identical delta in one batched write (`useUpdateBlockPositions`). Deleting a connection repositions nothing. Edges run left-to-right, never target-left-of-source.

Data and scripts
- **Schema** (`supabase/migrations/`): `0001_init.sql` — `areas`, `blocks`, `tasks`, `notes` with RLS; `0002_v2.sql` — `lists` (kind `step`|`flat`, x/y), `tasks.list_id` (`NOT NULL`, replaced `tasks.block_id`), `notes.block_id` with `notes_one_parent`, `blocks.focused`, `connections` (no self-edge, unique pair, cascading FKs), `waiting_entries` (kind `text`|`tasks`), `waiting_entry_tasks` (`task_id` cascades) with RLS on the four new tables; `0003_v1_backup_snapshot.sql` — the `v1_backup` schema. No `user_id`, no `position`, no `waiting` column anywhere. Applied migrations are historical records: don't edit them.
- **RLS:** all eight public tables have one `for all` policy with `using` and `with check` comparing `auth.uid()` to the owner UUID written in the migration files — the owner, not "any signed-in user". `v1_backup` sits outside PostgREST's exposed schemas with an explicit `revoke`.
- **`scripts/verify-rls.mjs`** (`npm run verify:rls`): probes all eight tables with the anon key and no session — no rows back, every write refused with a PostgREST error code — and that signup is refused. Three-valued: anything not carrying a real refusal code is `UNREACHABLE` and exits 2, meaning nothing was proved.
- **`scripts/check-context-size.mjs`:** fails if `CONTEXT.md` exceeds 75 KB.
- **`scripts/check-migration.mjs` + `migration-rules.mjs` (+ `.test.mjs`):** classifies the migrations on a branch against an allow-list of changes that cannot alter or remove existing data; anything unrecognised is flagged. Exit 0 = nothing to flag, 1 = flagged, 2 = couldn't check (treat as 1). Its header says a flagged branch is not merged and gets a blocking `DECISIONS.md` entry, the merge being Adam's.

## Repo facts

- **Supabase deploys migrations from main: yes.** The Supabase GitHub integration applies `supabase/migrations/*.sql` when they reach `main`; it records them in `supabase_migrations.schema_migrations` and skips a version already recorded. A push or merge of a migration file to `main` *is* a production deploy.
- Repo `adamjuszczyk/current`; default branch `main`. Build branches were deleted after consolidation.
- Supabase project ref `ieszecmiijxkcrxirwuk` — fresh and dedicated; no shared backend or cross-app data access with Overload. The anon key ships publicly in the client bundle by design; RLS is the protection.
- Commands: `npm run dev`, `npm run build` (`tsc -b && vite build`), `npm run lint` (oxlint), `npm run verify:rls`. Real-client build is about 488 kB; a build with no `.env` is about 201 kB.
- `.env` is gitignored, `.env.example` is committed empty; `src/lib/supabase.ts` throws if the vars are unset. A fresh container has no `.env`.
- In this container Node 22 does not read `HTTPS_PROXY` for `fetch`: run `NODE_USE_ENV_PROXY=1 npm run verify:rls`. Playwright uses the pre-installed Chromium via `executablePath`, never `playwright install`.
- Files at the repo root: `CONTEXT.md`, `HISTORY.md`, `DECISIONS.md`, `TASKS.md` (v2 plan, all ticked), `TASKS-V1.md`, `CURRENT-V1-SANDBOX-SPEC.md`, `CURRENT-V2-SANDBOX-SPEC.md`.
- Sandbox conventions still in force: Tailwind defaults only, Zustand for transient UI state only, no drag-and-drop library, no new dependency without asking.

## Escalation criteria

Always escalate:

* Anything touching the database schema or a migration. Any migration scripts/check-migration flags. Every destructive one is flagged.
* Anything not explicitly decided in spec or TASKS.md — no guessing at product intent. If something looks like it needs a new open decision beyond the three already resolved, stop and ask rather than picking a default.
* Anything touching auth. Current has its own dedicated Supabase project — no shared-project data boundary to worry about the way Overload's incident did.
* Diagnostic or live SQL queries run through the Supabase SQL Editor bypass RLS entirely — that's a property of the SQL Editor itself, confirmed on Overload, not something specific to Overload's schema. Current has no per-row user_id to filter by (RLS here is pinned directly to auth.uid()), so there's no WHERE-clause equivalent of Overload's rule. Prefer the authenticated client over the SQL Editor for diagnostic reads where that's an option. If the SQL Editor is used anyway and returns more than one account's data, that's still a bug — stop immediately, don't investigate further.
* The builder deleting or overwriting existing data or files unexpectedly during the build — not the app's own confirmed delete features, which are already fully specced.
* A test failure without an obvious, mechanical fix.
* Anything that would change scope, cost, or timeline versus TASKS.md. Any change beyond the chunk's stated scope in TASKS.md.
* Anything SPEC.md is ambiguous or silent about.

Proceed without asking:

* Lint/type fixes, typos, formatting.
* Adding tests for already-specified behavior.
* Following a pattern already established elsewhere in the codebase.
* Anything TASKS.md's acceptance criteria already cover, including the two resolved decisions now patched into the file.

Note, unchanged from v1 and worth keeping verbatim: for schema and auth, "already decided" means the decision doesn't need relitigating — not that the implementation skips a look. Bring the actual diff every time. This is exactly how v1's RLS bug got caught.

## Reviewer's own rules

The reviewer watches a build chunk by chunk. These bind the reviewer, not only the builders.

- Verify against the real thing. A passing check proves only what it actually touched. If unreachable and passing produce the same signal, the check is wrong.
- Never fix before understanding the cause.
- Don't read code to check what a script can check. If no script covers it yet, write one — or verify manually and say that's what happened.
- Scripts check what they can. Schema and auth changes are read as a diff, and the diff goes into the escalation.
- Commit verification scripts to scripts/ and run all of them at every chunk boundary, not just this chunk's.
- Escalate with full reasoning, not a verdict and options.
- Never write an unconfirmed belief into this file as fact.
- The shared scripts (check-migration, migration-rules, check-context-size) are never changed during a build. If a chunk changes one, revert that change before merging and say so in the chunk report.
- At every chunk boundary: update this file, move anything no longer true into HISTORY.md, then compact. Rules discovered during this build are never pruned — they don't stop being true.

## Checks that lied

A check that returns a plausible value is indistinguishable from one that works. Each of these reported success, or a defect, wrongly.

- **`verify:rls` counted every error as a refusal.** It printed "RLS verification passed" while an egress allowlist blocked the host and not one request left the container. Now three-valued (real PostgREST error code, or a 4xx from the auth layer, else `UNREACHABLE`, exit 2). Its signup probe had the same flaw and was fixed the same way.
- **`verify:rls` only ever probed "no session".** That is why Phase 0's `using (auth.uid() is not null)` — any signed-in user — passed it and had to be caught by reading the policy. Local RLS probes now use three identities: no session, a stranger uid, and the owner (a UUID matching no user denies everyone and would also mean a dead app).
- **`npm run build` with no `.env`** folds the env vars to `undefined`, `supabase.ts` throws, and the minifier tree-shakes the whole Supabase client out (~201 kB vs ~462–488 kB). Those builds proved the TypeScript compiled, never that the app bundles with a real client.
- **A green build, lint and summary with a broken feature:** the `upcoming` marker rendered grey because a parent `grayscale` filter desaturated it, making Upcoming identical to Done. Only a screenshot showed it.
- **"`scrollHeight` matched `clientHeight`"** was true of the borderless Note field and false of the bordered task fields; `scrollTopMax` of exactly 2 (the two borders) was found only by measuring. The fix builder's 13 passing checks were re-run rather than believed.
- **A ticked checkbox** (`0.3` in the old plan) while its acceptance criterion was unverifiable in that environment. A checkbox alone reads as done; the prose beneath it said otherwise.
- **`psql` as `postgres` is a superuser and bypasses RLS**, so an RLS probe without `set local role` proves nothing. The Supabase SQL Editor bypasses RLS the same way.
- **`verify:rls` extended to all eight tables in 2a, but never run** — no PostgREST or GoTrue was reachable; SQL probes stood in and said so.
- **Reviewer harness bugs that produced confident, false defect reports:** the PostgREST bridge silently dropped `neq.` filters (the picker appeared to leak the project's own task) and `columns=`; it quoted the `*` in `select('*, areas(name)')` into a column called `"*"`; and its embed alias `x` collided with `blocks.x`, so a working Focus screen rendered empty. A dropped filter is a check that silently proves nothing.
- **Vacuous passes:** "the forbidden task is absent" against a picker that defaulted to Free-text and listed nothing; "both Areas appear" matching the header tabs instead of the Focus screen's groupings.
- **A combined query reported "completed tasks: 20"** of 20 — the `where completed` clause was lost in merging two scripts, so it was the row count again. Caught by the number being implausible.
- **The brief twice named the diamond** (`A→B, A→C, B→D, C→D`) as the case separating longest-path from shortest-path layering. Both paths to D are length 2; the algorithms agree. The skip edge (`A→B, B→C, A→C`) is the case that separates them.
- **A reconstruction assumed Adam had run the migration** because that made the evidence fit, and wrote it up as established. The evidence fit an automated apply equally; `supabase_migrations.schema_migrations` distinguished them.
- **"The migration was on `main` so it must have applied"** was the reasoning that went wrong on 2026-09-11; the snapshot's *existence* is unverifiable with the anon key and was confirmed only when Adam ran `select count(*) from v1_backup.tasks;` (20).
- **False failures, the other direction (test bugs, not app bugs):** `text=` locators don't match a controlled `<textarea>`'s value (use the checkbox's `aria-label`); a Note landed on a "Delete list" button at the harness's viewport-centred placement (use `dispatchEvent('click')`); the fixed error banner intercepted clicks on the tabs beneath it; three blocks created back-to-back spawn at the same centre and stack (reposition by SQL and reload); click points must be computed from stored `x`/`y` plus the app's own offsets, not the rendered card's centre; two tasks inserted in one statement share a `created_at`.

## Rules discovered during this build

Reviewer conduct (moved here from "Reviewer's own rules"; none is covered by that block)
- Chunks are `TASKS.md`'s phases in order, one phase per builder session, no combining or splitting (v2's Phase 2 was split into 2a and 2b on the reversible/irreversible line).
- On each builder going idle: read the summary, check it against the escalation criteria, then either start the next chunk or hand the decision to Adam and wait.
- Read the diff, not the summary. For schema and auth, bring the actual diff every time, even when the decision is already made.
- Verify independently, not on the report: re-run a builder's checks, run `build`/`lint`, drive the feature in a browser and *look* at it. Every builder has reported a clean verification at least once while shipping something real.
- Ordinary correctness in a shared primitive is the reviewer's to fix (as with the popup and `AutoGrowTextarea` defects). A new product-intent question is not — escalate it, even when the builder decided it didn't qualify.
- An irreversible step never starts on the reviewer's say-so. It needs Adam's confirmation immediately before it runs, not merely at some point since the phase began.
- The reviewer's own actions are in scope for the criteria. Before any push to `main`, check that the migration files are byte-identical between the branch and `main` (empty diff) — or, if they differ, that the change passed `check-migration` or has Adam's go.
- Start every builder with an explicit `source_revision`; a default branch can hold app code without the plan, or the plan without app code.
- Tell every builder: never add a file to `supabase/migrations/`; commit and push as soon as the feature compiles; finishing the chunk includes ticking `TASKS.md` and updating `CONTEXT.md`.
- When two clauses of the plan can't both be true, demonstrate it and escalate — don't pick a reading. The plan being wrong (not the code) happened twice and both were the build's highest-value catches.
- Record what a limitation is when you hit one (e.g. no way to message a running builder) instead of routing around it; don't use `interrupt_session` when there is no way to follow it with an instruction.
- Record checks that gave a false result, in the section below, whoever's they were.

Deploy and migrations
- **No session may ever create a file in `supabase/migrations/`.** A migration file reaching `main` deploys to production by itself. If a chunk seems to need one, stop and ask.
- **Merging to `main` is the deploy, so the gate is the merge.** A migration file reaches `main` only after it is proven against a scratch database *and* Adam says go; the merge is his. Everything that isn't a migration merges freely.
- **Not holding DDL credentials is not the same as being unable to change the database.** A push that puts SQL in `supabase/migrations/` executes it against production; write without read is the worse asymmetry, since the thing that fires it can't see what it did. Establish what a push actually does before putting a migration file on it.
- Permission given for one purpose (source control) does not cover a consequence neither party knew about (applying migrations).
- A migration that rewrites live rows needs a confirmed backup immediately before it runs. `pg_dump` over the connection string is free on every Supabase tier (only scheduled backups and PITR are paywalled); an in-database snapshot lives inside the database it protects and does not survive its loss.
- Any snapshot or scratch copy of data must sit outside PostgREST's exposed schemas — a table in `public` without RLS is served to the public anon key.

Verification
- A clean diff, a green build and a ticked checkbox are all compatible with a broken feature. Build it, run it, look at it.
- Check a key before using it: the JWT decodes to the right `ref`, `role: anon`, unexpired. A `service_role` key bypasses RLS and would make `verify:rls` pass while proving nothing.
- Scratch-Postgres harness: `initdb` refuses to run as root and the scratchpad is unreadable to the `postgres` user, so the data directory lives under `/var/lib/postgresql`; every RLS probe runs under `set local role`; the relay translating `/rest/v1/*` into SQL runs each request as `authenticated` with the owner UUID as the JWT claim.
- Harness rules: throw on any filter operator not implemented; never treat `select`/`order`/`limit`/`offset`/`columns`/`on_conflict` as a filter; alias embed subqueries `sub`, never `x`; assert a list is populated before asserting something is absent from it; when a defect looks surprising, read the generated SQL before believing the harness.
- Install Playwright and `pg` with `npm install --no-save` and remove them afterward.
- Commit verification scripts to scripts/. Never commit scratch SQL, or anything containing real data, keys or user IDs.
- Keep pure logic (`src/lib/layout.ts`) free of React and Supabase so it can be compiled standalone and property-tested against the rule the plan claims.

Code pitfalls
- Deleting a parent relies on `on delete cascade`; the client never hand-deletes children. The one deliberate exception is `removeEmptiedWaitingEntries`, because `waiting_entries` has no FK back to its picks.
- Status is never inferred from tasks. Completing every task must not move a block to Done.
- Do not add an ordering, `position` or `waiting` column: step order is creation order; Waiting and Ready are derived from entries.
- Ready must not depend on the client having tidied up: zero entries is not Ready, and an entry holding zero picks is not Ready. Gate a status change on `describeOutstanding()` being non-empty, never on `!isProjectReady()` — that would trap every project with no entries in Active.
- `AutoGrowTextarea` must add `offsetHeight - clientHeight` back; `box-sizing: border-box` makes `style.height` the border box and `scrollHeight` the content box.
- `setPointerCapture` retargets *all* events for that pointer, including a nested button's own `click`: skip the drag and the capture when the pointerdown target is inside a `<button>`. It also makes native `dblclick` fire after two real drags — use the distance-threshold approach.
- Supabase errors are plain `{code, message, details, hint}` objects, not `Error` instances — `String(error)` gives `[object Object]`.
- A failed note delete must reset `deletingRef`, or every later blur skips saving that note.
- Swapping an `<input>` for a `<textarea>` silently drops the implicit Enter-submits behaviour; decide what Enter does explicitly (see `DECISIONS.md`).
- Accessible names must be distinct for anything a test or screen reader has to find (the header's "Focus screen" vs the popup's "Focus"; the filter checkboxes' `aria-label`s vs the status buttons).
- Documentation counts as part of "done". A chunk that ships code and skips `TASKS.md` and `CONTEXT.md` isn't finished.
