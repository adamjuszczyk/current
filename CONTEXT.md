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
Pre-build, planned. `TASKS.md` generated from `CURRENT-V1-SANDBOX-SPEC.md` — data model plus six phases (setup, shared primitives, Areas, Canvas/Blocks, Block popup, Free Notes). No code written yet; Phase 0 is the next thing to start.

Both decisions that were open after planning are now resolved and reflected in the spec and `TASKS.md`: Supabase email auth with one account and RLS locking every table to that user, one login screen (Phase 0.3); and Free Notes get their own explicit delete action gated by the confirm dialog, with auto-discard-on-empty-blur covering only a note that was never given real content (Phase 5.4).

Dexie, vite-plugin-pwa, and Recharts are in the stack above but are not installed in this build — nothing in the V1 spec needs offline storage, installability, or charts.

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

## Build log

Running record of chunk hand-offs and escalations. One entry per event, newest last.

* **2026-09-08 — Reviewer session started.** Watching the build chunk by chunk; chunks are the TASKS.md phases in order (0 → 5), one phase per builder session, no combining or splitting. On each builder going idle: read its summary, check it against the escalation criteria above, then either start the next phase's builder or hand the decision to Adam and wait.
* **2026-09-08 — Phase 0 builder running** (`session_01VNn4vAkyhpL3K7whuNNj5T`, branch `claude/amazing-hamilton-18epoe`), started outside this session. Cloud sessions aren't reachable as peers for an idle subscription, so the reviewer polls the session record on a self-scheduled check-in instead. Gate is at the end of Phase 0, before Phase 1 starts.
* **2026-09-08 — Phase 0 builder failed; escalated to Adam, build paused.** *(Superseded — the builder resumed after the quota reset and completed. See the entry below.)* The Phase 0 builder went idle at 15:26 UTC having *failed*, not finished: it was cut off by the account-wide five-hour usage limit mid-work (~16 min in, 26.8k output tokens, ~$1.50). **Nothing was pushed** — `claude/amazing-hamilton-18epoe` never reached the remote and its container is disconnected, so what it built is gone and what it touched can't be inspected. Quota reset at 16:50 UTC; a fresh window is open.
  Escalated rather than restarting, on three grounds: (1) "changes scope, cost, or timeline versus what TASKS.md described" is on the always-escalate list, and a phase that consumed budget and produced nothing is exactly that; (2) Phase 1 was never startable — it builds on a scaffold that doesn't exist; (3) Phase 0.3 (auth, RLS, schema) is unavoidably an always-escalate item and the question raised at the reviewer's start is still unanswered.
  Sharpening the decision: **this environment has no Supabase credentials.** A builder cannot create the project, apply the schema, apply RLS policies, or verify 0.3's acceptance criterion. It can only commit SQL to a file and write client code reading `.env`. So 0.3 needs Adam's hands regardless of how the escalation question is resolved.
* **2026-09-08 — Phase 0 completed; reviewed; escalated on RLS.** The builder resumed once quota reset and finished at 17:31 UTC, pushing commit `590399c` to `claude/amazing-hamilton-18epoe`. The previous entry's "failed, nothing survived" read was correct at 17:27 and stale by 17:31.
  **Reviewed against the escalation criteria.** Clean on most counts: schema SQL in `supabase/migrations/0001_init.sql` matches the TASKS.md data model exactly (no extra columns, no ordering, no soft deletes, cascades right); Tailwind defaults only, no config file; Zustand holds transient UI state only; Dexie, vite-plugin-pwa and Recharts correctly not installed; login screen has no sign-up form; `.env` gitignored with `.env.example` committed; no files deleted or renamed; the spec untouched.
  **Escalated — the RLS policy doesn't match the spec.** Every table got `using (auth.uid() is not null)` — *any* authenticated user, not *that* user. Supabase enables email signups by default and the anon key ships publicly in the client bundle, so anyone could sign themselves up and gain full read/write on all four tables. That defeats "the anon key alone must never be sufficient to read or write real data." `verify-rls.mjs` only probes the no-session case, so it would report a false pass. Schema, auth, and an undecided design call all at once — held for Adam rather than picked by the reviewer.
  **Phase 0 is code-complete, not done.** Its acceptance criterion is unverified and unverifiable here: no Supabase credentials in the environment. Adam has to create the project, run the migration, create the one account, and fill in `.env`.
  Phase 1 not started, pending that decision.
