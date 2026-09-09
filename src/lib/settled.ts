// Awaiting `mutateAsync` rejects when a write fails, which — even though the
// mutation cache has already shown the failure in the error banner — also
// surfaces as an unhandled promise rejection. Call sites don't need to
// re-handle the error; they only need to know whether to carry on.
export type Settled<T> = { ok: true; value: T } | { ok: false }

export async function settled<T>(promise: Promise<T>): Promise<Settled<T>> {
  try {
    return { ok: true, value: await promise }
  } catch {
    // Already reported by the mutation cache's onError.
    return { ok: false }
  }
}
