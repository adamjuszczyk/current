import { useState } from 'react'
import type { FormEvent } from 'react'
import { useCreateList } from '../lib/lists'
import { settled } from '../lib/settled'
import type { ListKind } from '../types'
import { Popup } from './Popup'

const KINDS: { value: ListKind; label: string }[] = [
  { value: 'step', label: 'Step-by-step' },
  { value: 'flat', label: 'Flat' },
]

// Opened by "+ Add list" inside a project canvas (3.3). Kind is chosen here
// and fixed afterwards — no UI anywhere lets it change later. Title is
// optional and, once set here, is likewise not editable (nothing in the
// spec asks for that either).
export function ListCreatePopup({
  blockId,
  position,
  onClose,
}: {
  blockId: string
  position: { x: number; y: number }
  onClose: () => void
}) {
  const [kind, setKind] = useState<ListKind>('flat')
  const [title, setTitle] = useState('')
  const createList = useCreateList()

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const created = await settled(
      createList.mutateAsync({ blockId, kind, title: title.trim(), x: position.x, y: position.y }),
    )
    if (!created.ok) return
    onClose()
  }

  return (
    <Popup onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex w-72 flex-col gap-3">
        <p className="text-sm font-medium">New list</p>
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
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (optional)"
          autoFocus
          className="border px-2 py-1"
        />
        <button type="submit" disabled={createList.isPending} className="border px-2 py-1">
          Create
        </button>
      </form>
    </Popup>
  )
}
