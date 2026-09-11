import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { List, ListKind } from '../types'
import { supabase } from './supabase'

// Server state for Lists, through TanStack Query — same pattern as
// src/lib/blocks.ts. Scoped per Block since that's always how they're
// read. This is 2a.3's stepping stone: no list CRUD UI exists yet, so the
// only writer is BlockCreatePopup's quick-capture and BlockEditPopup's
// lazy "create the block's one untitled Flat list on first task added"
// path (Phase 3 adds the rest — kind picker, title, drag, delete).
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
