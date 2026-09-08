import { useState } from 'react'
import type { FormEvent } from 'react'
import { useCreateArea } from '../lib/areas'
import { useUIStore } from '../store/uiStore'
import { Popup } from './Popup'

// Opened by the "+" button at the end of the area tab row. Single name
// field — that's the entire form (spec, Areas → Create).
export function AreaCreatePopup({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const createArea = useCreateArea()
  const setActiveAreaId = useUIStore((s) => s.setActiveAreaId)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return

    const area = await createArea.mutateAsync(trimmed)
    setActiveAreaId(area.id)
    onClose()
  }

  return (
    <Popup onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex w-64 flex-col gap-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Area name"
          required
          className="border px-2 py-1"
        />
        <button type="submit" disabled={createArea.isPending} className="border px-2 py-1">
          Create
        </button>
      </form>
    </Popup>
  )
}
