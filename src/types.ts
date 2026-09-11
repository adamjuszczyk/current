// Row shapes mirroring supabase/migrations/0001_init.sql and, from Phase
// 2a, 0002_v2.sql's delta. Grows as later phases use more of that delta.
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
  focused: boolean
  created_at: string
}

// Tasks live in a List, not directly in a Block, as of 0002_v2.sql.
export interface Task {
  id: string
  list_id: string
  text: string
  completed: boolean
  created_at: string
}

export type ListKind = 'step' | 'flat'

export interface List {
  id: string
  block_id: string
  kind: ListKind
  title: string
  x: number
  y: number
  created_at: string
}

// A Note has exactly one parent: an Area (free notes) or a Block (project
// notes) — enforced by the notes_one_parent check constraint, so exactly
// one of these two is ever non-null on a given row.
export interface Note {
  id: string
  area_id: string | null
  block_id: string | null
  content: string
  x: number
  y: number
  created_at: string
}

export interface Connection {
  id: string
  area_id: string
  source_id: string
  target_id: string
  created_at: string
}

export type WaitingEntryKind = 'text' | 'tasks'

export interface WaitingEntry {
  id: string
  block_id: string
  kind: WaitingEntryKind
  text: string
  created_at: string
}

export interface WaitingEntryTask {
  entry_id: string
  task_id: string
}
