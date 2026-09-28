# HISTORY.md — Current

Statements moved out of `CONTEXT.md` because they stopped being true. Text is verbatim; each item names where it came from and why it moved. `CONTEXT.md` keeps only what is true now. The Build log in `CONTEXT.md` is not moved here — it is a record of what was true when written and is left as written.

Moved 2026-09-28 (line numbers refer to `CONTEXT.md` at commit `828f32e`).

## Removed whole

### Status — was line 26

*Why moved:* Present-tense claims now false: live app 'still v1's shape', schema 'not run against the live project'. Superseded by the Phase 2/3/5/6/7 status paragraphs that remain in Status.

**V2 Phase 1 is built and verified — 2026-09-10.** `TASKS.md` holds eight chunks — Phase 1, Phase 2a, Phase 2b, and Phases 3–7 — and 43 items, generated from `CURRENT-V2-SANDBOX-SPEC.md`. Everything the running app does is still v1 unchanged, except how Note and task text fields render (Phase 1) — v2's schema and client changes (Phase 2a) are written and proven against a scratch database but **not** run against the live project yet, so the live app is still v1's shape.

### Status — was line 28

*Why moved:* Present-tense claims now false: 'None of this has touched the live project', Phase 2b 'still not started'. 0002 and 0003 are applied live and verify:rls passes on all eight tables.

**Phase 2a (schema, RLS, client compatibility) is built and proven against a scratch database — 2026-09-11.** `0002_v2.sql` is written, run fresh against a scratch Postgres 16 seeded with representative v1 data, and every task survives under its original block in a new Flat list with completed state intact; a block with no tasks gets no list. RLS on the four new tables is verified by direct SQL against the same scratch database (no PostgREST/GoTrue in this environment — see Phase 2a's build-log entry for what that means and doesn't mean). The client (`useTasks` keyed by list, notes hooks handling either parent, `BlockEditPopup` reading its block's list, quick-capture routing through one Flat list) is verified end to end in a browser against that same scratch database via a hand-rolled PostgREST stand-in, not a hand-written fixture. **None of this has touched the live project** — that is Phase 2b, gated on a confirmed backup, still not started.

### Status — was line 30

*Why moved:* Superseded plan: 2b as a gated, not-started step. 2b is complete; the durable process change it led to stays in the Phase 2 status paragraph.

**The database is no longer empty, and that changes the shape of the risk.** V1's migration had nothing to lose; v2's Phase 2b rewrites live rows — tasks move out of blocks and into lists. Phase 2 is split on exactly that line: 2a writes and proves the migration against a scratch database (now done), 2b is the one irreversible step, applying it to the live project, and it does not start without a confirmed backup.

### V1 — Phase 2 — what was built — was line 88

*Why moved:* Open issue now resolved: 2.4's cascade delete was verified by Adam in the running app (2026-09-09; see the Build log).

- **2.4's acceptance criterion is unverified**: no live Supabase project/credentials in this environment, and Blocks/Notes don't exist yet to actually test the cascade. What's implemented is the client side only — delete the `areas` row and trust the migration's `on delete cascade` — matching the instruction not to hand-delete children. Confirming "no orphaned rows" needs a live project and, practically, Blocks/Notes from Phase 3 to have something to orphan.

### V2 — Phase 2a — what was built — was line 142

*Why moved:* Present-tense claim now false: 'The live project is untouched — that is Phase 2b ... not started.' 2b is complete.

Schema, RLS and client compatibility, written and proven against a scratch database only. **The live project is untouched** — that is Phase 2b, gated on a confirmed backup, not started.

### V2 — Phase 2a — what was built — was line 149

*Why moved:* Superseded stepping stone: `lists[0]` as 'the' block's list, lazily created. Removed in v2 Phase 3 (see that section's note on the closed create-path race).

- `src/components/BlockEditPopup.tsx` — reads `useLists(blockId)` and treats `lists[0]` as "the" block's list (this stepping stone never produces more than one); `useTasks(list?.id ?? null)` follows from that. Adding a task when no list exists yet lazily creates one first, at the same fixed origin, then adds the task into it — the interactive-path twin of 2a.1's own migration and `useCreateBlock`'s quick-capture path; all three agree on where a block's implicit Flat list comes from.

## Corrected in place

The sentence below was replaced in `CONTEXT.md`; the old wording is kept here.

### What this is — line 4

*Why changed:* v2 is no longer 'specced and planned'; it is built.

Old: v2 is specced and planned against what that use showed. This file is the single source of truth for current app state; keep it lean and update it after every session, per usual convention.

Now: v2 is built (sandbox build closed 2026-09-11), specced against what that use showed. This file is the single source of truth for current app state; keep it lean and update it after every session, per usual convention. Statements that stop being true are moved to `HISTORY.md`.

### Status — Phase 6 — line 38

*Why changed:* Contradicted by the 6.5/6.8 decision: layout is incremental placement, not longest-path layering.

Old: Connected blocks are auto-laid-out by longest-path layering — a block's column is the longest path to it from any source in its component, at a uniform pitch, deterministic via `created_at` ordering within a column — and dragging

Now: Connected blocks are auto-laid-out by incremental placement, not a maintained longest-path layering (`TASKS.md` 6.5 as corrected 2026-09-11: 6.8 forbids repositioning on delete, so arrangement can depend on the order edges were added; every edge still runs left to right) — and dragging

### Status — Phase 6 — line 38

*Why changed:* The diamond does not distinguish longest-path from shortest-path layering (both paths are length 2); the clause was wrong as evidence.

Old: , including the diamond-shaped graph the phase brief names specifically (confirming the "longest path, not shortest path" column-3 placement), a drag

Now: , including a drag

### V1 — Phase 0 — line 55

*Why changed:* Sentinel-UUID step is done; the file carries the real UUID.

Old: , pinned to a sentinel UUID that must be replaced with the real account's UUID before running (loud comment at the top of the file explains this; the sentinel matches no real user, so an unreplaced file fails closed).

Now: , pinned to the real owner's UUID (substituted 2026-09-09; applied live).

### V1 — Phase 0 — line 55

*Why changed:* Manual step is done and 'Manual step still needed' no longer exists.

Old: The other half of the fix — disabling email signups in the dashboard so no second account can ever exist — has to happen outside this repo; see "Manual step still needed" below.

Now: The other half of the fix — email signups disabled in the dashboard so no second account can ever exist — is done, and `npm run verify:rls` checks it.

### V1 — Phase 0 — line 56

*Why changed:* The bare placeholder was replaced by the real shell in v1 Phase 2 onward.

Old: a session renders a bare "Signed in as … / Sign out" placeholder, since the actual Area/Canvas UI starts in later phases.

Now: a session renders the workspace shell (Area tabs, sign-out, canvas or Focus screen; built in the later phases).

### V1 — Phase 0 — line 58

*Why changed:* 'Holds only' stopped being true when v2 Phases 5, 6 and 7 added store fields.

Old: holds only `activeAreaId` and which popup is open (`activePopup`/`popupContext`) — no server or persisted data, per spec.

Now: holds UI-only state — `activeAreaId`, which popup is open (`activePopup`/`popupContext`), and v2's additions (active view and scroll target, connect mode, status filter) — no server or persisted data, per spec.

### V1 — Phase 0 — line 59

*Why changed:* Script now covers eight tables and is three-valued (v1 close-out and v2 Phase 2a).

Old: reads and writes all four tables with the anon key and no session, and fails loudly if any row is returned or any write succeeds.

Now: probes all eight tables with the anon key and no session (no rows returned, writes refused with a PostgREST error code) and checks that signup is refused; it is three-valued, so an unreachable host exits 2 instead of passing (see the Build log, 2026-09-09).

### V1 — Phase 3 — line 96

*Why changed:* Hook renamed to a batch write in v2 Phase 6; the changed-only guard came from the v1 post-review fix.

Old: is written back via `useUpdateBlockPosition` on pointer-up;

Now: is written back via `useUpdateBlockPositions` (batch; see v2 Phase 6) on pointer-up, only when it actually changed;

### V1 — Phase 3 — line 96

*Why changed:* `grayscale` was removed in the v1 Phase 3 post-review fix (it desaturated the nested Upcoming marker).

Old: `done` dimmed (`grayscale` + muted gray)

Now: `done` dimmed (muted gray, no CSS filter)

### V2 — Phase 2a — line 145

*Why changed:* 'Deliberately thin' and the lazy-creation path are gone (v2 Phase 3).

Old: Deliberately thin: no update or delete, since 2a.3 builds no list CRUD UI — the only writers are quick-capture and `BlockEditPopup`'s lazy "create the block's one Flat list on its first task" path, both at a fixed `(24, 24)` origin matching 2a.1's own data migration.

Now: Grew position-update and delete hooks in v2 Phase 3; quick-capture still creates its Flat list at a fixed `(24, 24)` origin matching 2a.1's own data migration.

### V2 — Phase 3 — line 165

*Why changed:* 'No Waiting UI yet' stopped being true when Phase 4 shipped.

Old: Nothing in the app calls these except `ListCard`'s task-delete path — there is no Waiting UI yet, so every call this phase returns `[]` against real data; the browser verification below seeded rows directly by SQL to exercise the non-empty path, since Phase 4 hasn't shipped the only path that would populate them for real.

Now: `ListCard`'s task-delete path calls these; since v2 Phase 4 shipped Waiting entries they act on real data (see the Phase 4 review in the Build log). The verification below predates that and seeded rows directly by SQL.

### V2 — Phase 6 — line 203

*Why changed:* Same correction as Status — Phase 6.

Old: auto-laid-out by longest-path layering, with rigid

Now: auto-laid-out by incremental placement (not a maintained longest-path layering — `TASKS.md` 6.5 as corrected 2026-09-11), with rigid
