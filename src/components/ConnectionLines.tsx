import { useDeleteConnection } from '../lib/connections'
import { settled } from '../lib/settled'
import type { Block, Connection } from '../types'
import { useConfirm } from './confirmContext'

// Matches BlockCard's fixed w-40 (160px) footprint and the half-height
// used elsewhere (Canvas.tsx's NEW_BLOCK_HALF_HEIGHT) for the same
// purpose — a line runs from the source's right edge to the target's left
// edge, both vertically centred on the card (6.4).
const BLOCK_WIDTH = 160
const BLOCK_HALF_HEIGHT = 30

// 6.4: connections render as left-to-right lines between blocks. Drawn as
// one absolutely-positioned <svg> sized to the blocks' own extent, in the
// same coordinate space BlockCard's x/y already use, and placed earlier in
// the DOM than the BlockCards so it renders behind them without needing
// z-index. 6.9: clicking a line deletes it, through the same confirm gate
// as everything else.
export function ConnectionLines({
  areaId,
  blocks,
  connections,
}: {
  areaId: string
  blocks: Block[]
  connections: Connection[]
}) {
  const confirm = useConfirm()
  const deleteConnection = useDeleteConnection()
  const byId = new Map(blocks.map((b) => [b.id, b]))

  const width = blocks.reduce((m, b) => Math.max(m, b.x + BLOCK_WIDTH), 800) + 200
  const height = blocks.reduce((m, b) => Math.max(m, b.y + BLOCK_HALF_HEIGHT * 2), 600) + 200

  async function handleDelete(connection: Connection) {
    const confirmed = await confirm('Delete this connection?')
    if (!confirmed) return
    await settled(deleteConnection.mutateAsync({ id: connection.id, areaId }))
  }

  return (
    <svg
      className="pointer-events-none absolute left-0 top-0"
      width={width}
      height={height}
      aria-hidden={connections.length === 0}
    >
      <defs>
        <marker
          id="connection-arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M0,0 L10,5 L0,10 z" fill="#6b7280" />
        </marker>
      </defs>
      {connections.map((connection) => {
        const source = byId.get(connection.source_id)
        const target = byId.get(connection.target_id)
        if (!source || !target) return null
        const x1 = source.x + BLOCK_WIDTH
        const y1 = source.y + BLOCK_HALF_HEIGHT
        const x2 = target.x
        const y2 = target.y + BLOCK_HALF_HEIGHT
        return (
          <g key={connection.id}>
            {/* Wide, invisible hit area — the visible line below is too
                thin to click reliably. */}
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="transparent"
              strokeWidth={14}
              style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
              onClick={() => handleDelete(connection)}
            >
              <title>Delete connection</title>
            </line>
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#6b7280"
              strokeWidth={2}
              markerEnd="url(#connection-arrow)"
              style={{ pointerEvents: 'none' }}
            />
          </g>
        )
      })}
    </svg>
  )
}
