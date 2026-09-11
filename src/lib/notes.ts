import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Note } from '../types'
import { supabase } from './supabase'

// A Note has exactly one parent (notes_one_parent, added in 0002_v2.sql):
// an Area (free notes, today's only UI) or a Block (project notes, wired
// up by Phase 3's project canvas). These hooks take whichever parent a
// caller has, so the same code path already works for both once Phase 3
// starts creating block-level notes — nothing here renders that UI yet.
export type NoteParent = { areaId: string } | { blockId: string }

export function noteParent(note: Note): NoteParent {
  return note.area_id !== null ? { areaId: note.area_id } : { blockId: note.block_id as string }
}

function parentColumn(parent: NoteParent): { column: 'area_id' | 'block_id'; value: string } {
  return 'areaId' in parent ? { column: 'area_id', value: parent.areaId } : { column: 'block_id', value: parent.blockId }
}

const notesKey = (parent: NoteParent) => {
  const { column, value } = parentColumn(parent)
  return ['notes', column, value]
}

export function useNotes(parent: NoteParent | null) {
  return useQuery({
    queryKey: parent ? notesKey(parent) : ['notes', 'none', ''],
    queryFn: async () => {
      const { column, value } = parentColumn(parent as NoteParent)
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq(column, value)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as Note[]
    },
    enabled: parent !== null,
  })
}

// Creates an empty Note immediately (5.1) — no popup, content is typed in
// place afterward and saved on blur (5.2).
export function useCreateNote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ parent, x, y }: { parent: NoteParent; x: number; y: number }) => {
      const { column, value } = parentColumn(parent)
      const { data, error } = await supabase
        .from('notes')
        .insert({ [column]: value, x, y })
        .select()
        .single()
      if (error) throw error
      return data as Note
    },
    onSuccess: (_data, variables) => queryClient.invalidateQueries({ queryKey: notesKey(variables.parent) }),
  })
}

// Persists a Note's position on drag-drop (5.2), same as useUpdateBlockPosition.
export function useUpdateNotePosition() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, x, y }: { id: string; parent: NoteParent; x: number; y: number }) => {
      const { error } = await supabase.from('notes').update({ x, y }).eq('id', id)
      if (error) throw error
    },
    onSuccess: (_data, variables) => queryClient.invalidateQueries({ queryKey: notesKey(variables.parent) }),
  })
}

// Content save on blur (5.2). Also used to persist a cleared-but-previously-
// non-empty note back to '' — that note is not discarded (5.3 vs 5.4).
export function useUpdateNoteContent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, content }: { id: string; parent: NoteParent; content: string }) => {
      const { error } = await supabase.from('notes').update({ content }).eq('id', id)
      if (error) throw error
    },
    onSuccess: (_data, variables) => queryClient.invalidateQueries({ queryKey: notesKey(variables.parent) }),
  })
}

// Covers both the silent auto-discard (5.3, never-had-content only) and the
// explicit confirm-gated delete (5.4) — same mutation, different caller.
export function useDeleteNote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string; parent: NoteParent }) => {
      const { error } = await supabase.from('notes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_data, variables) => queryClient.invalidateQueries({ queryKey: notesKey(variables.parent) }),
  })
}
