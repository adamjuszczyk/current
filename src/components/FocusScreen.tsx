import { errorMessage } from '../lib/errorMessage'
import { useFocusedBlocks } from '../lib/blocks'
import type { FocusedBlock } from '../lib/blocks'
import { useUIStore } from '../store/uiStore'

// 5.5: every currently-Focused project, across every Area — grouped by
// Area so a cross-Area jump isn't a surprise. Deliberately its own screen,
// not a filtered view of the canvas: Phase 7's Filter is a different
// concern and must never be able to hide something from here.
export function FocusScreen() {
  const { data: blocks = [], isPending, isError, error, refetch } = useFocusedBlocks()
  const setActiveAreaId = useUIStore((s) => s.setActiveAreaId)
  const setScrollTarget = useUIStore((s) => s.setScrollTarget)
  const openPopup = useUIStore((s) => s.openPopup)
  const setActiveView = useUIStore((s) => s.setActiveView)

  // Switch to the block's Area if it isn't already active, scroll it into
  // view once that Area's canvas has loaded (Canvas.tsx's own effect does
  // the actual scrolling), and open its popup directly — no intermediate
  // "you're now on this Area" step.
  function handleSelect(block: FocusedBlock) {
    setActiveAreaId(block.area_id)
    setScrollTarget(block.id)
    openPopup('block-edit', { blockId: block.id, areaId: block.area_id })
    setActiveView('canvas')
  }

  if (isPending) {
    return <p className="p-4 text-gray-500">Loading focused projects…</p>
  }

  if (isError) {
    return (
      <div className="p-4 text-red-700">
        <p className="font-medium">Couldn&apos;t load focused projects.</p>
        <p className="text-sm">{errorMessage(error)}</p>
        <button type="button" onClick={() => void refetch()} className="mt-2 border px-2 py-1 text-sm text-black">
          Try again
        </button>
      </div>
    )
  }

  if (blocks.length === 0) {
    return <p className="p-4 text-gray-500">Nothing is Focused right now.</p>
  }

  const grouped = new Map<string, { areaName: string; blocks: FocusedBlock[] }>()
  for (const block of blocks) {
    const group = grouped.get(block.area_id) ?? { areaName: block.areaName, blocks: [] }
    group.blocks.push(block)
    grouped.set(block.area_id, group)
  }

  return (
    <div className="flex-1 overflow-auto p-4">
      <h1 className="mb-4 text-lg font-medium">Focused</h1>
      <div className="flex flex-col gap-6">
        {[...grouped.entries()].map(([groupAreaId, group]) => (
          <div key={groupAreaId}>
            <h2 className="mb-2 text-sm font-medium text-gray-600">{group.areaName}</h2>
            <ul className="flex flex-col gap-2">
              {group.blocks.map((block) => (
                <li key={block.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(block)}
                    className="w-full rounded border px-3 py-2 text-left hover:bg-gray-50"
                  >
                    {block.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
