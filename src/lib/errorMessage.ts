// Supabase/PostgREST failures arrive as plain objects — { code, message,
// details, hint } — not Error instances, so `String(error)` on one yields
// "[object Object]". A visible-but-meaningless message is barely better
// than a silent failure, which is the whole point of showing it.
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (error && typeof error === 'object') {
    const { message, code } = error as { message?: unknown; code?: unknown }
    if (typeof message === 'string' && message !== '') {
      return typeof code === 'string' && code !== '' ? `${message} (${code})` : message
    }
  }
  return 'Unknown error'
}
