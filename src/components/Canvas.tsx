import { useRef } from 'react'
import { useBlocks } from '../lib/blocks'
import { useUIStore } from '../store/uiStore'
import { BlockCard } from './BlockCard'
import { BlockCreatePopup } from './BlockCreatePopup'

// Half the BlockCard's fixed footprint (w-40 ~= 160px, plus padding/shadow),
// used only to centre a newly-created block under its coordinates (3.5).
const NEW_BLOCK_HALF_WIDTH = 80
const NEW_BLOCK_HALF_HEIGHT = 30

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
  const { data: blocks = [] } = useBlocks(areaId)
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

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b px-4 py-2">
        <button type="button" onClick={handleAddBlock} className="border px-3 py-1">
          + Add block
        </button>
      </div>

      <div ref={scrollRef} className="relative flex-1 overflow-auto">
        {blocks.map((block) => (
          <BlockCard key={block.id} block={block} />
        ))}
      </div>

      {activePopup === 'block-create' &&
        typeof popupContext?.areaId === 'string' &&
        isPosition(popupContext.position) && (
          <BlockCreatePopup areaId={popupContext.areaId} position={popupContext.position} onClose={closePopup} />
        )}
    </div>
  )
}
