import { useEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { useBlocks, useUpdateBlockPositions } from '../lib/blocks'
import { useConnectBlocks, useConnections } from '../lib/connections'
import { buildComponent } from '../lib/layout'
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
  const updatePositions = useUpdateBlockPositions()
  const openPopup = useUIStore((s) => s.openPopup)
  const { data: entries = [] } = useWaitingEntries(block.id)
  const { data: blocks = [] } = useBlocks(block.area_id)
  const { data: connections = [] } = useConnections(block.area_id)
  const connectMode = useUIStore((s) => s.connectMode)
  const connectSourceId = useUIStore((s) => s.connectSourceId)
  const setConnectSource = useUIStore((s) => s.setConnectSource)
  const pushError = useUIStore((s) => s.pushError)
  const connect = useConnectBlocks(block.area_id)

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
        const moveDx = finalPos.x - block.x
        const moveDy = finalPos.y - block.y
        // 6.6: a connected block drags its whole component rigidly — the
        // identical delta applied to every block reachable through any
        // connection, in either direction, persisted together. A block
        // with zero connections is its own component of one, so this is
        // just its own single-row update, same as before Phase 6.
        const edges = connections.map((c) => ({ source_id: c.source_id, target_id: c.target_id }))
        const component = buildComponent(block.id, edges)
        const updates =
          component.size > 1
            ? blocks
                .filter((b) => component.has(b.id))
                .map((b) =>
                  b.id === block.id
                    ? { id: b.id, x: finalPos.x, y: finalPos.y }
                    : { id: b.id, x: b.x + moveDx, y: b.y + moveDy },
                )
            : [{ id: block.id, x: finalPos.x, y: finalPos.y }]
        updatePositions.mutate({ areaId: block.area_id, updates })
      }
      return
    }

    // 6.1-6.3: click-to-connect. A qualifying click while connect mode is
    // active never opens the edit popup — the first click picks a source,
    // the second (on a different block) attempts the connection and
    // always clears the pending selection, whether it succeeded or was
    // refused.
    if (connectMode) {
      if (connectSourceId === null) {
        setConnectSource(block.id)
      } else if (connectSourceId === block.id) {
        setConnectSource(null)
      } else {
        const sourceId = connectSourceId
        setConnectSource(null)
        void connect({ sourceId, targetId: block.id, blocks, connections, onRefused: pushError })
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
  // 5.4: Focused is an outline, deliberately not a badge or a colour —
  // the opposite choice from 4.8's Ready, which has to be a badge precisely
  // because it must not blend into a colour state. Waiting and Focused are
  // mutually exclusive (5.2), so a block is never asked to carry both.
  const focusedClasses = block.focused ? 'outline outline-2 outline-offset-2 outline-purple-600' : ''
  // 6.1-6.3: the pending source of a connection currently being made,
  // visually distinct so the second click's target is obvious.
  const connectSelectedClasses = connectSourceId === block.id ? 'ring-4 ring-offset-2 ring-emerald-500' : ''

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{ left: pos.x, top: pos.y }}
      className={`absolute w-40 touch-none select-none rounded p-2 shadow ${connectMode ? 'cursor-pointer' : 'cursor-grab'} ${colorClasses} ${focusedClasses} ${connectSelectedClasses}`}
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
