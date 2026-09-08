import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Area } from '../types'
import { supabase } from './supabase'

// Server state for Areas, through TanStack Query — no Area data lives in
// the Zustand uiStore, only which one is active.
const AREAS_KEY = ['areas']

export function useAreas() {
  return useQuery({
    queryKey: AREAS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('areas').select('*').order('created_at', { ascending: true })
      if (error) throw error
      return data as Area[]
    },
  })
}

export function useCreateArea() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase.from('areas').insert({ name }).select().single()
      if (error) throw error
      return data as Area
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: AREAS_KEY }),
  })
}

export function useUpdateArea() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from('areas').update({ name }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: AREAS_KEY }),
  })
}

export function useDeleteArea() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      // Blocks, tasks, and notes under this area are removed by the
      // `on delete cascade` foreign keys in the migration — nothing to
      // hand-delete here.
      const { error } = await supabase.from('areas').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: AREAS_KEY }),
  })
}
