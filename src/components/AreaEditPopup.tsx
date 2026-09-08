import { useState } from 'react'
import type { FormEvent } from 'react'
import { useAreas, useDeleteArea, useUpdateArea } from '../lib/areas'
import { useConfirm } from './confirmContext'
import { Popup } from './Popup'

// Opened by double-clicking an area tab. Name editable, plus Delete —
// gated by useConfirm(), like every delete in the app.
export function AreaEditPopup({ areaId, onClose }: { areaId: string; onClose: () => void }) {
  const { data: areas = [] } = useAreas()
  const area = areas.find((a) => a.id === areaId)
  const [name, setName] = useState(area?.name ?? '')
  const updateArea = useUpdateArea()
  const deleteArea = useDeleteArea()
  const confirm = useConfirm()

  // The area was deleted from elsewhere while this popup was open.
  if (!area) return null
  const areaName = area.name

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return

    await updateArea.mutateAsync({ id: areaId, name: trimmed })
    onClose()
  }

  async function handleDelete() {
    const confirmed = await confirm(`Delete "${areaName}" and everything inside it? This can't be undone.`)
    if (!confirmed) return

    await deleteArea.mutateAsync(areaId)
    onClose()
  }

  return (
    <Popup onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex w-64 flex-col gap-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="border px-2 py-1"
        />
        <div className="flex justify-between">
          <button type="button" onClick={handleDelete} className="border px-2 py-1 text-red-600">
            Delete
          </button>
          <button type="submit" disabled={updateArea.isPending} className="border px-2 py-1">
            Save
          </button>
        </div>
      </form>
    </Popup>
  )
}
