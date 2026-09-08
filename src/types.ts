// Row shapes mirroring supabase/migrations/0001_init.sql. Grows as later
// phases add Blocks, Tasks, and Notes.
export interface Area {
  id: string
  name: string
  created_at: string
}
