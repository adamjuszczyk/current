import { useEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { useUpdateBlockPosition } from '../lib/blocks'
import { isProjectReady, isProjectWaiting, useWaitingEntries, type WaitingEntryWithPicks } from '../lib/waiting'
import { useUIStore } from '../store/uiStore'
import type { Block, BlockStatus } from '../types'

// `done` and `upcoming` share the same dimmed treatment (3.4) — `upcoming`
// adds a small coloured marker so the two don't read identically.
const statusClasses: Record<BlockStatus, string> = {
  active: 'bg-blue-500 text-white',
  done: 'bg-gray-300 text-gray-500',
  upcoming: 'bg-gray-300 text-gray-500',
}

// 4.7: Waiting is a dimmed version of the block's normal Active colour —
// applied whenever the project holds at least one entry (4.1), which is
// what "Waiting" means, regardless of its current status.
const WAITING_CLASSES = 'bg-blue-200 text-blue-900'

// A pointer-up that moved less than this counts as a click, not a drag.
const CLICK_DISTANCE_PX = 4
// A second click this soon after the first (both under the distance above)
// is a double-click. Native `dblclick` isn't used because `setPointerCapture`
// keeps every event routed to this element regardless of how far the
// pointer actually travelled, so the browser would still fire `dblclick`
// after two real drags done in quick succession over the same block.
const DOUBLE_CLICK_MS = 400

// Freeform drag via plain pointer events (3.2) — no drag-and-drop library.
// Position is local state while dragging, persisted to x/y on pointer up.
// Double-click opens the Phase 4 edit popup — see the distance/timing notes
// above for how that's kept from firing on (or being triggered by) a drag.
export function BlockCard({ block }: { block: Block }) {
  const [pos, setPos] = useState({ x: block.x, y: block.y })
  const draggingRef = useRef(false)
  const startRef = useRef({ pointerX: 0, pointerY: 0, blockX: 0, blockY: 0 })
  const lastClickAtRef = useRef<number | null>(null)
  const updatePosition = useUpdateBlockPosition()
  const openPopup = useUIStore((s) => s.openPopup)
  const { data: entries = [] } = useWaitingEntries(block.id)

  useEffect(() => {
    if (!draggingRef.current) setPos({ x: block.x, y: block.y })
  }, [block.x, block.y])

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    // The Waiting card's expand toggle lives inside this card (4.6) — same
    // reasoning as NoteCard/ListCard's button-skip: setPointerCapture would
    // otherwise retarget the button's own click to this div.
    if (event.target instanceof HTMLElement && event.target.closest('button')) return
    draggingRef.current = true
    startRef.current = { pointerX: event.clientX, pointerY: event.clientY, blockX: pos.x, blockY: pos.y }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return
    const dx = event.clientX - startRef.current.pointerX
    const dy = event.clientY - startRef.current.pointerY
    setPos({ x: startRef.current.blockX + dx, y: startRef.current.blockY + dy })
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return
    draggingRef.current = false
    const dx = event.clientX - startRef.current.pointerX
    const dy = event.clientY - startRef.current.pointerY
    const distance = Math.hypot(dx, dy)
    const finalPos = { x: startRef.current.blockX + dx, y: startRef.current.blockY + dy }
    setPos(finalPos)

    if (distance > CLICK_DISTANCE_PX) {
      // A real drag: persist the move, and don't let it count toward a
      // double-click — two quick drags must never open the popup.
      lastClickAtRef.current = null
      if (finalPos.x !== block.x || finalPos.y !== block.y) {
        updatePosition.mutate({ id: block.id, areaId: block.area_id, x: finalPos.x, y: finalPos.y })
      }
      return
    }

    const now = Date.now()
    if (lastClickAtRef.current !== null && now - lastClickAtRef.current <= DOUBLE_CLICK_MS) {
      lastClickAtRef.current = null
      openPopup('block-edit', { blockId: block.id, areaId: block.area_id })
    } else {
      lastClickAtRef.current = now
    }
  }

  const waiting = isProjectWaiting(entries)
  const ready = isProjectReady(entries)
  const colorClasses = waiting ? WAITING_CLASSES : statusClasses[block.status]

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{ left: pos.x, top: pos.y }}
      className={`absolute w-40 touch-none cursor-grab select-none rounded p-2 shadow ${colorClasses}`}
    >
      {block.status === 'upcoming' && !waiting && (
        <span aria-hidden className="absolute right-1 top-1 h-2 w-2 rounded-full bg-yellow-400" />
      )}
      {/* 4.8: Ready is a distinct badge layered on the Waiting treatment,
          deliberately not another outline, so it can't blend into 4.7's
          colour state the way a second dimmed-blue tone might. */}
      {waiting && ready && (
        <span
          aria-label="Ready"
          title="Ready"
          className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[9px] font-bold text-white shadow"
        >
          ✓
        </span>
      )}
      <p className="text-sm font-medium">{block.name}</p>
      {waiting && <WaitingCard entries={entries} />}
    </div>
  )
}

// 4.6: folded by default with a one-line preview and a clear expand
// affordance; expanded, every entry. A picked task that becomes Done stays
// listed, struck through — it never disappears, since the card exists so
// nothing is silently forgotten.
function WaitingCard({ entries }: { entries: WaitingEntryWithPicks[] }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="mt-1 rounded bg-white/70 px-1 py-0.5 text-[11px] text-gray-800">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-1 text-left"
      >
        <span className="truncate">
          Waiting — {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
        </span>
        <span aria-hidden>{expanded ? '▾' : '▸'}</span>
      </button>
      {expanded && (
        <ul className="mt-1 flex flex-col gap-1">
          {entries.map((entry) => (
            <li key={entry.id}>
              {entry.kind === 'text' ? (
                <span>{entry.text}</span>
              ) : entry.picks.length === 0 ? (
                <span className="text-gray-400">(no tasks picked)</span>
              ) : (
                <ul className="ml-2 list-disc">
                  {entry.picks.map((pick) => (
                    <li key={pick.taskId} className={pick.completed ? 'text-gray-400 line-through' : ''}>
                      {pick.taskText}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
