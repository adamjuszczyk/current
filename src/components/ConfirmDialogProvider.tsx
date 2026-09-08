import { useCallback, useState } from 'react'
import type { ReactNode } from 'react'
import { ConfirmContext, type ConfirmFn } from './confirmContext'
import { Popup } from './Popup'

// The single gate every delete in the app must pass through (Area, Block,
// Task, Note). Mounted once at the app root; call `useConfirm()` from
// anywhere under it to await a yes/no answer before deleting.
interface PendingConfirm {
  message: string
  resolve: (result: boolean) => void
}

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null)

  const confirm = useCallback<ConfirmFn>(
    (message) => new Promise((resolve) => setPending({ message, resolve })),
    [],
  )

  const settle = (result: boolean) => {
    pending?.resolve(result)
    setPending(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <Popup onClose={() => settle(false)}>
          <p className="mb-4">{pending.message}</p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => settle(false)} className="border px-3 py-1">
              Cancel
            </button>
            <button type="button" onClick={() => settle(true)} className="border px-3 py-1">
              Confirm
            </button>
          </div>
        </Popup>
      )}
    </ConfirmContext.Provider>
  )
}
