import { createContext, useContext } from 'react'

export type ConfirmFn = (message: string) => Promise<boolean>

export const ConfirmContext = createContext<ConfirmFn | null>(null)

export function useConfirm(): ConfirmFn {
  const confirm = useContext(ConfirmContext)
  if (!confirm) {
    throw new Error('useConfirm must be used within a ConfirmDialogProvider')
  }
  return confirm
}
