import { supabase } from './supabase'

// A task can be held as a pick in a Waiting entry on any project — not
// just its own (3.5). Nothing can populate waiting_entries/waiting_entry_
// tasks until Phase 4 builds the entry UI, so this is inert on its own
// build: every call here returns []. It has to be correct now anyway,
// since it becomes live the moment Phase 4 ships and must not need
// revisiting.
export interface WaitingHold {
  entryId: string
  blockId: string
  blockName: string
  // True if this task is the entry's only remaining pick — removing it
  // leaves the entry with none, which is when the entry itself goes too.
  isLastPick: boolean
}

type EntryRow = {
  id: string
  block_id: string
  blocks: { name: string } | { name: string }[] | null
}

function blockName(blocks: EntryRow['blocks']): string {
  if (Array.isArray(blocks)) return blocks[0]?.name ?? ''
  return blocks?.name ?? ''
}

export async function findWaitingHolds(taskId: string): Promise<WaitingHold[]> {
  const { data: picks, error: picksError } = await supabase
    .from('waiting_entry_tasks')
    .select('entry_id')
    .eq('task_id', taskId)
  if (picksError) throw picksError
  if (!picks || picks.length === 0) return []

  const entryIds = [...new Set(picks.map((p) => p.entry_id as string))]

  const { data: entries, error: entriesError } = await supabase
    .from('waiting_entries')
    .select('id, block_id, blocks(name)')
    .in('id', entryIds)
  if (entriesError) throw entriesError

  const { data: allPicks, error: allPicksError } = await supabase
    .from('waiting_entry_tasks')
    .select('entry_id, task_id')
    .in('entry_id', entryIds)
  if (allPicksError) throw allPicksError

  return ((entries ?? []) as EntryRow[]).map((entry) => {
    const picksForEntry = (allPicks ?? []).filter((p) => p.entry_id === entry.id)
    return {
      entryId: entry.id,
      blockId: entry.block_id,
      blockName: blockName(entry.blocks),
      isLastPick: picksForEntry.length <= 1,
    }
  })
}

// Called after the task itself is deleted — its own pick rows cascade away
// with it (waiting_entry_tasks.task_id references tasks on delete cascade),
// but an entry that just lost its last pick does not remove itself. This
// is the "goes with it, automatically" half of 3.5.
export async function removeEmptiedWaitingEntries(holds: WaitingHold[]): Promise<void> {
  const ids = holds.filter((h) => h.isLastPick).map((h) => h.entryId)
  if (ids.length === 0) return
  const { error } = await supabase.from('waiting_entries').delete().in('id', ids)
  if (error) throw error
}
