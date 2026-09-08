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
Phase 0 (project setup) is done. Phase 1 (shared primitives — popup shell, confirm dialog) is next.

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
