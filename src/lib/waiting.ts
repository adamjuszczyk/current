import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { WaitingEntry } from '../types'
import { supabase } from './supabase'

// A task can be held as a pick in a Waiting entry on any project — not
// just its own (3.5). Phase 3 built this inert, since nothing could
// populate waiting_entries/waiting_entry_tasks until Phase 4 built the
// entry UI below — it is live now.
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

// ============================================================
// Phase 4 — entries, and the Ready state derived from them.
// ============================================================

export interface WaitingEntryPick {
  taskId: string
  taskText: string
  completed: boolean
}

export interface WaitingEntryWithPicks extends WaitingEntry {
  picks: WaitingEntryPick[]
}

const waitingEntriesKey = (blockId: string) => ['waiting-entries', blockId]

type PickRow = {
  entry_id: string
  task_id: string
  tasks: { text: string; completed: boolean } | { text: string; completed: boolean }[] | null
}

function pickTask(tasks: PickRow['tasks']): { text: string; completed: boolean } | null {
  if (Array.isArray(tasks)) return tasks[0] ?? null
  return tasks
}

// Every entry on a project, each carrying its picks (empty for a 'text'
// entry, or whatever 'tasks' entry currently holds — including zero, the
// state a cascaded task delete leaves behind). 4.4's Ready is computed
// from exactly this shape, nothing more.
export function useWaitingEntries(blockId: string | null) {
  return useQuery({
    queryKey: waitingEntriesKey(blockId ?? ''),
    queryFn: async () => {
      const { data: entries, error } = await supabase
        .from('waiting_entries')
        .select('*')
        .eq('block_id', blockId as string)
        .order('created_at', { ascending: true })
      if (error) throw error

      const entryIds = (entries ?? []).map((e) => e.id)
      const picksByEntry = new Map<string, WaitingEntryPick[]>()
      if (entryIds.length > 0) {
        const { data: picks, error: picksError } = await supabase
          .from('waiting_entry_tasks')
          .select('entry_id, task_id, tasks(text, completed)')
          .in('entry_id', entryIds)
        if (picksError) throw picksError
        for (const p of (picks ?? []) as PickRow[]) {
          const task = pickTask(p.tasks)
          const list = picksByEntry.get(p.entry_id) ?? []
          list.push({ taskId: p.task_id, taskText: task?.text ?? '', completed: task?.completed ?? false })
          picksByEntry.set(p.entry_id, list)
        }
      }

      return ((entries ?? []) as WaitingEntry[]).map((entry) => ({
        ...entry,
        picks: picksByEntry.get(entry.id) ?? [],
      })) as WaitingEntryWithPicks[]
    },
    enabled: blockId !== null,
  })
}

// 4.1: a project is Waiting exactly while it holds at least one entry.
export function isProjectWaiting(entries: WaitingEntryWithPicks[]): boolean {
  return entries.length > 0
}

// 4.4: Ready, derived on read, never stored. Both "at least one" clauses
// below are load-bearing, guarding against a vacuous truth: without the
// first, zero entries would read as Ready; without the second, so would
// an entry that lost its last pick to a cascaded task delete and was
// never tidied away (3.5 tidies it client-side, but this must not depend
// on that having happened).
export function isProjectReady(entries: WaitingEntryWithPicks[]): boolean {
  if (entries.length === 0) return false
  return entries.every((e) => e.kind === 'tasks' && e.picks.length > 0 && e.picks.every((p) => p.completed))
}

// 4.5: what's still outstanding, one reason per entry that isn't Ready —
// empty exactly when the project is Ready (or not Waiting at all), so a
// caller can gate a status change purely off whether this is non-empty.
export function describeOutstanding(entries: WaitingEntryWithPicks[]): string[] {
  const reasons: string[] = []
  for (const entry of entries) {
    if (entry.kind === 'text') {
      const preview = entry.text.length > 40 ? `${entry.text.slice(0, 40)}…` : entry.text
      reasons.push(`a free-text entry ("${preview}")`)
    } else if (entry.picks.length === 0) {
      reasons.push('a picked-task entry with no tasks selected')
    } else {
      const remaining = entry.picks.filter((p) => !p.completed).length
      if (remaining > 0) {
        reasons.push(`${remaining} task${remaining === 1 ? '' : 's'} not yet done in a picked-task entry`)
      }
    }
  }
  return reasons
}

// Creates an entry (4.1, 4.2): 'text' carries free-typed text and no
// picks; 'tasks' carries one or more picked tasks and resolves only once
// every one of them is Done (4.4). Both writes happen here so a caller
// never has to sequence them itself, the same shape as useCreateBlock's
// block-plus-tasks insert.
export function useCreateWaitingEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (
      params: { blockId: string } & ({ kind: 'text'; text: string } | { kind: 'tasks'; taskIds: string[] }),
    ) => {
      const { data: entry, error } = await supabase
        .from('waiting_entries')
        .insert({
          block_id: params.blockId,
          kind: params.kind,
          text: params.kind === 'text' ? params.text : '',
        })
        .select()
        .single()
      if (error) throw error

      if (params.kind === 'tasks' && params.taskIds.length > 0) {
        const { error: picksError } = await supabase
          .from('waiting_entry_tasks')
          .insert(params.taskIds.map((taskId) => ({ entry_id: entry.id, task_id: taskId })))
        if (picksError) throw picksError
      }

      return entry as WaitingEntry
    },
    onSuccess: (_data, variables) =>
      queryClient.invalidateQueries({ queryKey: waitingEntriesKey(variables.blockId) }),
  })
}

// 4.9: entry delete, gated by the confirm dialog at the call site — this
// is deleting a Waiting entry directly, distinct from a pick disappearing
// because its task was deleted at the task's own source (3.5, above),
// which never raises a second confirmation.
export function useDeleteWaitingEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string; blockId: string }) => {
      const { error } = await supabase.from('waiting_entries').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_data, variables) =>
      queryClient.invalidateQueries({ queryKey: waitingEntriesKey(variables.blockId) }),
  })
}

export interface PickableTask {
  id: string
  text: string
  completed: boolean
  blockId: string
  blockName: string
}

// 4.3: candidates for the task picker — every task in every *other* block
// in the *same* Area, and nothing else. Never the project's own tasks,
// never another Area's. Two blocking reads rather than one PostgREST
// embed across lists->blocks, matching this file's existing style
// (findWaitingHolds above), and cheap: a pick and the task it points at
// always live in the same Area, so no cross-Area read is ever needed.
export function usePickableTasks(areaId: string | null, excludeBlockId: string | null) {
  return useQuery({
    queryKey: ['pickable-tasks', areaId ?? '', excludeBlockId ?? ''],
    queryFn: async () => {
      const { data: blocks, error: blocksError } = await supabase
        .from('blocks')
        .select('id, name')
        .eq('area_id', areaId as string)
        .neq('id', excludeBlockId as string)
      if (blocksError) throw blocksError
      const blockIds = (blocks ?? []).map((b) => b.id as string)
      if (blockIds.length === 0) return [] as PickableTask[]
      const blockNameById = new Map((blocks ?? []).map((b) => [b.id as string, b.name as string]))

      const { data: lists, error: listsError } = await supabase
        .from('lists')
        .select('id, block_id')
        .in('block_id', blockIds)
      if (listsError) throw listsError
      const listIds = (lists ?? []).map((l) => l.id as string)
      if (listIds.length === 0) return [] as PickableTask[]
      const blockIdByListId = new Map((lists ?? []).map((l) => [l.id as string, l.block_id as string]))

      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('id, text, completed, list_id, created_at')
        .in('list_id', listIds)
        .order('created_at', { ascending: true })
      if (tasksError) throw tasksError

      return (tasks ?? []).map((t) => {
        const blockId = blockIdByListId.get(t.list_id as string) as string
        return {
          id: t.id as string,
          text: t.text as string,
          completed: t.completed as boolean,
          blockId,
          blockName: blockNameById.get(blockId) ?? '',
        }
      }) as PickableTask[]
    },
    enabled: areaId !== null && excludeBlockId !== null,
  })
}
