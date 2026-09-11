import { useLayoutEffect, useRef } from 'react'
import type { TextareaHTMLAttributes } from 'react'

// Height follows content (1.1): no fixed rows, no inner scrollbar, and it
// shrinks back down when content is removed, since the height is
// recomputed from scratch — reset to 'auto' before reading scrollHeight —
// on every value change rather than only ever growing.
export function AutoGrowTextarea({
  value,
  className = '',
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { value: string }) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    // Tailwind's preflight makes this a border box, so style.height sets
    // the border box while scrollHeight describes the content box — add
    // the border width back or a bordered instance renders short by it.
    const borderHeight = el.offsetHeight - el.clientHeight
    el.style.height = `${el.scrollHeight + borderHeight}px`
  }, [value])

  return (
    <textarea ref={ref} value={value} rows={1} className={`resize-none overflow-hidden ${className}`} {...rest} />
  )
}
