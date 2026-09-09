import { useState } from 'react'
import type { FormEvent } from 'react'
import { useCreateBlock } from '../lib/blocks'
import { settled } from '../lib/settled'
import { Popup } from './Popup'

// Opened by "+ Add block" (3.3). Name field plus a quick-capture textarea —
// each non-empty line becomes a Task on creation. Tasks are optional.
export function BlockCreatePopup({
  areaId,
  position,
  onClose,
}: {
  areaId: string
  position: { x: number; y: number }
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [tasksText, setTasksText] = useState('')
  const createBlock = useCreateBlock()

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return

    const taskTexts = tasksText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)

    const created = await settled(
      createBlock.mutateAsync({ areaId, name: trimmed, x: position.x, y: position.y, taskTexts }),
    )
    if (!created.ok) return
    onClose()
  }

  return (
    <Popup onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex w-72 flex-col gap-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Block name"
          required
          autoFocus
          className="border px-2 py-1"
        />
        <textarea
          value={tasksText}
          onChange={(e) => setTasksText(e.target.value)}
          placeholder="Tasks — one per line, optional"
          rows={5}
          className="border px-2 py-1"
        />
        <button type="submit" disabled={createBlock.isPending} className="border px-2 py-1">
          Create
        </button>
      </form>
    </Popup>
  )
}
