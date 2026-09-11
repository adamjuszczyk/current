import { useState } from 'react'
import type { FormEvent } from 'react'
import { settled } from '../lib/settled'
import { useCreateWaitingEntry, usePickableTasks } from '../lib/waiting'
import type { WaitingEntryKind } from '../types'
import { AutoGrowTextarea } from './AutoGrowTextarea'
import { Popup } from './Popup'

const KINDS: { value: WaitingEntryKind; label: string }[] = [
  { value: 'text', label: 'Free text' },
  { value: 'tasks', label: 'Picked tasks' },
]

// Opened by "+ Waiting entry" inside a project popup, only while the
// project is Active (4.1). Two entry types (4.2): free-typed text, or one
// or more picked tasks — the picker (4.3) only ever offers tasks from
// *other* projects in the *same* Area, never this project's own tasks and
// never another Area's, so it reads `usePickableTasks(areaId, blockId)`
// rather than anything scoped to this block.
export function WaitingEntryCreatePopup({
  areaId,
  blockId,
  onClose,
}: {
  areaId: string
  blockId: string
  onClose: () => void
}) {
  const [kind, setKind] = useState<WaitingEntryKind>('text')
  const [text, setText] = useState('')
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([])
  const { data: pickable = [], isError: pickableFailed } = usePickableTasks(areaId, blockId)
  const createEntry = useCreateWaitingEntry()

  function toggleTask(taskId: string, checked: boolean) {
    setSelectedTaskIds((ids) => (checked ? [...ids, taskId] : ids.filter((id) => id !== taskId)))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (kind === 'text') {
      const trimmed = text.trim()
      if (!trimmed) return
      if (!(await settled(createEntry.mutateAsync({ blockId, kind: 'text', text: trimmed }))).ok) return
    } else {
      if (selectedTaskIds.length === 0) return
      if (!(await settled(createEntry.mutateAsync({ blockId, kind: 'tasks', taskIds: selectedTaskIds }))).ok) return
    }
    onClose()
  }

  const grouped = new Map<string, typeof pickable>()
  for (const task of pickable) {
    const forBlock = grouped.get(task.blockName) ?? []
    forBlock.push(task)
    grouped.set(task.blockName, forBlock)
  }

  const canSubmit = kind === 'text' ? text.trim() !== '' : selectedTaskIds.length > 0

  return (
    <Popup onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex w-80 flex-col gap-3">
        <p className="text-sm font-medium">New Waiting entry</p>

        <div className="flex gap-2">
          {KINDS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setKind(value)}
              aria-pressed={kind === value}
              className={`flex-1 border px-2 py-1 text-sm ${kind === value ? 'bg-black text-white' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>

        {kind === 'text' ? (
          <AutoGrowTextarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What are you waiting on?"
            autoFocus
            className="border px-2 py-1 text-sm"
          />
        ) : (
          <div className="flex max-h-64 flex-col gap-3 overflow-auto">
            {pickableFailed && <p className="text-sm text-red-700">Couldn&apos;t load other projects&apos; tasks.</p>}
            {!pickableFailed && pickable.length === 0 && (
              <p className="text-sm text-gray-500">No tasks in other projects in this Area yet.</p>
            )}
            {[...grouped.entries()].map(([blockName, tasks]) => (
              <div key={blockName} className="flex flex-col gap-1">
                <p className="text-xs font-medium text-gray-600">{blockName}</p>
                {tasks.map((task) => (
                  <label key={task.id} className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedTaskIds.includes(task.id)}
                      onChange={(e) => toggleTask(task.id, e.target.checked)}
                      className="mt-1"
                    />
                    <span className={task.completed ? 'text-gray-400 line-through' : ''}>{task.text}</span>
                  </label>
                ))}
              </div>
            ))}
          </div>
        )}

        <button type="submit" disabled={createEntry.isPending || !canSubmit} className="border px-2 py-1">
          Create
        </button>
      </form>
    </Popup>
  )
}
