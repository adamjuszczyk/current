import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Task } from '../types'
import { supabase } from './supabase'

// Server state for Tasks, through TanStack Query — same pattern as
// src/lib/areas.ts and src/lib/blocks.ts. Scoped per Block, and always read
// as a flat, unordered list — no ordering column exists or is queried.
const tasksKey = (blockId: string) => ['tasks', blockId]

export function useTasks(blockId: string | null) {
  return useQuery({
    queryKey: tasksKey(blockId ?? ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('block_id', blockId as string)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as Task[]
    },
    enabled: blockId !== null,
  })
}

export function useCreateTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ blockId, text }: { blockId: string; text: string }) => {
      const { error } = await supabase.from('tasks').insert({ block_id: blockId, text })
      if (error) throw error
    },
    onSuccess: (_data, variables) => queryClient.invalidateQueries({ queryKey: tasksKey(variables.blockId) }),
  })
}

// Covers both inline text edits and the complete-toggle (4.3) — same shape,
// just different fields changed.
export function useUpdateTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      blockId: _blockId,
      ...changes
    }: {
      id: string
      blockId: string
      text?: string
      completed?: boolean
    }) => {
      const { error } = await supabase.from('tasks').update(changes).eq('id', id)
      if (error) throw error
    },
    onSuccess: (_data, variables) => queryClient.invalidateQueries({ queryKey: tasksKey(variables.blockId) }),
  })
}

export function useDeleteTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string; blockId: string }) => {
      const { error } = await supabase.from('tasks').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_data, variables) => queryClient.invalidateQueries({ queryKey: tasksKey(variables.blockId) }),
  })
}
