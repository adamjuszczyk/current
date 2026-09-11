import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { List, ListKind } from '../types'
import { supabase } from './supabase'

// Server state for Lists, through TanStack Query — same pattern as
// src/lib/blocks.ts. Scoped per Block since that's always how they're
// read. Phase 3 generalises 2a.3's one-implicit-list stepping stone to
// real multi-list CRUD: kind picker + title at creation (kind is fixed
// afterwards — no update path for it, by design), drag, delete.
const listsKey = (blockId: string) => ['lists', blockId]

export function useLists(blockId: string | null) {
  return useQuery({
    queryKey: listsKey(blockId ?? ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lists')
        .select('*')
        .eq('block_id', blockId as string)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as List[]
    },
    enabled: blockId !== null,
  })
}

export function useCreateList() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      blockId,
      kind,
      title,
      x,
      y,
    }: {
      blockId: string
      kind: ListKind
      title: string
      x: number
      y: number
    }) => {
      const { data, error } = await supabase
        .from('lists')
        .insert({ block_id: blockId, kind, title, x, y })
        .select()
        .single()
      if (error) throw error
      return data as List
    },
    onSuccess: (_data, variables) => queryClient.invalidateQueries({ queryKey: listsKey(variables.blockId) }),
  })
}

// Persists a List's position on drag-drop (3.2), same shape as
// useUpdateBlockPosition/useUpdateNotePosition.
export function useUpdateListPosition() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, x, y }: { id: string; blockId: string; x: number; y: number }) => {
      const { error } = await supabase.from('lists').update({ x, y }).eq('id', id)
      if (error) throw error
    },
    onSuccess: (_data, variables) => queryClient.invalidateQueries({ queryKey: listsKey(variables.blockId) }),
  })
}

// List delete (3.8) — its Tasks are removed by the `on delete cascade` FK,
// nothing to hand-delete here, same reasoning as Area/Block delete.
export function useDeleteList() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string; blockId: string }) => {
      const { error } = await supabase.from('lists').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_data, variables) => queryClient.invalidateQueries({ queryKey: listsKey(variables.blockId) }),
  })
}
