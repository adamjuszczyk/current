# Current — V2 Sandbox — SPEC.md

**Status:** Ready for technical planning. Still a sandbox build — even more so now, since every decision below came directly out of using v1 for real, not from re-planning from scratch. This document supersedes CURRENT-V1-SANDBOX-SPEC.md entirely: it describes the complete v2 product, carrying forward what v1 got right unchanged and replacing what didn't hold up. Nothing else needs to be consulted to build it. A fuller v2+/vision-scale version of this product still exists outside this repo, deliberately — it played no role in anything below, and shouldn't play one in the build either.

**Why this exists:** v1 was deliberately rough, built to find out what real daily use would actually demand before investing further. It did its job — every feature below traces to a specific real instance of using v1, not a hypothetical. Where v1's own shape held up (Areas, single-Block-type, manual status, delete confirmation), it's kept as-is. Where it didn't, it's changed.

---

## Carried forward from v1, unchanged

**Areas.** Create via "+" on the tab row, name-only form. One tab per Area. Double-click a tab to rename or delete. Deleting an Area deletes everything inside it — every Block and every Area-level Note — gated by the confirmation step below.

**Authentication.** One account, Supabase email auth, RLS locked to that one authenticated user across every table. One login screen. No multi-user, no OAuth, no sign-up flow.

**Delete confirmation.** Every delete action anywhere in the app — Area, Block, Task, List, Note, or Connection — requires an explicit confirmation step first. No silent, instant deletes.

**Free Note at the Area level.** "+ Note" creates an empty note, focused for typing immediately. Left empty, discarded automatically. Real content gets its own explicit delete, same confirmation gate as everything else. Multiple per Area. No connections, no ordering.

---

## Fixed from v1

**Text inputs expand with content.** Task text and Note text no longer sit in a fixed-size box. This was the single most-cited friction point from real use — it produced split notes (one idea spread across several notes because one box couldn't hold it) and duplicate tasks (same root cause, different symptom). One fix, both symptoms.

---

## Blocks

Still one kind of block — the Task-vs-sub-Project distinction from the fuller vision stays out. What's inside a Block changes substantially (see "Project canvas," below); Block-level behavior otherwise carries forward: freeform placement on the Area canvas (unless connected — see Connect), create/edit/delete via the same popup pattern, three manual statuses.

**Status — unchanged: Upcoming / Active / Done, set manually.** Coloring unchanged too: Active is full color, Done is dimmed/desaturated, Upcoming uses the same dimmed treatment as Done, distinguished by a small colored marker. Connect, Waiting, and Focused (below) layer additional visual states on top of this, all specific to Active.

---

## Connect

A block can be connected to any other block within the same Area — not across Areas.

- **Direction only, no gating.** A connection runs left-to-right and means "comes before," informationally — it enforces nothing. Whatever actually blocks a project is Waiting's job, not Connect's.
- **Multiple in, multiple out.** A block can have any number of incoming and outgoing connections.
- **Acyclic.** A connection can never complete a cycle. If a real dependency runs in both directions between two blocks, only one direction gets a Connect line — the return relationship is expressed through Waiting instead.
- **Auto-layout by connection graph.** Blocks with at least one connection are laid out automatically, positioned by the shape of the connected component they belong to, rather than freeform placement. A block with zero connections stays freely draggable, exactly like today — nothing to compute for a component of one.
- **Dragging moves the whole component.** Every block reachable through any connection moves together as one rigid shape. There's no independent position for an individual connected block — the algorithm owns the shape; dragging just relocates it.
- **Adding a connection recomputes the resulting component's internal shape, never its position.** When a new edge merges two previously separate components, the position of the larger one (by block count) is kept; the smaller one is pulled into the new shape around it. If both sides are equal size, the upstream (source) side's position wins.
- **Removing a connection never repositions anything.** A layout that already satisfied a graph still satisfies it with one fewer constraint — nothing needs to move, whether the removal splits the component or not. Same rule applies when deleting a block removes several connections at once, even if that splits a component into more than two pieces. Any block left with zero remaining connections reverts to freely draggable.
- **Confirmation required**, same as every other delete — removing a connection is a delete action.

---

## Waiting

A project-level status, available on Active projects, expressing that a project can't move forward yet.

- **Entries, not one field.** A project can hold multiple independent Waiting entries at once.
- **Two entry types, chosen per entry:** free-typed text, or one or more tasks picked from *other* projects — never the project's own tasks. A single entry can hold several picked tasks; that entry only resolves once every one of them is Done.
- **Mutually exclusive with Focused.** A project can't be both. Turning one on requires turning the other off first.
- **Ready.** When every entry on a project is a picked-task entry (no free-text entries present) and every picked task across every entry is Done, the project is visually Ready — a read of the current state, not a separate transition to trigger. A project holding even one free-text entry never auto-reaches Ready; it's cleared manually, same as any note or task today.
- **Display: a foldable Waiting-list card on the block.** Folded, it shows a one-line preview and something making clear it's expandable. Expanded, it lists every entry. A picked-task entry whose task gets marked Done stays listed, struck-through, rather than disappearing — the card exists so nothing gets silently forgotten.
- **Fully independent of Connect.** Picking a task in a Waiting entry never creates a Connect line, and vice versa — a real dependency needs both set deliberately if you want it reflected both places.

---

## Focused

A project-level status, available only on Active projects, marking what's currently being worked on.

- **Unlimited.** Any number of projects can be Focused at once.
- **Cleared automatically on Done.** Marking a Focused project Done clears Focused with it.
- **Mutually exclusive with Waiting**, as above.
- **Focus screen.** A dedicated view listing every currently-Focused project. Clicking one jumps to its position on the Area canvas and opens its project popup directly. Doesn't yet surface an explicit "what's next" inside a project generally — that's a side effect of a step-by-step list existing inside it (see below), not a feature of the Focus screen itself.

---

## Project canvas

Double-clicking a Block still opens its popup — the popup itself is now resizable, like a normal window. No fullscreen mode, no separate tab (both exist in the fuller vision, both deliberately deferred). No projects-within-projects (also fuller-vision-only, also deferred).

Inside the popup is a freeform canvas — same placement model as Blocks on an Area, one level down. Two kinds of content live on it, placed anywhere:

**Lists.** A project can hold any number of Lists. Each is one of two kinds, chosen when it's created:
- **Step-by-step** — strictly ordered; a task can't be marked complete until the one before it is.
- **Flat** — a normal, unordered set of tasks, any order, any time.

Full CRUD on tasks within a list — add, edit, delete, mark complete — same as v1's task handling, just organized inside a List instead of one undifferentiated flat collection. A List has an optional title line.

**Notes.** Same behavior as Area-level notes — created empty and focused, discarded automatically if left empty, explicit delete with confirmation if it has real content — just living inside a project's popup instead of on the Area canvas.

No zoom or pan in this version. Watch for this becoming a real need if a project's popup starts feeling cramped once it has enough content on it — same shape of problem the box-expand fix just addressed, one level up.

---

## Filter

Three independent on/off toggles on the Area canvas — Active, Upcoming, Done — controlling which blocks are visible. No separate Waiting/Focused toggle; that distinction is carried by Visuals instead.

---

## Visuals

- **Content marker.** Any block holding anything — a task, a list, a note, regardless of type — gets a visual marker distinguishing it from a block that's still just a name. Purpose: never forget you put something inside a project.
- **Waiting.** A dimmed version of the block's normal Active color.
- **Ready.** Layered on top of a Waiting project once every condition for Ready is met (see Waiting, above) — a distinct badge or dot, not another outline, since it needs to be genuinely noticed rather than blended into the block's existing color state.
- **Focused.** An outline around the block.

---

## Explicitly not in v2

Everything v1 already deferred that this round didn't touch: Vision, Phase and everything built on it (timeline, End Phase, Plan Next Phase, breadcrumb, "back to current"), theming, and any visual design pass — the Visuals above are functional state markers, not an aesthetic pass.

New deferrals from this round, each tied to a real reason rather than dropped by default:
- **Task-level Waiting.** Only project-level Waiting exists. Revisit if a project ever has some tasks genuinely blocked while others on the same project aren't.
- **Shared tasks between blocks** — the same task existing in more than one place. Waiting's task-picker is the interim answer being tested first.
- **"Today"** — a daily working-set separate from Active/Focused. Deferred pending seeing how Focused resolves the same itch.
- **Explicit "next step" pointer** beyond what a step-by-step list already gives for free. Deferred pending seeing how the project canvas and Focus screen hold up in real use.
- **Projects-within-projects, zoom/pan, fullscreen/tab mode** for the project popup — all exist in the fuller vision, none needed yet.
- **Upcoming-level Waiting-equivalent** — distinguishing genuinely-blocked from just-deferred for non-Active projects. No live case currently needs it.
- Goal #3 from the original feedback ("write plans, structure them") and the residual OneNote overlap — still open, not yet clearly one need or two, low priority.
