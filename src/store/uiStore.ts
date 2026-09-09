import { create } from 'zustand'

// Transient UI state only — which popup is open, which Area tab is active,
// and any write failures currently being shown. No persisted or server data
// belongs in this store.
export interface UIError {
  id: number
  message: string
}

// Enough to see that several things failed without the banner taking over
// the screen; older ones fall off.
const MAX_ERRORS = 4

interface UIState {
  activeAreaId: string | null
  setActiveAreaId: (id: string | null) => void

  activePopup: string | null
  popupContext: Record<string, unknown> | null
  openPopup: (popup: string, context?: Record<string, unknown>) => void
  closePopup: () => void

  errors: UIError[]
  pushError: (message: string) => void
  dismissError: (id: number) => void
}

let nextErrorId = 0

export const useUIStore = create<UIState>((set) => ({
  activeAreaId: null,
  setActiveAreaId: (id) => set({ activeAreaId: id }),

  activePopup: null,
  popupContext: null,
  openPopup: (popup, context) => set({ activePopup: popup, popupContext: context ?? null }),
  closePopup: () => set({ activePopup: null, popupContext: null }),

  errors: [],
  pushError: (message) =>
    set((state) => {
      // Retrying the same failing action shouldn't stack identical rows.
      if (state.errors.some((e) => e.message === message)) return state
      return { errors: [...state.errors, { id: nextErrorId++, message }].slice(-MAX_ERRORS) }
    }),
  dismissError: (id) => set((state) => ({ errors: state.errors.filter((e) => e.id !== id) })),
}))
