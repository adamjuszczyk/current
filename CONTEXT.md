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

Two open decisions in `TASKS.md` want an answer before the phases they block: how the Supabase project is protected given the spec has no auth (recommended: one account with RLS), and whether deleting a non-empty Free Note needs its own confirmed action or is covered by the spec's auto-discard-when-empty rule.

Dexie, vite-plugin-pwa, and Recharts are in the stack above but are not installed in this build — nothing in the V1 spec needs offline storage, installability, or charts.
