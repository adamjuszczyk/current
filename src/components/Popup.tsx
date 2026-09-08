import { useEffect, useRef } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'

// Shared popup/modal shell — reused by every popup in the app (Area create,
// Area edit/delete, Add block, Block detail, confirm dialog). Rendered only
// while the caller wants it open; unmount to close.
interface PopupProps {
  onClose: () => void
  children: ReactNode
}

// Mounted popups in open order, so Escape closes only the topmost one.
const popupStack: symbol[] = []

export function Popup({ onClose, children }: PopupProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const idRef = useRef(Symbol('popup'))
  const onCloseRef = useRef(onClose)
  const backdropMouseDownRef = useRef(false)

  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const id = idRef.current
    popupStack.push(id)
    return () => {
      const index = popupStack.indexOf(id)
      if (index !== -1) popupStack.splice(index, 1)
    }
  }, [])

  useEffect(() => {
    contentRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (popupStack[popupStack.length - 1] !== idRef.current) return
      onCloseRef.current()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleBackdropMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    backdropMouseDownRef.current = event.target === event.currentTarget
  }

  const handleBackdropMouseUp = (event: MouseEvent<HTMLDivElement>) => {
    const closeIt = backdropMouseDownRef.current && event.target === event.currentTarget
    backdropMouseDownRef.current = false
    if (closeIt) onClose()
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onMouseDown={handleBackdropMouseDown}
      onMouseUp={handleBackdropMouseUp}
    >
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="max-h-[90vh] max-w-lg overflow-auto bg-white p-4 outline-none"
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
