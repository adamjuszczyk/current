import { useEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { useUpdateBlockPosition } from '../lib/blocks'
import type { Block, BlockStatus } from '../types'

// `done` and `upcoming` share the same dimmed treatment (3.4) — `upcoming`
// adds a small coloured marker so the two don't read identically.
const statusClasses: Record<BlockStatus, string> = {
  active: 'bg-blue-500 text-white',
  done: 'bg-gray-300 text-gray-500 grayscale',
  upcoming: 'bg-gray-300 text-gray-500 grayscale',
}

// Freeform drag via plain pointer events (3.2) — no drag-and-drop library.
// Position is local state while dragging, persisted to x/y on pointer up.
export function BlockCard({ block }: { block: Block }) {
  const [pos, setPos] = useState({ x: block.x, y: block.y })
  const draggingRef = useRef(false)
  const startRef = useRef({ pointerX: 0, pointerY: 0, blockX: 0, blockY: 0 })
  const updatePosition = useUpdateBlockPosition()

  useEffect(() => {
    if (!draggingRef.current) setPos({ x: block.x, y: block.y })
  }, [block.x, block.y])

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
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
    const finalPos = { x: startRef.current.blockX + dx, y: startRef.current.blockY + dy }
    setPos(finalPos)
    updatePosition.mutate({ id: block.id, areaId: block.area_id, x: finalPos.x, y: finalPos.y })
  }

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{ left: pos.x, top: pos.y }}
      className={`absolute w-40 touch-none cursor-grab select-none rounded p-2 shadow ${statusClasses[block.status]}`}
    >
      {block.status === 'upcoming' && (
        <span aria-hidden className="absolute right-1 top-1 h-2 w-2 rounded-full bg-yellow-400" />
      )}
      <p className="text-sm font-medium">{block.name}</p>
    </div>
  )
}
