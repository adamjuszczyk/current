import { useEffect, useRef, useState } from 'react'
import { useBlocks } from '../lib/blocks'
import { useConnections } from '../lib/connections'
import { useCreateNote, useNotes } from '../lib/notes'
import { settled } from '../lib/settled'
import { useUIStore } from '../store/uiStore'
import type { BlockStatus } from '../types'
import { BlockCard } from './BlockCard'
import { BlockCreatePopup } from './BlockCreatePopup'
import { BlockEditPopup } from './BlockEditPopup'
import { ConnectionLines } from './ConnectionLines'
import { NoteCard } from './NoteCard'

// 7.1: the three toggles, in a fixed display order (independent of default
// value — all three are on by default).
const FILTER_STATUSES: BlockStatus[] = ['active', 'upcoming', 'done']

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
  const { data: notes = [], isError: notesFailed } = useNotes({ areaId })
  const { data: connections = [], isError: connectionsFailed } = useConnections(areaId)
  const createNote = useCreateNote()
  const [focusNoteId, setFocusNoteId] = useState<string | null>(null)
  const activePopup = useUIStore((s) => s.activePopup)
  const popupContext = useUIStore((s) => s.popupContext)
  const openPopup = useUIStore((s) => s.openPopup)
  const closePopup = useUIStore((s) => s.closePopup)
  const scrollToBlockId = useUIStore((s) => s.scrollToBlockId)
  const clearScrollTarget = useUIStore((s) => s.clearScrollTarget)
  const connectMode = useUIStore((s) => s.connectMode)
  const toggleConnectMode = useUIStore((s) => s.toggleConnectMode)
  const visibleStatuses = useUIStore((s) => s.visibleStatuses)
  const toggleVisibleStatus = useUIStore((s) => s.toggleVisibleStatus)

  // 7.2: filtering is a view concern only — it changes what's rendered
  // here, never any block's stored x/y, and never triggers a layout pass.
  // `blocks` itself (the full, unfiltered list) is still what BlockCard's
  // own drag/connect logic reads via its own useBlocks/useConnections
  // calls, so hiding a block never disturbs its component's positions.
  // Passing this filtered list to ConnectionLines (rather than filtering
  // the connections array directly) is what hides a connection touching a
  // hidden block "for free": ConnectionLines looks up each endpoint by id
  // and silently skips any line whose endpoint isn't in the map.
  const visibleBlocks = blocks.filter((b) => visibleStatuses[b.status])

  // 5.5: the Focus screen sets scrollToBlockId and switches to this Area;
  // once that block's row is actually loaded here, scroll it into view and
  // clear the target. If blocks hasn't loaded it yet (a fresh Area query
  // still in flight), this simply does nothing and retries itself the next
  // time `blocks` changes, rather than giving up on a not-yet-there block.
  useEffect(() => {
    if (!scrollToBlockId) return
    const target = blocks.find((b) => b.id === scrollToBlockId)
    if (!target) return
    const el = scrollRef.current
    if (el) {
      el.scrollTo({
        left: Math.max(0, target.x - el.clientWidth / 2 + NEW_BLOCK_HALF_WIDTH),
        top: Math.max(0, target.y - el.clientHeight / 2 + NEW_BLOCK_HALF_HEIGHT),
      })
    }
    clearScrollTarget()
  }, [scrollToBlockId, blocks, clearScrollTarget])

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
    const created = await settled(createNote.mutateAsync({ parent: { areaId }, ...position }))
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
        {/* 6.1-6.3: toggles click-to-connect mode; BlockCard reads
            connectMode/connectSourceId from uiStore directly. */}
        <button
          type="button"
          onClick={toggleConnectMode}
          aria-pressed={connectMode}
          className={`border px-3 py-1 ${connectMode ? 'bg-black text-white' : ''}`}
        >
          {connectMode ? 'Connecting…' : 'Connect blocks'}
        </button>
      </div>

      <div className="flex gap-3 border-b px-4 py-2 text-sm">
        {FILTER_STATUSES.map((status) => (
          <label key={status} className="flex items-center gap-1 capitalize">
            <input
              type="checkbox"
              checked={visibleStatuses[status]}
              onChange={() => toggleVisibleStatus(status)}
            />
            {status}
          </label>
        ))}
      </div>

      {connectMode && (
        <p className="border-b bg-blue-50 px-4 py-1 text-xs text-blue-900">
          Click a block, then another in this Area to connect them (left to right, source to target). Click the
          selected block again to cancel.
        </p>
      )}

      {(blocksFailed || notesFailed || connectionsFailed) && (
        <p role="alert" className="border-b bg-red-100 px-4 py-2 text-sm text-red-900">
          Couldn&apos;t load this area&apos;s{' '}
          {[blocksFailed && 'blocks', notesFailed && 'notes', connectionsFailed && 'connections']
            .filter((label): label is string => typeof label === 'string')
            .join(', ')}
          . The canvas below is incomplete — it is not empty.
        </p>
      )}

      <div ref={scrollRef} className="relative flex-1 overflow-auto">
        <ConnectionLines areaId={areaId} blocks={visibleBlocks} connections={connections} />
        {visibleBlocks.map((block) => (
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
