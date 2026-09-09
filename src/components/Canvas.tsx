import { useRef, useState } from 'react'
import { useBlocks } from '../lib/blocks'
import { useCreateNote, useNotes } from '../lib/notes'
import { settled } from '../lib/settled'
import { useUIStore } from '../store/uiStore'
import { BlockCard } from './BlockCard'
import { BlockCreatePopup } from './BlockCreatePopup'
import { BlockEditPopup } from './BlockEditPopup'
import { NoteCard } from './NoteCard'

// Half the BlockCard's fixed footprint (w-40 ~= 160px, plus padding/shadow),
// used only to centre a newly-created block under its coordinates (3.5).
const NEW_BLOCK_HALF_WIDTH = 80
const NEW_BLOCK_HALF_HEIGHT = 30

// Same idea for a newly-created Note (NoteCard is w-48 with a header strip
// plus a 24-tall textarea) — just a starting position, not an arrangement
// rule (5.1).
const NEW_NOTE_HALF_WIDTH = 96
const NEW_NOTE_HALF_HEIGHT = 65

function isPosition(value: unknown): value is { x: number; y: number } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).x === 'number' &&
    typeof (value as Record<string, unknown>).y === 'number'
  )
}

// Fills the space below the tab row (3.1). No zoom/pan — the scroll
// container below just scrolls natively if blocks land past the viewport.
export function Canvas({ areaId }: { areaId: string }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const { data: blocks = [], isError: blocksFailed } = useBlocks(areaId)
  const { data: notes = [], isError: notesFailed } = useNotes(areaId)
  const createNote = useCreateNote()
  const [focusNoteId, setFocusNoteId] = useState<string | null>(null)
  const activePopup = useUIStore((s) => s.activePopup)
  const popupContext = useUIStore((s) => s.popupContext)
  const openPopup = useUIStore((s) => s.openPopup)
  const closePopup = useUIStore((s) => s.closePopup)

  function handleAddBlock() {
    const el = scrollRef.current
    const position = el
      ? {
          x: el.scrollLeft + el.clientWidth / 2 - NEW_BLOCK_HALF_WIDTH,
          y: el.scrollTop + el.clientHeight / 2 - NEW_BLOCK_HALF_HEIGHT,
        }
      : { x: 0, y: 0 }
    openPopup('block-create', { areaId, position })
  }

  // No popup (5.1) — insert the empty Note immediately and remember its id
  // so the NoteCard that appears for it renders with autoFocus.
  async function handleAddNote() {
    const el = scrollRef.current
    const position = el
      ? {
          x: el.scrollLeft + el.clientWidth / 2 - NEW_NOTE_HALF_WIDTH,
          y: el.scrollTop + el.clientHeight / 2 - NEW_NOTE_HALF_HEIGHT,
        }
      : { x: 0, y: 0 }
    const created = await settled(createNote.mutateAsync({ areaId, ...position }))
    if (!created.ok) return
    setFocusNoteId(created.value.id)
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex gap-2 border-b px-4 py-2">
        <button type="button" onClick={handleAddBlock} className="border px-3 py-1">
          + Add block
        </button>
        <button type="button" onClick={handleAddNote} className="border px-3 py-1">
          + Note
        </button>
      </div>

      {(blocksFailed || notesFailed) && (
        <p role="alert" className="border-b bg-red-100 px-4 py-2 text-sm text-red-900">
          Couldn&apos;t load this area&apos;s {blocksFailed && notesFailed ? 'blocks or notes' : blocksFailed ? 'blocks' : 'notes'}.
          The canvas below is incomplete — it is not empty.
        </p>
      )}

      <div ref={scrollRef} className="relative flex-1 overflow-auto">
        {blocks.map((block) => (
          <BlockCard key={block.id} block={block} />
        ))}
        {notes.map((note) => (
          <NoteCard key={note.id} note={note} autoFocus={note.id === focusNoteId} />
        ))}
      </div>

      {activePopup === 'block-create' &&
        typeof popupContext?.areaId === 'string' &&
        isPosition(popupContext.position) && (
          <BlockCreatePopup areaId={popupContext.areaId} position={popupContext.position} onClose={closePopup} />
        )}
      {activePopup === 'block-edit' &&
        typeof popupContext?.areaId === 'string' &&
        typeof popupContext?.blockId === 'string' && (
          <BlockEditPopup areaId={popupContext.areaId} blockId={popupContext.blockId} onClose={closePopup} />
        )}
    </div>
  )
}
