# Current — V1 Sandbox — SPEC.md

**Status:** Ready for technical planning. This is deliberately not the full product — a fuller v2+ vision exists, but it's kept outside this repo on purpose, so it can't shape this build. This document is complete and self-contained; nothing else needs to be consulted to build it.

**Why this exists:** rather than build the fully-specced version first, build a genuinely minimal, rough sandbox — "supposed to look and be shit" — and let real daily use reveal what's actually needed before investing in anything more. Visual design is explicitly not part of this pass.

---

## Scope

Three things exist. Nothing else.

**Area → Canvas → Block**

No Vision, no Phase, no connections between blocks, no branching or merging, no sequencing, no Waiting status, no tabs, no resize, no theming, no visual design pass. All of that is real and already specced in `CURRENT-SPEC.md` — none of it is v1.

---

## Areas

- **Create:** a "+" button at the end of the area-tabs row opens a popup. Type a name. That's the entire form — nothing else to fill in.
- **Navigate:** one tab per Area, as before.
- **Edit / Delete:** double-clicking an Area's tab opens a popup where its name can be edited, or the Area deleted.
- **Delete behavior:** deleting an Area deletes everything inside it — every Block and every Free Note, no exceptions. Requires a confirmation step before it happens (see "Delete confirmation" below).

---

## Blocks

Only one kind of block exists — no Task-vs-sub-Project distinction, no nesting. A Block just holds a flat list of Tasks.

- **Create:** an "+ Add block" action opens a popup. Type a name, and optionally type tasks straight into the same popup (quick-capture: type a line, Enter, next line — each becomes a task).
- **Placement:** freeform, placed anywhere on the Area's canvas by the person using it. No default arrangement is imposed — no automatic stacking, no forced grid. Where blocks actually end up is something to observe from real use, not decide in advance.
- **No ordering, no connections:** blocks don't relate to each other. Nothing to drag-connect, nothing sequential, nothing blocking.
- **Edit / Delete:** double-clicking a Block opens a popup where its name can be edited, the block deleted, and its tasks managed (add, edit, delete, mark complete — full CRUD on tasks, individually).
- **Tasks are always an unordered flat list** inside that popup — no sequencing among them either.
- **Status — three states, set manually inside the same popup:** Upcoming / Active / Done.
  - **Active** — full, normal color.
  - **Done** — visually "blacked out" (dimmed/desaturated).
  - **Upcoming** — same blacked-out treatment as Done, distinguished by one small colored UI marker so the two don't read identically at a glance.
- **Delete behavior:** deleting a Block deletes all of its tasks with it, no exceptions. Requires confirmation (below).

---

## Free Note

Carried forward unchanged from the full spec — already simple enough that cutting it further isn't necessary.

- A dedicated "+ Note" action creates an empty note immediately, focused in place for typing.
- Left empty, it's discarded automatically.
- Multiple notes allowed per Area.
- No connections, no ordering — same as Blocks.

---

## Delete confirmation

**Every delete action — Area, Block, or Task — requires an explicit confirmation step before it happens.** No silent, instant deletes anywhere in this app, even in the sandbox.

---

## Explicitly not in v1

Vision, Phase (and everything that comes with it — the scrollable timeline, End Phase, Plan Next Phase, the breadcrumb, the "back to current" button), block-to-block connections of any kind (sequencing, branching, merging, blocking, the Waiting status that exists only to support it), sub-Projects/nested steps, project detail as a modal-or-tab with resize/fullscreen, zoom, pan, status filtering, theming, and any visual design pass. All real, all part of a fuller v2+ vision kept intentionally outside this repo, all deliberately deferred until using this sandbox for real says otherwise.
