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
Phase 0 (project setup), Phase 1 (shared primitives), and Phase 2 (Areas) are done. Phase 3 (Canvas and Blocks) is next.

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
