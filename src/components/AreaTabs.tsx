import { useEffect } from 'react'
import { useAreas } from '../lib/areas'
import { useUIStore } from '../store/uiStore'
import { AreaCreatePopup } from './AreaCreatePopup'
import { AreaEditPopup } from './AreaEditPopup'

// One tab per Area, ordered by created_at (2.1). "+" opens the create
// popup (2.2). Double-click opens the edit/delete popup (2.3).
export function AreaTabs() {
  const { data: areas = [], isSuccess } = useAreas()
  const activeAreaId = useUIStore((s) => s.activeAreaId)
  const setActiveAreaId = useUIStore((s) => s.setActiveAreaId)
  const setActiveView = useUIStore((s) => s.setActiveView)
  const activePopup = useUIStore((s) => s.activePopup)
  const popupContext = useUIStore((s) => s.popupContext)
  const openPopup = useUIStore((s) => s.openPopup)
  const closePopup = useUIStore((s) => s.closePopup)

  // Keep the active tab valid: fall back to the first remaining Area (or
  // none) whenever the active one is missing — e.g. after a delete.
  // Only ever act on a successful load: while loading or after a failed
  // fetch `areas` is [], and reacting to that would silently clear the
  // active tab on a dropped connection.
  useEffect(() => {
    if (!isSuccess) return
    if (activeAreaId && areas.some((area) => area.id === activeAreaId)) return
    setActiveAreaId(areas[0]?.id ?? null)
  }, [areas, isSuccess, activeAreaId, setActiveAreaId])

  return (
    <div className="flex items-center gap-1">
      {areas.map((area) => (
        <button
          key={area.id}
          type="button"
          onClick={() => {
            setActiveAreaId(area.id)
            setActiveView('canvas')
          }}
          onDoubleClick={() => openPopup('area-edit', { areaId: area.id })}
          className={`border px-3 py-1 ${area.id === activeAreaId ? 'bg-black text-white' : ''}`}
        >
          {area.name}
        </button>
      ))}
      <button
        type="button"
        onClick={() => openPopup('area-create')}
        aria-label="Add area"
        className="border px-3 py-1"
      >
        +
      </button>

      {activePopup === 'area-create' && <AreaCreatePopup onClose={closePopup} />}
      {activePopup === 'area-edit' && typeof popupContext?.areaId === 'string' && (
        <AreaEditPopup areaId={popupContext.areaId} onClose={closePopup} />
      )}
    </div>
  )
}
