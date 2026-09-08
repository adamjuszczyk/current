import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

// Shared popup/modal shell — reused by every popup in the app (Area create,
// Area edit/delete, Add block, Block detail, confirm dialog). Rendered only
// while the caller wants it open; unmount to close.
interface PopupProps {
  onClose: () => void
  children: ReactNode
}

export function Popup({ onClose, children }: PopupProps) {
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    contentRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="max-h-[90vh] max-w-lg overflow-auto bg-white p-4 outline-none"
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
