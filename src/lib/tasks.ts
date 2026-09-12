import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Task } from '../types'
import { supabase } from './supabase'

// Server state for Tasks, through TanStack Query — same pattern as
// src/lib/areas.ts and src/lib/blocks.ts. Scoped per List (0002_v2.sql
// moved tasks from blocks into lists), and always read as a flat,
// unordered list — no ordering column exists or is queried.
const tasksKey = (listId: string) => ['tasks', listId]

export function useTasks(listId: string | null) {
  return useQuery({
    queryKey: tasksKey(listId ?? ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('list_id', listId as string)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as Task[]
    },
    enabled: listId !== null,
  })
}

export function useCreateTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ listId, text }: { listId: string; text: string }) => {
      const { error } = await supabase.from('tasks').insert({ list_id: listId, text })
      if (error) throw error
    },
    onSuccess: (_data, variables) => queryClient.invalidateQueries({ queryKey: tasksKey(variables.listId) }),
  })
}

// Covers both inline text edits and the complete-toggle (4.3) — same shape,
// just different fields changed. A task's completed state can be shown on
// any project's Waiting card, via a pick — not just its own list — so a
// completion toggle also invalidates every waiting-entries query (Phase 4),
// not only this task's own list. Broad rather than scoped to the one
// project actually holding the pick, since which project(s) that is isn't
// known here without an extra read, and the extra invalidations are cheap.
export function useUpdateTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      listId: _listId,
      ...changes
    }: {
      id: string
      listId: string
      text?: string
      completed?: boolean
    }) => {
      const { error } = await supabase.from('tasks').update(changes).eq('id', id)
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tasksKey(variables.listId) })
      queryClient.invalidateQueries({ queryKey: ['waiting-entries'] })
    },
  })
}

export function useDeleteTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string; listId: string }) => {
      const { error } = await supabase.from('tasks').delete().eq('id', id)
      if (error) throw error
    },
    // A deleted task can still be a non-last pick on some other project's
    // entry (removeEmptiedWaitingEntries only removes the entry when it
    // was the *last* pick) — that entry's own waiting-entries query needs
    // invalidating too, same reasoning as useUpdateTask above.
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tasksKey(variables.listId) })
      queryClient.invalidateQueries({ queryKey: ['waiting-entries'] })
    },
  })
}
