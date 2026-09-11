import { useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useBlocks, useDeleteBlock, useUpdateBlock } from '../lib/blocks'
import { useLists } from '../lib/lists'
import { useCreateNote, useNotes } from '../lib/notes'
import { settled } from '../lib/settled'
import type { BlockStatus } from '../types'
import { useConfirm } from './confirmContext'
import { ListCard } from './ListCard'
import { ListCreatePopup } from './ListCreatePopup'
import { NoteCard } from './NoteCard'
import { Popup } from './Popup'

const STATUSES: BlockStatus[] = ['upcoming', 'active', 'done']

function blurOnEnter(event: KeyboardEvent<HTMLInputElement>) {
  if (event.key === 'Enter') event.currentTarget.blur()
}

// Resizable like a normal window (3.1) — session-only size, nothing
// persisted. Native CSS `resize`, not a library: the outer box gets an
// explicit starting size plus min/max and `resize: both`; the header stays
// fixed while the canvas below scrolls in its own region.
const INITIAL_WIDTH = 640
const INITIAL_HEIGHT = 520
const MIN_WIDTH = 380
const MIN_HEIGHT = 320
const CONTENT_CLASSNAME = 'flex resize flex-col overflow-hidden rounded border bg-white outline-none'
const CONTENT_STYLE = {
  width: INITIAL_WIDTH,
  height: INITIAL_HEIGHT,
  minWidth: MIN_WIDTH,
  minHeight: MIN_HEIGHT,
  maxWidth: '95vw',
  maxHeight: '90vh',
}

// Half of ListCard's/NoteCard's own footprint, used only to centre newly
// created content under the canvas's current viewport — a one-time
// starting position, not an arrangement rule, same approach as Canvas.tsx.
const NEW_LIST_HALF_WIDTH = 128
const NEW_LIST_HALF_HEIGHT = 40
const NEW_NOTE_HALF_WIDTH = 96
const NEW_NOTE_HALF_HEIGHT = 65

// Opened by double-clicking a Block. Name/status/delete stay unchanged from
// Phase 4; what's inside is now a project canvas (3.2) — Lists (3.3, 3.4,
// 3.5, 3.6, 3.8) and Notes (3.7), each freely placed and independently
// draggable, one level down from the Area canvas.
export function BlockEditPopup({
  areaId,
  blockId,
  onClose,
}: {
  areaId: string
  blockId: string
  onClose: () => void
}) {
  const { data: blocks = [] } = useBlocks(areaId)
  const block = blocks.find((b) => b.id === blockId)
  const { data: lists = [], isError: listsFailed } = useLists(blockId)
  const { data: notes = [], isError: notesFailed } = useNotes({ blockId })
  const [name, setName] = useState(block?.name ?? '')
  const [focusNoteId, setFocusNoteId] = useState<string | null>(null)
  const [listPopupPosition, setListPopupPosition] = useState<{ x: number; y: number } | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const updateBlock = useUpdateBlock()
  const deleteBlock = useDeleteBlock()
  const createNote = useCreateNote()
  const confirm = useConfirm()

  // The block was deleted from elsewhere while this popup was open.
  if (!block) return null
  const blockName = block.name
  const blockStatus = block.status

  function commitName() {
    const trimmed = name.trim()
    if (!trimmed) {
      setName(blockName)
      return
    }
    if (trimmed === blockName) return
    updateBlock.mutate({ id: blockId, areaId, name: trimmed })
  }

  function handleStatusChange(status: BlockStatus) {
    if (status === blockStatus) return
    updateBlock.mutate({ id: blockId, areaId, status })
  }

  function handleAddList() {
    const el = canvasRef.current
    const position = el
      ? {
          x: el.scrollLeft + el.clientWidth / 2 - NEW_LIST_HALF_WIDTH,
          y: el.scrollTop + el.clientHeight / 2 - NEW_LIST_HALF_HEIGHT,
        }
      : { x: 24, y: 24 }
    setListPopupPosition(position)
  }

  // No popup (7.1's Area-note pattern, reused here) — insert the empty
  // Note immediately and remember its id so it renders autoFocus (3.7).
  async function handleAddNote() {
    const el = canvasRef.current
    const position = el
      ? {
          x: el.scrollLeft + el.clientWidth / 2 - NEW_NOTE_HALF_WIDTH,
          y: el.scrollTop + el.clientHeight / 2 - NEW_NOTE_HALF_HEIGHT,
        }
      : { x: 24, y: 24 }
    const created = await settled(createNote.mutateAsync({ parent: { blockId }, ...position }))
    if (!created.ok) return
    setFocusNoteId(created.value.id)
  }

  async function handleDeleteBlock() {
    const confirmed = await confirm(
      `Delete "${blockName}" and everything inside it — its lists, tasks, and notes? This can't be undone.`,
    )
    if (!confirmed) return
    if (!(await settled(deleteBlock.mutateAsync({ id: blockId, areaId }))).ok) return
    onClose()
  }

  const loadFailureLabel =
    listsFailed && notesFailed ? 'lists or notes' : listsFailed ? 'lists' : notesFailed ? 'notes' : null

  return (
    <Popup onClose={onClose} contentClassName={CONTENT_CLASSNAME} contentStyle={CONTENT_STYLE}>
      <div className="flex flex-col gap-3 border-b p-4">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={blurOnEnter}
          autoFocus
          className="border px-2 py-1 text-lg font-medium"
        />

        <div className="flex gap-2">
          {STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => handleStatusChange(status)}
              className={`flex-1 border px-2 py-1 capitalize ${
                status === block.status ? 'bg-black text-white' : ''
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={handleAddList} className="border px-2 py-1 text-sm">
            + Add list
          </button>
          <button type="button" onClick={handleAddNote} className="border px-2 py-1 text-sm">
            + Note
          </button>
          <button type="button" onClick={handleDeleteBlock} className="ml-auto border px-2 py-1 text-sm text-red-600">
            Delete block
          </button>
        </div>

        {loadFailureLabel && (
          <p role="alert" className="text-sm text-red-700">
            Couldn&apos;t load this project&apos;s {loadFailureLabel}. The canvas below is incomplete — it is not
            empty.
          </p>
        )}
      </div>

      <div ref={canvasRef} className="relative flex-1 overflow-auto bg-gray-50">
        {lists.map((list) => (
          <ListCard key={list.id} list={list} blockId={blockId} />
        ))}
        {notes.map((note) => (
          <NoteCard key={note.id} note={note} autoFocus={note.id === focusNoteId} />
        ))}
      </div>

      {listPopupPosition && (
        <ListCreatePopup blockId={blockId} position={listPopupPosition} onClose={() => setListPopupPosition(null)} />
      )}
    </Popup>
  )
}
