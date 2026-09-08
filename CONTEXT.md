# CONTEXT.md — Current

## What this is
Current — a personal project/direction-tracking app. Fresh build, fresh repo, no history yet. This file is the single source of truth for current app state; keep it lean and update it after every session, per usual convention.

## Stack
React, TypeScript, Vite, Tailwind, Supabase, TanStack Query, Zustand, Dexie, Recharts, vite-plugin-pwa.

## Database
Fresh, dedicated Supabase project. No shared backend or cross-app data access with Overload.

## Current build target
**V1 sandbox — deliberately minimal.** Spec: `CURRENT-V1-SANDBOX-SPEC.md`. Scope: Area → Canvas → Block, full create/edit/delete on everything, one status model (Upcoming/Active/Done), one Free Note type, freeform block placement, no ordering or connections between blocks. Built rough on purpose — no visual design pass — specifically to learn what's actually needed through real daily use before investing further.

**Not in scope for this build:** Vision, Phase, connections/branching/merging, sub-projects, tabs, resize, theming, visual design. A fuller v2+ vision covering these exists, but is kept outside this repo on purpose, so it can't shape this build. It is not present here — don't look for it, don't reconstruct it, and its absence is not a gap to flag or escalate. Everything needed for this build is already in `CURRENT-V1-SANDBOX-SPEC.md`.

## Status
Phase 0 (project setup), Phase 1 (shared primitives), Phase 2 (Areas), and Phase 3 (Canvas and Blocks) are done. Phase 4 (Block popup) is next.

Both decisions that were open after planning are now resolved and reflected in the spec and `TASKS.md`: Supabase email auth with one account and RLS locking every table to that user, one login screen (Phase 0.3); and Free Notes get their own explicit delete action gated by the confirm dialog, with auto-discard-on-empty-blur covering only a note that was never given real content (Phase 5.4).

Dexie, vite-plugin-pwa, and Recharts are in the stack above but are not installed in this build — nothing in the V1 spec needs offline storage, installability, or charts.

### Phase 0 — what was built

- Vite + React 19 + TypeScript project scaffolded at repo root (`npm create vite@latest`'s current `react-ts` template — oxlint for linting, TS project references). `npm run dev`, `npm run build`, `npm run lint` all work.
- Tailwind v4 wired via `@tailwindcss/vite` — no `tailwind.config.js`, no theme customisation, just `@import "tailwindcss";` in `src/index.css`. Defaults only, per spec.
- Supabase client at `src/lib/supabase.ts`, reading `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` from `.env` (throws loudly if unset). `.env` is gitignored; `.env.example` is committed with empty values.
- Schema + RLS migration at `supabase/migrations/0001_init.sql` — the four tables from the data model above, plus RLS enabled on all of them with one `for all using (auth.uid() = '<owner UUID>') with check (auth.uid() = '<owner UUID>')` policy per table, pinned to a sentinel UUID that must be replaced with the real account's UUID before running (loud comment at the top of the file explains this; the sentinel matches no real user, so an unreplaced file fails closed). No `user_id` column anywhere — the policy compares `auth.uid()` directly instead. Pinning to a specific UID matters because Supabase allows email signups by default and the anon key ships publicly in the client bundle: a policy that only checked "is someone signed in" would let any stranger who signs themselves up read and write every row. The other half of the fix — disabling email signups in the dashboard so no second account can ever exist — has to happen outside this repo; see "Manual step still needed" below.
- `src/App.tsx` gates on `supabase.auth.getSession()`/`onAuthStateChange`: no session renders `src/auth/LoginScreen.tsx` (email + password via `signInWithPassword`, no sign-up form — the one account is created out-of-band in Supabase, not through this UI); a session renders a bare "Signed in as … / Sign out" placeholder, since the actual Area/Canvas UI starts in later phases.
- TanStack Query's `QueryClientProvider` wraps the app in `src/main.tsx` (`src/lib/queryClient.ts`).
- Zustand store at `src/store/uiStore.ts` holds only `activeAreaId` and which popup is open (`activePopup`/`popupContext`) — no server or persisted data, per spec.
- `scripts/verify-rls.mjs` (`npm run verify:rls`) exercises the Phase 0.3 acceptance criterion directly against the live project once `.env` is filled in: reads and writes all four tables with the anon key and no session, and fails loudly if any row is returned or any write succeeds.
- Verified locally: `npm run build` (tsc -b + vite build) and `npm run lint` (oxlint) both pass clean. Rendered the login screen in a headless browser against placeholder Supabase env vars to confirm the auth-gated shell and Tailwind styling actually render — no console errors, no crash.

### Manual step still needed (outside this repo, outside what I have access to)

Nothing in this session had credentials or dashboard access to do any of this — it has to happen in the Supabase dashboard/CLI, in order, by Adam:

1. Create the Supabase project.
2. Disable email signups in Auth settings — without this, anyone can self-register and pass the "signed in" half of RLS.
3. Create the single account.
4. Copy that account's UUID into `supabase/migrations/0001_init.sql`, replacing the sentinel `00000000-0000-0000-0000-000000000000` in every policy.
5. Run the migration against the project.
6. Fill in `.env` from `.env.example`.
7. Run `npm run verify:rls` — confirms the Phase 0.3 acceptance criterion (no session → all four tables return no rows / reject writes) and that email signup is rejected.

### Phase 1 — what was built

- `src/components/Popup.tsx` — the one modal shell every popup in the spec reuses: takes `onClose` and `children`, renders via a `createPortal` to `document.body` over a click-to-close backdrop, closes on Escape, and moves focus into the dialog on open. No `open` prop — callers mount it conditionally.
- `src/components/confirmContext.ts` + `src/components/ConfirmDialogProvider.tsx` — the confirm dialog, built on `Popup`. `ConfirmDialogProvider` is mounted once at the app root (`src/main.tsx`, inside `QueryClientProvider`) and exposes `useConfirm()`, a hook returning `(message: string) => Promise<boolean>` that any component can call and await — the single gate every future delete path (Area, Block, Task, Note) must go through. Only one confirmation can be pending at a time, which is all the spec needs.
- Verified in a headless browser (temporary test buttons wired into `App.tsx` for the session, reverted afterward — not part of the committed code): popup opens and grabs focus, closes on Escape, closes on backdrop click, stays open on clicks inside its content; confirm dialog's Cancel/Confirm/Escape all resolve the awaited promise correctly.
- No new dependencies. No delete paths, Areas, Canvas, Blocks, Tasks, or Notes were built — those start in Phase 2.
- Fixed post-review: Escape now closes only the topmost popup (module-level open-order stack in `Popup.tsx`), and the backdrop only closes on a click where both mousedown and mouseup land on the backdrop itself, not on a drag that starts inside the dialog and releases outside.

### Phase 2 — what was built

- `src/types.ts` — `Area` row type, mirroring `supabase/migrations/0001_init.sql`; grows as later phases add Blocks, Tasks, and Notes.
- `src/lib/areas.ts` — TanStack Query hooks (`useAreas`, `useCreateArea`, `useUpdateArea`, `useDeleteArea`) wrapping the Supabase `areas` table. Delete only removes the `areas` row — Blocks and Notes underneath are left to the migration's `on delete cascade`, per the instruction not to hand-delete children in client code.
- `src/components/AreaTabs.tsx` — the tab row: one tab per Area ordered by `created_at` (query already orders this way), click to activate via `uiStore.setActiveAreaId`, "+" opens the create popup, double-click opens the edit popup. A `useEffect` keeps `activeAreaId` valid, falling back to the first remaining Area (or `null`) whenever the active one disappears — covers both first load and post-delete.
- `src/components/AreaCreatePopup.tsx` / `AreaEditPopup.tsx` — both reuse `Popup`. Create is a single name field. Edit has the name field plus Delete, which awaits `useConfirm()` before calling the delete mutation — no instant deletes.
- `src/App.tsx` — the placeholder "Signed in as…" screen is now a real shell: `AreaTabs` plus sign-out in a header, and a content area below that names the active Area (a stand-in for the Phase 3 Canvas) or shows an empty-state message when there are no Areas at all.
- No new dependencies. Popup and `useConfirm()` reused as-is, unmodified.
- **2.4's acceptance criterion is unverified**: no live Supabase project/credentials in this environment, and Blocks/Notes don't exist yet to actually test the cascade. What's implemented is the client side only — delete the `areas` row and trust the migration's `on delete cascade` — matching the instruction not to hand-delete children. Confirming "no orphaned rows" needs a live project and, practically, Blocks/Notes from Phase 3 to have something to orphan.
- Verified in a headless browser against an in-memory mock of the Supabase client (temporary, not committed — restored from the real client before pushing, same pattern as Phase 1's temporary test buttons): starting from zero Areas, the empty state renders; "+" opens the create popup, submitting adds a tab and makes it active; a second Area is created and both tabs render in creation order; clicking a tab switches the active one; double-clicking a tab opens the edit popup pre-filled with its name and a Delete action; renaming through the edit popup updates the tab; clicking Delete opens the confirm dialog naming the Area, Cancel leaves the edit popup open and the Area intact, Confirm deletes it; after deleting the active Area the remaining one becomes active; deleting the last Area returns to the empty state. No console or page errors during any of this. Not exercised: the actual RLS-backed Supabase network calls, and the cascade to Blocks/Notes (per above).

### Phase 3 — what was built

- `src/types.ts` — `Block` and `Task` row types added, mirroring `supabase/migrations/0001_init.sql` (untouched — no schema changes this phase).
- `src/lib/blocks.ts` — `useBlocks(areaId)`, `useCreateBlock`, `useUpdateBlockPosition`, same TanStack Query pattern as `src/lib/areas.ts`. `useCreateBlock` inserts the Block and, if any quick-capture lines were typed, the Tasks in the same mutation. No hook for status or name edits, or for task CRUD — that's Phase 4's Block popup, not built here.
- `src/components/Canvas.tsx` — fills the space below the tab row (3.1): a small non-scrolling toolbar holding "+ Add block", and a `relative overflow-auto` div below it that renders one absolutely-positioned `BlockCard` per Block at its stored `x`/`y`. No zoom or pan; scrolling is the container's native scroll if blocks land past the viewport. "+ Add block" reads the scroll container's current viewport (`scrollLeft/Top` + `clientWidth/Height`) to compute the centre position passed to the create popup (3.5) — a one-time coordinate, not an arrangement rule; nothing moves a block after creation.
- `src/components/BlockCard.tsx` — the draggable block (3.2), plain pointer events (`onPointerDown`/`onPointerMove`/`onPointerUp` with `setPointerCapture`), no drag-and-drop library. Position is local state while dragging and is written back via `useUpdateBlockPosition` on pointer-up; freeform, no snapping/grid/auto-stacking. Also renders the three status treatments (3.4): `active` full colour (`bg-blue-500`), `done` dimmed (`grayscale` + muted gray), `upcoming` the same dimmed classes plus a small `absolute` coloured dot so it doesn't read as `done` at a glance.
- `src/components/BlockCreatePopup.tsx` — opened by "+ Add block" (3.3), reuses `Popup`. A name field plus a plain `<textarea>` for quick-capture tasks — typing Enter in a textarea already produces the next line for free, so no custom key handling was needed; on submit each non-empty line becomes a Task row, and an empty textarea creates the Block with no tasks (tasks are optional, per spec).
- `src/App.tsx` — `Workspace` now renders `<Canvas areaId={activeArea.id} />` in place of the Phase 2 placeholder text; switched the outer layout from `min-h-screen` to `h-screen` so the Canvas's `flex-1 overflow-auto` has a bounded height to scroll within, instead of the whole page growing.
- No new dependencies (per the phase's "no drag-and-drop library" instruction). Blocks have no delete in this phase — that's Phase 4. Block status can only be `upcoming` (the schema default) through anything built here; setting it to `active`/`done` is also Phase 4's Block popup.
- Verified in a headless browser against a temporary in-memory mock of the Supabase client (same pattern as Phase 1/2 — written over `src/lib/supabase.ts` and a one-line temporary `window.__queryClient` exposure in `src/main.tsx` for the session, both fully reverted and diffed clean before committing): created an Area, then "+ Add block" opened the popup; creating a block with three quick-capture lines produced 3 task rows in the mock store; creating a second block with the tasks field left empty produced a block with 0 tasks and left the task count unchanged — confirming tasks are optional. Dragged the first block with simulated pointer movement (150px/120px delta): the block moved on screen by exactly that delta and the mock store's row for it was mutated to the new `x`/`y` — confirming drag-drop persists through the data layer, not just local component state. Seeded three additional rows directly in the mock store with `status` `active`/`done`/`upcoming` and forced a query refetch (not a full page reload, which would have wiped the in-memory mock): the `active` block rendered with the blue "full colour" classes and no marker; `done` and `upcoming` rendered with identical dimmed/grayscale classes; only `upcoming` additionally rendered the small coloured marker dot — confirmed both via computed-style comparison and a screenshot. No console or page errors during any of this. **Not verified**: anything against a live Supabase project/database — this environment has no credentials, per the instruction not to seek any. RLS, real network latency, and real Postgres constraints (e.g. the `status` check constraint) were not exercised.
- **Post-review fix**: removed the redundant `grayscale` Tailwind class from `statusClasses.done`/`.upcoming` in `BlockCard.tsx` — it desaturated the nested yellow marker along with the card body, making `upcoming` read as grey and defeating 3.4; `bg-gray-300 text-gray-500` alone still gives the dimmed look. Also made `handlePointerUp`'s position mutation conditional on `x`/`y` actually differing from `block.x`/`block.y`, so a zero-distance click no longer writes to the database. Verified in a headless browser (temporary harness rendering `BlockCard` directly, reverted before commit): the `upcoming` marker now renders as actual yellow (computed `oklch(0.852 0.199 91.936)`, matching `bg-yellow-400`) against a grey card, `done`/`upcoming` still share identical computed background/filter, a click with no pointer movement fired zero requests, and a drag persisted the correct new coordinates in one request.

## Escalation criteria

Always escalate to Adam:

* Anything touching the database schema or a migration
* Anything not explicitly decided in `CURRENT-V1-SANDBOX-SPEC.md` — no guessing at product or design intent
* Anything touching auth, or crossing the Overload/Current data boundary
* The builder deleting or overwriting any existing data or files unexpectedly during the build itself — this does NOT mean the app's own user-facing delete features (Area/Block/Task/Note), which are already fully specced and don't need re-approval each time code is written for them
* A test failure without an obvious, mechanical fix
* Anything that would change scope, cost, or timeline versus what TASKS.md described

Proceed without asking:

* Lint/type fixes, typos, formatting
* Adding tests for already-specified behavior
* Following a pattern already established elsewhere in the codebase
* Anything TASKS.md already pre-approved explicitly
