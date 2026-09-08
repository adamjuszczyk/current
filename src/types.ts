// Row shapes mirroring supabase/migrations/0001_init.sql. Grows as later
// phases add Notes.
export interface Area {
  id: string
  name: string
  created_at: string
}

export type BlockStatus = 'upcoming' | 'active' | 'done'

export interface Block {
  id: string
  area_id: string
  name: string
  status: BlockStatus
  x: number
  y: number
  created_at: string
}

export interface Task {
  id: string
  block_id: string
  text: string
  completed: boolean
  created_at: string
}

export interface Note {
  id: string
  area_id: string
  content: string
  x: number
  y: number
  created_at: string
}
