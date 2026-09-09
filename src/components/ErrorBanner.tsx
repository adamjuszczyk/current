import { useUIStore } from '../store/uiStore'

// Write failures, shown until dismissed rather than auto-hidden — a failed
// save is worth noticing late. Sits above popups (which are z-50) so an
// error raised from inside one is still visible.
export function ErrorBanner() {
  const errors = useUIStore((s) => s.errors)
  const dismissError = useUIStore((s) => s.dismissError)

  if (errors.length === 0) return null

  return (
    <div className="fixed inset-x-0 top-0 z-[60] flex flex-col">
      {errors.map((error) => (
        <div
          key={error.id}
          role="alert"
          className="flex items-start justify-between gap-4 border-b border-red-300 bg-red-100 px-4 py-2 text-sm text-red-900"
        >
          <span>
            <strong className="font-medium">Couldn&apos;t save:</strong> {error.message}
          </span>
          <button type="button" onClick={() => dismissError(error.id)} className="shrink-0 border px-2">
            Dismiss
          </button>
        </div>
      ))}
    </div>
  )
}
