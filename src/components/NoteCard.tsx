import { useEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { useDeleteNote, useUpdateNoteContent, useUpdateNotePosition } from '../lib/notes'
import { settled } from '../lib/settled'
import type { Note } from '../types'
import { useConfirm } from './confirmContext'

// A pointer-up that moved less than this doesn't count as a drag — mirrors
// BlockCard's threshold, though here it only matters for avoiding spurious
// position writes on a stray click on the drag handle.
const CLICK_DISTANCE_PX = 4

// Freeform drag via plain pointer events (5.2), same approach as BlockCard —
// but confined to a small header strip so the textarea underneath keeps
// normal text-editing pointer behaviour (click-to-place-cursor, selection).
//
// `hadContentRef` is the client-side memory the spec requires in place of a
// database column (5.3 vs 5.4): it starts true only if the note already has
// content, flips to true permanently the first time real content is typed,
// and never flips back. Blur discards the note only when content is empty
// AND this is still false — i.e. only a note that was *never* given real
// content. A note that had content and was cleared keeps `hadContentRef`
// true, so blur just saves the empty string instead of deleting it.
export function NoteCard({ note, autoFocus }: { note: Note; autoFocus: boolean }) {
  const [pos, setPos] = useState({ x: note.x, y: note.y })
  const [content, setContent] = useState(note.content)
  const hadContentRef = useRef(note.content.trim() !== '')
  const draggingRef = useRef(false)
  const deletingRef = useRef(false)
  const startRef = useRef({ pointerX: 0, pointerY: 0, noteX: 0, noteY: 0 })
  const updatePosition = useUpdateNotePosition()
  const updateContent = useUpdateNoteContent()
  const deleteNote = useDeleteNote()
  const confirm = useConfirm()

  useEffect(() => {
    if (!draggingRef.current) setPos({ x: note.x, y: note.y })
  }, [note.x, note.y])

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    // The Delete button lives inside this header strip. Capturing the
    // pointer here would retarget its click event to this div instead
    // (per the Pointer Events spec, capture retargets subsequent mouse
    // events too), so a click starting on the button skips drag entirely.
    if (event.target instanceof HTMLElement && event.target.closest('button')) return
    draggingRef.current = true
    startRef.current = { pointerX: event.clientX, pointerY: event.clientY, noteX: pos.x, noteY: pos.y }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return
    const dx = event.clientX - startRef.current.pointerX
    const dy = event.clientY - startRef.current.pointerY
    setPos({ x: startRef.current.noteX + dx, y: startRef.current.noteY + dy })
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return
    draggingRef.current = false
    const dx = event.clientX - startRef.current.pointerX
    const dy = event.clientY - startRef.current.pointerY
    const finalPos = { x: startRef.current.noteX + dx, y: startRef.current.noteY + dy }
    setPos(finalPos)
    if (Math.hypot(dx, dy) > CLICK_DISTANCE_PX && (finalPos.x !== note.x || finalPos.y !== note.y)) {
      updatePosition.mutate({ id: note.id, areaId: note.area_id, x: finalPos.x, y: finalPos.y })
    }
  }

  function handleContentChange(value: string) {
    setContent(value)
    if (value.trim() !== '') hadContentRef.current = true
  }

  // The one place 5.3 and 5.4 diverge: empty + never-had-content silently
  // discards; anything else just saves. Skipped entirely while an explicit
  // delete (below) is in flight, so the two never race on the same note.
  function commitOnBlur() {
    if (deletingRef.current) return
    const trimmed = content.trim()
    if (trimmed === '' && !hadContentRef.current) {
      deleteNote.mutate({ id: note.id, areaId: note.area_id })
      return
    }
    if (content !== note.content) {
      updateContent.mutate({ id: note.id, areaId: note.area_id, content })
    }
  }

  // Explicit delete (5.4), gated by the same confirm dialog as every other
  // delete. `deletingRef` is set on mousedown (before the textarea's blur
  // fires) so a click on this button never triggers the silent 5.3 discard
  // path first; if the user cancels, any pending content is saved instead.
  async function handleDelete() {
    deletingRef.current = true
    const confirmed = await confirm('Delete this note?')
    if (!confirmed) {
      deletingRef.current = false
      commitOnBlur()
      return
    }
    if (!(await settled(deleteNote.mutateAsync({ id: note.id, areaId: note.area_id }))).ok) {
      // Leaving this stuck true would make every later blur skip
      // commitOnBlur, silently dropping edits to a note that still exists.
      deletingRef.current = false
    }
  }

  return (
    <div
      style={{ left: pos.x, top: pos.y }}
      className="absolute flex w-48 touch-none flex-col rounded border bg-yellow-100 shadow"
    >
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="flex cursor-grab items-center justify-between rounded-t border-b border-yellow-200 px-2 py-1 select-none"
      >
        <span aria-hidden className="text-xs text-gray-500">
          ⠿
        </span>
        <button
          type="button"
          onMouseDown={() => {
            deletingRef.current = true
          }}
          onClick={handleDelete}
          className="text-xs text-red-600"
        >
          Delete
        </button>
      </div>
      <textarea
        value={content}
        onChange={(e) => handleContentChange(e.target.value)}
        onBlur={commitOnBlur}
        autoFocus={autoFocus}
        className="h-24 flex-1 resize-none bg-transparent px-2 py-1 text-sm outline-none"
      />
    </div>
  )
}
