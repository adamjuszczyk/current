import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Block, Connection } from '../types'
import { blocksKey } from './blocks'
import { computeConnectionLayout, wouldCreateCycle, type PositionUpdate } from './layout'
import { settled } from './settled'
import { supabase } from './supabase'

// Server state for Connections (6.1-6.4), through TanStack Query — same
// pattern as src/lib/blocks.ts. Scoped per Area, same as Blocks: a
// connection never crosses Areas (6.1), and the canvas loads every
// connection in an Area on every render.
const connectionsKey = (areaId: string) => ['connections', areaId]

export function useConnections(areaId: string | null) {
  return useQuery({
    queryKey: connectionsKey(areaId ?? ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('connections')
        .select('*')
        .eq('area_id', areaId as string)
      if (error) throw error
      return data as Connection[]
    },
    enabled: areaId !== null,
  })
}

export interface ConnectionRefusal {
  reason: string
}

// 6.3: client-side acyclicity, plus the two trivial cases the database
// already refuses (self-edge, duplicate) checked here too so the refusal
// carries a real message instead of a raw Postgres constraint error. Call
// this before useCreateConnection().mutate — a refusal here means mutate
// is never called, so no row is ever written for a refused attempt.
export function checkConnection({
  connections,
  blocks,
  sourceId,
  targetId,
}: {
  connections: Connection[]
  blocks: { id: string; name: string }[]
  sourceId: string
  targetId: string
}): ConnectionRefusal | null {
  if (sourceId === targetId) return { reason: "A block can't connect to itself." }
  if (connections.some((c) => c.source_id === sourceId && c.target_id === targetId)) {
    return { reason: 'That connection already exists.' }
  }
  const edges = connections.map((c) => ({ source_id: c.source_id, target_id: c.target_id }))
  if (wouldCreateCycle(edges, sourceId, targetId)) {
    const targetName = blocks.find((b) => b.id === targetId)?.name ?? 'That block'
    const sourceName = blocks.find((b) => b.id === sourceId)?.name ?? 'that block'
    return { reason: `Can't connect: "${targetName}" already reaches "${sourceName}", so this would create a cycle.` }
  }
  return null
}

// 6.4/6.5/6.7: creates the connection and, in the same mutation, writes
// whatever position updates the caller computed via computeConnectionLayout
// (src/lib/layout.ts) — the edge and the layout it implies land together,
// so a reload never shows one without the other. positionUpdates is often
// empty (the merge's winning side never moves).
export function useCreateConnection() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      areaId,
      sourceId,
      targetId,
      positionUpdates,
    }: {
      areaId: string
      sourceId: string
      targetId: string
      positionUpdates: PositionUpdate[]
    }) => {
      const { data, error } = await supabase
        .from('connections')
        .insert({ area_id: areaId, source_id: sourceId, target_id: targetId })
        .select()
        .single()
      if (error) throw error

      if (positionUpdates.length > 0) {
        const results = await Promise.all(
          positionUpdates.map((u) => supabase.from('blocks').update({ x: u.x, y: u.y }).eq('id', u.id)),
        )
        const failed = results.find((r) => r.error)
        if (failed?.error) throw failed.error
      }

      return data as Connection
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: connectionsKey(variables.areaId) })
      queryClient.invalidateQueries({ queryKey: blocksKey(variables.areaId) })
    },
  })
}

// 6.1-6.3: the click-to-connect flow itself, as one function BlockCard
// calls on the second click. Checks run against the caller's already-
// loaded blocks and connections, so a refusal never calls the mutation and
// never writes a row.
export function useConnectBlocks(areaId: string) {
  const createConnection = useCreateConnection()

  return async function connect({
    sourceId,
    targetId,
    blocks,
    connections,
    onRefused,
  }: {
    sourceId: string
    targetId: string
    blocks: Block[]
    connections: Connection[]
    onRefused: (reason: string) => void
  }) {
    const refusal = checkConnection({
      connections,
      blocks: blocks.map((b) => ({ id: b.id, name: b.name })),
      sourceId,
      targetId,
    })
    if (refusal) {
      onRefused(refusal.reason)
      return
    }
    const edges = connections.map((c) => ({ source_id: c.source_id, target_id: c.target_id }))
    const positionUpdates = computeConnectionLayout({
      blocks: blocks.map((b) => ({ id: b.id, x: b.x, y: b.y })),
      edges,
      sourceId,
      targetId,
    })
    await settled(createConnection.mutateAsync({ areaId, sourceId, targetId, positionUpdates }))
  }
}

// 6.8/6.9: a delete, confirm-gated at the call site like every other
// delete in the app. Repositions nothing — no position write here at all,
// per 6.8 ("a layout that satisfied a graph still satisfies it with one
// constraint fewer").
export function useDeleteConnection() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string; areaId: string }) => {
      const { error } = await supabase.from('connections').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: connectionsKey(variables.areaId) })
      queryClient.invalidateQueries({ queryKey: blocksKey(variables.areaId) })
    },
  })
}
