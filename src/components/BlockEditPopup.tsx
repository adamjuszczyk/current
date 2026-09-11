import { useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useBlocks, useDeleteBlock, useUpdateBlock } from '../lib/blocks'
import { useLists } from '../lib/lists'
import { useCreateNote, useNotes } from '../lib/notes'
import { settled } from '../lib/settled'
import { useUIStore } from '../store/uiStore'
import { describeOutstanding, isProjectReady, isProjectWaiting, useDeleteWaitingEntry, useWaitingEntries } from '../lib/waiting'
import type { BlockStatus } from '../types'
import { useConfirm } from './confirmContext'
import { ListCard } from './ListCard'
import { ListCreatePopup } from './ListCreatePopup'
import { NoteCard } from './NoteCard'
import { Popup } from './Popup'
import { WaitingEntryCreatePopup } from './WaitingEntryCreatePopup'

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
  const { data: entries = [], isError: entriesFailed } = useWaitingEntries(blockId)
  const [name, setName] = useState(block?.name ?? '')
  const [focusNoteId, setFocusNoteId] = useState<string | null>(null)
  const [listPopupPosition, setListPopupPosition] = useState<{ x: number; y: number } | null>(null)
  const [waitingPopupOpen, setWaitingPopupOpen] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)
  const updateBlock = useUpdateBlock()
  const deleteBlock = useDeleteBlock()
  const createNote = useCreateNote()
  const deleteWaitingEntry = useDeleteWaitingEntry()
  const pushError = useUIStore((s) => s.pushError)
  const confirm = useConfirm()

  // The block was deleted from elsewhere while this popup was open.
  if (!block) return null
  const blockName = block.name
  const blockStatus = block.status
  const blockFocused = block.focused

  function commitName() {
    const trimmed = name.trim()
    if (!trimmed) {
      setName(blockName)
      return
    }
    if (trimmed === blockName) return
    updateBlock.mutate({ id: blockId, areaId, name: trimmed })
  }

  // 4.5: a project can't leave Active while it's genuinely Waiting — holding
  // at least one entry that hasn't reached Ready (4.4). describeOutstanding
  // returns one reason per non-Ready entry and [] once every entry is Ready
  // (or there are none), so that alone is the gate; a project with zero
  // entries was never Waiting in the first place and is refused nothing.
  // 5.3: Done clears Focused with it, in the same write — not a separate
  // mutation a failure could leave half-applied.
  function handleStatusChange(status: BlockStatus) {
    if (status === blockStatus) return
    if (blockStatus === 'active' && status !== 'active') {
      const outstanding = describeOutstanding(entries)
      if (outstanding.length > 0) {
        pushError(`Can't change status off Active while still Waiting: ${outstanding.join('; ')}.`)
        return
      }
    }
    const changes: { id: string; areaId: string; status: BlockStatus; focused?: boolean } = {
      id: blockId,
      areaId,
      status,
    }
    if (status === 'done' && blockFocused) changes.focused = false
    updateBlock.mutate(changes)
  }

  // 5.1/5.2: Focused is available only on Active projects, and turning it
  // on is refused outright while the project is Waiting (at least one
  // entry, 4.1) — nothing is swapped or cleared on the user's behalf, the
  // refusal just says which one has to go first. Turning it off has no
  // such gate in either direction.
  function handleToggleFocused() {
    if (blockFocused) {
      updateBlock.mutate({ id: blockId, areaId, focused: false })
      return
    }
    if (blockStatus !== 'active') {
      pushError('Focused is only available on Active projects.')
      return
    }
    if (isProjectWaiting(entries)) {
      pushError("Can't turn on Focused while Waiting: turn off Waiting first.")
      return
    }
    updateBlock.mutate({ id: blockId, areaId, focused: true })
  }

  // 5.2, the other direction: adding a project's *first* Waiting entry is
  // exactly "turning Waiting on" (4.1), so that's the one moment this needs
  // checking — once the project already has entries, it was never Focused
  // to begin with (this same guard already refused that transition).
  function handleOpenWaitingPopup() {
    if (entries.length === 0 && blockFocused) {
      pushError("Can't turn on Waiting while Focused: turn off Focused first.")
      return
    }
    setWaitingPopupOpen(true)
  }

  // 4.9: deleting a Waiting entry directly, gated by the confirm dialog —
  // distinct from a pick disappearing because its task was deleted at the
  // task's own source (3.5, ListCard), which never raises a second one.
  async function handleDeleteEntry(entryId: string) {
    const confirmed = await confirm('Delete this Waiting entry?')
    if (!confirmed) return
    await settled(deleteWaitingEntry.mutateAsync({ id: entryId, blockId }))
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

  const failedLabels = [listsFailed && 'lists', notesFailed && 'notes', entriesFailed && 'Waiting entries'].filter(
    (label): label is string => typeof label === 'string',
  )
  const loadFailureLabel =
    failedLabels.length === 0 ? null : failedLabels.length === 1 ? failedLabels[0] : failedLabels.join(' or ')

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

        <div>
          {/* 5.4's outline lives on BlockCard, on the Area canvas — this is
              just the on/off control, not a second visual treatment. */}
          <button
            type="button"
            onClick={handleToggleFocused}
            aria-pressed={blockFocused}
            className={`border px-2 py-1 text-sm ${blockFocused ? 'bg-purple-600 text-white' : ''}`}
          >
            {blockFocused ? 'Focused' : 'Focus'}
          </button>
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

        <div className="flex flex-col gap-2 border-t pt-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">
              Waiting{entries.length > 0 ? ` (${entries.length})` : ''}
              {isProjectWaiting(entries) && (
                <span className={`ml-2 text-xs ${isProjectReady(entries) ? 'text-green-700' : 'text-gray-500'}`}>
                  {isProjectReady(entries) ? 'Ready' : 'Not ready'}
                </span>
              )}
            </p>
            {blockStatus === 'active' && (
              <button type="button" onClick={handleOpenWaitingPopup} className="border px-2 py-1 text-xs">
                + Waiting entry
              </button>
            )}
          </div>

          {entries.length === 0 && <p className="text-xs text-gray-500">Not waiting on anything.</p>}

          {entries.length > 0 && (
            <ul className="flex flex-col gap-1">
              {entries.map((entry) => (
                <li key={entry.id} className="flex items-start justify-between gap-2 rounded border px-2 py-1 text-xs">
                  <div className="min-w-0 flex-1">
                    {entry.kind === 'text' ? (
                      <span>{entry.text}</span>
                    ) : entry.picks.length === 0 ? (
                      <span className="text-gray-400">(no tasks picked)</span>
                    ) : (
                      <ul className="flex flex-col gap-0.5">
                        {entry.picks.map((pick) => (
                          <li key={pick.taskId} className={pick.completed ? 'text-gray-400 line-through' : ''}>
                            {pick.taskText}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteEntry(entry.id)}
                    className="shrink-0 text-red-600"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
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
      {waitingPopupOpen && (
        <WaitingEntryCreatePopup areaId={areaId} blockId={blockId} onClose={() => setWaitingPopupOpen(false)} />
      )}
    </Popup>
  )
}
