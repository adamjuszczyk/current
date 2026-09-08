import { create } from 'zustand'

// Transient UI state only — which popup is open, which Area tab is active.
// No persisted or server data belongs in this store.
interface UIState {
  activeAreaId: string | null
  setActiveAreaId: (id: string | null) => void

  activePopup: string | null
  popupContext: Record<string, unknown> | null
  openPopup: (popup: string, context?: Record<string, unknown>) => void
  closePopup: () => void
}

export const useUIStore = create<UIState>((set) => ({
  activeAreaId: null,
  setActiveAreaId: (id) => set({ activeAreaId: id }),

  activePopup: null,
  popupContext: null,
  openPopup: (popup, context) => set({ activePopup: popup, popupContext: context ?? null }),
  closePopup: () => set({ activePopup: null, popupContext: null }),
}))
