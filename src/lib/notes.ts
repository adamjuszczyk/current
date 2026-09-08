import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Note } from '../types'
import { supabase } from './supabase'

// Server state for Notes, through TanStack Query — same pattern as
// src/lib/blocks.ts. Scoped per Area since that's always how they're read.
const notesKey = (areaId: string) => ['notes', areaId]

export function useNotes(areaId: string | null) {
  return useQuery({
    queryKey: notesKey(areaId ?? ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('area_id', areaId as string)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as Note[]
    },
    enabled: areaId !== null,
  })
}

// Creates an empty Note immediately (5.1) — no popup, content is typed in
// place afterward and saved on blur (5.2).
export function useCreateNote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ areaId, x, y }: { areaId: string; x: number; y: number }) => {
      const { data, error } = await supabase.from('notes').insert({ area_id: areaId, x, y }).select().single()
      if (error) throw error
      return data as Note
    },
    onSuccess: (_data, variables) => queryClient.invalidateQueries({ queryKey: notesKey(variables.areaId) }),
  })
}

// Persists a Note's position on drag-drop (5.2), same as useUpdateBlockPosition.
export function useUpdateNotePosition() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, x, y }: { id: string; areaId: string; x: number; y: number }) => {
      const { error } = await supabase.from('notes').update({ x, y }).eq('id', id)
      if (error) throw error
    },
    onSuccess: (_data, variables) => queryClient.invalidateQueries({ queryKey: notesKey(variables.areaId) }),
  })
}

// Content save on blur (5.2). Also used to persist a cleared-but-previously-
// non-empty note back to '' — that note is not discarded (5.3 vs 5.4).
export function useUpdateNoteContent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, content }: { id: string; areaId: string; content: string }) => {
      const { error } = await supabase.from('notes').update({ content }).eq('id', id)
      if (error) throw error
    },
    onSuccess: (_data, variables) => queryClient.invalidateQueries({ queryKey: notesKey(variables.areaId) }),
  })
}

// Covers both the silent auto-discard (5.3, never-had-content only) and the
// explicit confirm-gated delete (5.4) — same mutation, different caller.
export function useDeleteNote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string; areaId: string }) => {
      const { error } = await supabase.from('notes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_data, variables) => queryClient.invalidateQueries({ queryKey: notesKey(variables.areaId) }),
  })
}
