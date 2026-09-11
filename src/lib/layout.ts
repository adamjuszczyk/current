// Pure graph/layout functions for Connect (Phase 6). Kept free of
// Supabase/React so the algorithm itself — the hard part of this phase —
// can be reasoned about (and, in review, re-derived) without the data
// layer around it.

export const COLUMN_PITCH = 220
export const ROW_PITCH = 110

export interface EdgeLike {
  source_id: string
  target_id: string
}

export interface BlockLike {
  id: string
  x: number
  y: number
}

function undirectedAdjacency(edges: EdgeLike[]): Map<string, string[]> {
  const adjacency = new Map<string, string[]>()
  for (const e of edges) {
    if (!adjacency.has(e.source_id)) adjacency.set(e.source_id, [])
    if (!adjacency.has(e.target_id)) adjacency.set(e.target_id, [])
    adjacency.get(e.source_id)!.push(e.target_id)
    adjacency.get(e.target_id)!.push(e.source_id)
  }
  return adjacency
}

// 6.6: "every block reachable through any connection, in either
// direction" — the component a drag or a merge-size comparison operates
// on. A block with no connections is its own component of one.
export function buildComponent(start: string, edges: EdgeLike[]): Set<string> {
  const adjacency = undirectedAdjacency(edges)
  const seen = new Set<string>([start])
  const queue = [start]
  while (queue.length > 0) {
    const current = queue.shift()!
    for (const next of adjacency.get(current) ?? []) {
      if (!seen.has(next)) {
        seen.add(next)
        queue.push(next)
      }
    }
  }
  return seen
}

// 6.3: true when `targetId` can already reach `sourceId` by following
// existing *directed* connections — i.e. adding sourceId -> targetId would
// complete a cycle. Enforced here because Postgres cannot express
// reachability in a check constraint.
export function wouldCreateCycle(edges: EdgeLike[], sourceId: string, targetId: string): boolean {
  const outgoing = new Map<string, string[]>()
  for (const e of edges) {
    if (!outgoing.has(e.source_id)) outgoing.set(e.source_id, [])
    outgoing.get(e.source_id)!.push(e.target_id)
  }
  const seen = new Set<string>([targetId])
  const queue = [targetId]
  while (queue.length > 0) {
    const current = queue.shift()!
    if (current === sourceId) return true
    for (const next of outgoing.get(current) ?? []) {
      if (!seen.has(next)) {
        seen.add(next)
        queue.push(next)
      }
    }
  }
  return false
}

// Every block reachable from `start` by following *directed* edges
// forward (start included) — used to shift a whole downstream chain by a
// uniform delta without disturbing anything upstream of it or on an
// unrelated branch.
function directedDescendants(start: string, edges: EdgeLike[]): Set<string> {
  const outgoing = new Map<string, string[]>()
  for (const e of edges) {
    if (!outgoing.has(e.source_id)) outgoing.set(e.source_id, [])
    outgoing.get(e.source_id)!.push(e.target_id)
  }
  const seen = new Set<string>([start])
  const queue = [start]
  while (queue.length > 0) {
    const current = queue.shift()!
    for (const next of outgoing.get(current) ?? []) {
      if (!seen.has(next)) {
        seen.add(next)
        queue.push(next)
      }
    }
  }
  return seen
}

export interface PositionUpdate {
  id: string
  x: number
  y: number
}

// A newly-placed anchor landing exactly on an existing block's slot (e.g.
// a lone block merged onto a connection that targets the *middle* of an
// existing chain, landing on the same column as an existing neighbour) is
// nudged down/up by whole rows until it's clear.
function findFreeRow(x: number, y: number, occupied: BlockLike[]): number {
  const collides = (candidateY: number) =>
    occupied.some((b) => Math.abs(b.x - x) < COLUMN_PITCH / 2 && Math.abs(b.y - candidateY) < ROW_PITCH / 2)
  if (!collides(y)) return y
  for (let k = 1; k < 50; k++) {
    if (!collides(y + k * ROW_PITCH)) return y + k * ROW_PITCH
    if (!collides(y - k * ROW_PITCH)) return y - k * ROW_PITCH
  }
  return y
}

// 6.5 / 6.7: what a new connection sourceId -> targetId does to positions.
// Returns only the blocks that must move — never the winning side of a
// merge, and never anything upstream of the new edge.
//
// Two cases:
//
// 1. sourceId and targetId are already in the same component. 6.7 only
//    describes *merges* of two previously separate components, so this
//    case isn't named by the spec. The conservative reading applied here:
//    move only what the new edge strictly requires — targetId and
//    everything downstream of it, shifted right by a uniform delta just
//    large enough to keep targetId to the right of sourceId (6.1's
//    left-to-right meaning) — and leave every other block, including
//    anything upstream of targetId or on an unrelated branch, untouched.
//    A connection that doesn't need the room (target is already far
//    enough right) moves nothing at all.
//
// 2. sourceId and targetId belong to two different components — a real
//    merge. The larger component (by block count; ties go to the
//    upstream/source side, which also covers the base case of two
//    previously unconnected blocks) keeps every one of its blocks at
//    their exact existing coordinates — never touched, never recomputed —
//    and the smaller component is rigidly translated (its own existing
//    internal shape preserved exactly, not reshaped) so its bridge
//    endpoint lands one column-pitch from the surviving side's bridge
//    endpoint, on the same row unless that would land on an existing
//    block, in which case it's nudged to the next free row.
export function computeConnectionLayout({
  blocks,
  edges,
  sourceId,
  targetId,
}: {
  blocks: BlockLike[]
  edges: EdgeLike[]
  sourceId: string
  targetId: string
}): PositionUpdate[] {
  const byId = new Map(blocks.map((b) => [b.id, b]))
  const source = byId.get(sourceId)
  const target = byId.get(targetId)
  if (!source || !target) return []

  const sourceComponent = buildComponent(sourceId, edges)

  if (sourceComponent.has(targetId)) {
    const requiredX = source.x + COLUMN_PITCH
    const shift = requiredX - target.x
    if (shift <= 0) return []
    const toShift = directedDescendants(targetId, edges)
    const updates: PositionUpdate[] = []
    for (const id of toShift) {
      const block = byId.get(id)
      if (!block) continue
      updates.push({ id, x: block.x + shift, y: block.y })
    }
    return updates
  }

  const targetComponent = buildComponent(targetId, edges)
  const sourceWins = sourceComponent.size >= targetComponent.size
  const winnerComponent = sourceWins ? sourceComponent : targetComponent
  const loserComponent = sourceWins ? targetComponent : sourceComponent
  const loserAnchorId = sourceWins ? targetId : sourceId
  const loserAnchor = byId.get(loserAnchorId)!

  const requiredAnchorX = sourceWins ? source.x + COLUMN_PITCH : target.x - COLUMN_PITCH
  const requiredAnchorY = sourceWins ? source.y : target.y
  const winnerBlocks = blocks.filter((b) => winnerComponent.has(b.id))
  const finalAnchorY = findFreeRow(requiredAnchorX, requiredAnchorY, winnerBlocks)

  const dx = requiredAnchorX - loserAnchor.x
  const dy = finalAnchorY - loserAnchor.y
  if (dx === 0 && dy === 0) return []

  const updates: PositionUpdate[] = []
  for (const id of loserComponent) {
    const block = byId.get(id)
    if (!block) continue
    updates.push({ id, x: block.x + dx, y: block.y + dy })
  }
  return updates
}
