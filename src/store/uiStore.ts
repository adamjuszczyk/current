import { create } from 'zustand'
import type { BlockStatus } from '../types'

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

  // Which top-level screen is showing below the Area tabs (5.5). The Focus
  // screen is a distinct view, not a filter over the canvas — Phase 7's
  // Filter deliberately never touches it.
  activeView: 'canvas' | 'focus'
  setActiveView: (view: 'canvas' | 'focus') => void

  // Set by the Focus screen when a project is picked (5.5): the Area canvas
  // reads this once its Area is active and its blocks are loaded, scrolls
  // the block into view, then clears it. Not persisted — a one-shot signal.
  scrollToBlockId: string | null
  setScrollTarget: (blockId: string) => void
  clearScrollTarget: () => void

  activePopup: string | null
  popupContext: Record<string, unknown> | null
  openPopup: (popup: string, context?: Record<string, unknown>) => void
  closePopup: () => void

  // 6.1-6.3: click-to-connect on the Area canvas. Toggling the mode off
  // (or on) always clears any pending source selection. Global rather than
  // local Canvas state because BlockCard already reads uiStore directly
  // for openPopup, and every block on the canvas needs to react to it.
  connectMode: boolean
  connectSourceId: string | null
  toggleConnectMode: () => void
  setConnectSource: (id: string | null) => void

  // 7.1: three independent on/off toggles on the Area canvas, all on by
  // default, controlling which blocks (and, by extension, which
  // connections — 7.2) are visible. Transient only: not persisted, not
  // per-Area — the spec asks for toggles, not remembered ones. No
  // Waiting/Focused toggle here; those distinctions are carried by the
  // Visuals from Phases 4, 5 and 7 instead.
  visibleStatuses: Record<BlockStatus, boolean>
  toggleVisibleStatus: (status: BlockStatus) => void

  errors: UIError[]
  pushError: (message: string) => void
  dismissError: (id: number) => void
}

let nextErrorId = 0

export const useUIStore = create<UIState>((set) => ({
  activeAreaId: null,
  setActiveAreaId: (id) => set({ activeAreaId: id }),

  activeView: 'canvas',
  setActiveView: (view) => set({ activeView: view }),

  scrollToBlockId: null,
  setScrollTarget: (blockId) => set({ scrollToBlockId: blockId }),
  clearScrollTarget: () => set({ scrollToBlockId: null }),

  activePopup: null,
  popupContext: null,
  openPopup: (popup, context) => set({ activePopup: popup, popupContext: context ?? null }),
  closePopup: () => set({ activePopup: null, popupContext: null }),

  connectMode: false,
  connectSourceId: null,
  toggleConnectMode: () => set((state) => ({ connectMode: !state.connectMode, connectSourceId: null })),
  setConnectSource: (id) => set({ connectSourceId: id }),

  visibleStatuses: { active: true, upcoming: true, done: true },
  toggleVisibleStatus: (status) =>
    set((state) => ({ visibleStatuses: { ...state.visibleStatuses, [status]: !state.visibleStatuses[status] } })),

  errors: [],
  pushError: (message) =>
    set((state) => {
      // Retrying the same failing action shouldn't stack identical rows.
      if (state.errors.some((e) => e.message === message)) return state
      return { errors: [...state.errors, { id: nextErrorId++, message }].slice(-MAX_ERRORS) }
    }),
  dismissError: (id) => set((state) => ({ errors: state.errors.filter((e) => e.id !== id) })),
}))
