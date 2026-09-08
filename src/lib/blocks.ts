import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Block, BlockStatus } from '../types'
import { supabase } from './supabase'

// Server state for Blocks, through TanStack Query — same pattern as
// src/lib/areas.ts. Scoped per Area since that's always how they're read.
const blocksKey = (areaId: string) => ['blocks', areaId]

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
// in the same popup (3.3). Tasks are plain inserts — no ordering column.
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
        const { error: taskError } = await supabase
          .from('tasks')
          .insert(taskTexts.map((text) => ({ block_id: block.id, text })))
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

// Name and status edits from the Block popup (4.1, 4.2). Status is only
// ever set here, manually — nothing infers it from task completion.
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
    }) => {
      const { error } = await supabase.from('blocks').update(changes).eq('id', id)
      if (error) throw error
    },
    onSuccess: (_data, variables) => queryClient.invalidateQueries({ queryKey: blocksKey(variables.areaId) }),
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
    onSuccess: (_data, variables) => queryClient.invalidateQueries({ queryKey: blocksKey(variables.areaId) }),
  })
}
