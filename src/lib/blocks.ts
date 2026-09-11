import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Block, BlockStatus } from '../types'
import { supabase } from './supabase'

// Server state for Blocks, through TanStack Query — same pattern as
// src/lib/areas.ts. Scoped per Area since that's always how they're read.
const blocksKey = (areaId: string) => ['blocks', areaId]

// 5.5: every Focused block across every Area — the Focus screen's own
// query, separate from the per-Area blocksKey above since it deliberately
// is not scoped to one.
const FOCUSED_BLOCKS_KEY = ['focused-blocks']

export function useBlocks(areaId: string | null) {
  return useQuery({
    queryKey: blocksKey(areaId ?? ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blocks')
        .select('*')
        .eq('area_id', areaId as string)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as Block[]
    },
    enabled: areaId !== null,
  })
}

// Creates a Block plus, optionally, the Tasks quick-captured alongside it
// in the same popup (3.3). Tasks now live in a List (0002_v2.sql), so a
// non-empty quick-capture creates one untitled Flat list at the same fixed
// origin the 2a.1 data migration used for existing blocks, and puts the
// tasks in it — the two paths agree on purpose. An empty quick-capture
// creates no list, matching a block with no tasks getting no list.
export function useCreateBlock() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      areaId,
      name,
      x,
      y,
      taskTexts,
    }: {
      areaId: string
      name: string
      x: number
      y: number
      taskTexts: string[]
    }) => {
      const { data: block, error } = await supabase
        .from('blocks')
        .insert({ area_id: areaId, name, x, y })
        .select()
        .single()
      if (error) throw error

      if (taskTexts.length > 0) {
        const { data: list, error: listError } = await supabase
          .from('lists')
          .insert({ block_id: block.id, kind: 'flat', title: '', x: 24, y: 24 })
          .select()
          .single()
        if (listError) throw listError

        const { error: taskError } = await supabase
          .from('tasks')
          .insert(taskTexts.map((text) => ({ list_id: list.id, text })))
        if (taskError) throw taskError
      }

      return block as Block
    },
    onSuccess: (_data, variables) => queryClient.invalidateQueries({ queryKey: blocksKey(variables.areaId) }),
  })
}

// Persists a Block's position on drag-drop (3.2). Nothing else about a
// Block changes here — status/name editing is Phase 4.
export function useUpdateBlockPosition() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, x, y }: { id: string; areaId: string; x: number; y: number }) => {
      const { error } = await supabase.from('blocks').update({ x, y }).eq('id', id)
      if (error) throw error
    },
    onSuccess: (_data, variables) => queryClient.invalidateQueries({ queryKey: blocksKey(variables.areaId) }),
  })
}

// Name, status and Focused edits from the Block popup (4.1, 4.2, 5.1).
// Status is only ever set here, manually — nothing infers it from task
// completion. Focused (5.1-5.3) is just another column written the same
// way; the mutual-exclusion refusal (5.2) and the Done-clears-it rule
// (5.3) are decided by the caller before this is invoked, not here.
export function useUpdateBlock() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      areaId: _areaId,
      ...changes
    }: {
      id: string
      areaId: string
      name?: string
      status?: BlockStatus
      focused?: boolean
    }) => {
      const { error } = await supabase.from('blocks').update(changes).eq('id', id)
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: blocksKey(variables.areaId) })
      queryClient.invalidateQueries({ queryKey: FOCUSED_BLOCKS_KEY })
    },
  })
}

// Block delete (4.5) — its Tasks are removed by the `on delete cascade` FK,
// nothing to hand-delete here.
export function useDeleteBlock() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string; areaId: string }) => {
      const { error } = await supabase.from('blocks').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: blocksKey(variables.areaId) })
      queryClient.invalidateQueries({ queryKey: FOCUSED_BLOCKS_KEY })
    },
  })
}

export interface FocusedBlock extends Block {
  areaName: string
}

type BlockWithArea = Block & {
  areas: { name: string } | { name: string }[] | null
}

function areaName(areas: BlockWithArea['areas']): string {
  if (Array.isArray(areas)) return areas[0]?.name ?? ''
  return areas?.name ?? ''
}

// 5.5: every currently-Focused project, across every Area — not scoped to
// the active one, since that's the whole point of the Focus screen. The
// Area name comes along via the FK embed so the screen can group by it
// without a second round trip.
export function useFocusedBlocks() {
  return useQuery({
    queryKey: FOCUSED_BLOCKS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blocks')
        .select('*, areas(name)')
        .eq('focused', true)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data as BlockWithArea[]).map(({ areas, ...block }) => ({
        ...block,
        areaName: areaName(areas),
      })) as FocusedBlock[]
    },
  })
}
