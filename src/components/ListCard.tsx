import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent, PointerEvent } from 'react'
import { useDeleteList, useUpdateListPosition } from '../lib/lists'
import { settled } from '../lib/settled'
import { useCreateTask, useDeleteTask, useTasks, useUpdateTask } from '../lib/tasks'
import type { List, Task } from '../types'
import { findWaitingHolds, removeEmptiedWaitingEntries } from '../lib/waiting'
import { AutoGrowTextarea } from './AutoGrowTextarea'
import { useConfirm } from './confirmContext'

// A pointer-up that moved less than this doesn't count as a drag — same
// threshold as BlockCard/NoteCard.
const CLICK_DISTANCE_PX = 4

// One List on a project's freeform canvas (3.2), draggable via its header
// strip only — same reasoning as NoteCard: the task fields underneath need
// normal text-editing pointer behaviour, not drag handlers fighting them.
export function ListCard({ list, blockId }: { list: List; blockId: string }) {
  const [pos, setPos] = useState({ x: list.x, y: list.y })
  const draggingRef = useRef(false)
  const startRef = useRef({ pointerX: 0, pointerY: 0, listX: 0, listY: 0 })
  const { data: tasks = [], isError: tasksFailed } = useTasks(list.id)
  const [newTaskText, setNewTaskText] = useState('')
  const updatePosition = useUpdateListPosition()
  const deleteList = useDeleteList()
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const confirm = useConfirm()

  useEffect(() => {
    if (!draggingRef.current) setPos({ x: list.x, y: list.y })
  }, [list.x, list.y])

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.target instanceof HTMLElement && event.target.closest('button')) return
    draggingRef.current = true
    startRef.current = { pointerX: event.clientX, pointerY: event.clientY, listX: pos.x, listY: pos.y }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return
    const dx = event.clientX - startRef.current.pointerX
    const dy = event.clientY - startRef.current.pointerY
    setPos({ x: startRef.current.listX + dx, y: startRef.current.listY + dy })
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return
    draggingRef.current = false
    const dx = event.clientX - startRef.current.pointerX
    const dy = event.clientY - startRef.current.pointerY
    const finalPos = { x: startRef.current.listX + dx, y: startRef.current.listY + dy }
    setPos(finalPos)
    if (Math.hypot(dx, dy) > CLICK_DISTANCE_PX && (finalPos.x !== list.x || finalPos.y !== list.y)) {
      updatePosition.mutate({ id: list.id, blockId, x: finalPos.x, y: finalPos.y })
    }
  }

  async function handleAddTask(event: FormEvent) {
    event.preventDefault()
    const trimmed = newTaskText.trim()
    if (!trimmed) return
    if (!(await settled(createTask.mutateAsync({ listId: list.id, text: trimmed }))).ok) return
    setNewTaskText('')
  }

  // Enter adds the task, Shift+Enter inserts a newline — same as the
  // block-level "Add a task" field this replaces (Phase 1's fix chunk).
  function handleNewTaskKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey) return
    event.preventDefault()
    event.currentTarget.form?.requestSubmit()
  }

  // 3.5: before the confirm dialog, check whether any Waiting entry on any
  // project holds this task as a pick, and name the project(s) in the
  // warning if so. Inert until Phase 4 populates waiting_entries, but the
  // check itself runs for real every time.
  async function handleDeleteTask(task: Task) {
    const checked = await settled(findWaitingHolds(task.id))
    const holds = checked.ok ? checked.value : []
    let message = `Delete task "${task.text}"?`
    if (holds.length > 0) {
      const names = [...new Set(holds.map((h) => h.blockName))].join(', ')
      message += ` It's currently a pick in a Waiting entry on ${names} — deleting it removes that pick, and any entry left with none.`
    }
    const confirmed = await confirm(message)
    if (!confirmed) return
    if (!(await settled(deleteTask.mutateAsync({ id: task.id, listId: list.id }))).ok) return
    // The task's own pick rows cascade away with it; an entry that just
    // lost its last pick doesn't remove itself, so that's done here,
    // automatically, with no second confirmation.
    if (holds.length > 0) await settled(removeEmptiedWaitingEntries(holds))
  }

  async function handleDeleteList() {
    const confirmed = await confirm(
      `Delete this list${list.title ? ` "${list.title}"` : ''} and all its tasks? This can't be undone.`,
    )
    if (!confirmed) return
    await settled(deleteList.mutateAsync({ id: list.id, blockId }))
  }

  // 3.6: a Step-by-step list keeps completed tasks a contiguous prefix in
  // creation order. Completing task i requires task i-1 already complete;
  // un-completing task i requires no task after it still complete — only
  // the last completed task can be un-completed. A Flat list gates neither
  // direction.
  function canComplete(index: number) {
    if (list.kind === 'flat') return true
    if (index === 0) return true
    return tasks[index - 1]?.completed === true
  }

  function canUncomplete(index: number) {
    if (list.kind === 'flat') return true
    return !tasks.slice(index + 1).some((t) => t.completed)
  }

  return (
    <div
      style={{ left: pos.x, top: pos.y }}
      className="absolute flex w-64 touch-none flex-col rounded border bg-white shadow"
    >
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="flex cursor-grab items-center justify-between gap-2 rounded-t border-b bg-gray-50 px-2 py-1 select-none"
      >
        <span className="flex min-w-0 items-center gap-1 text-xs text-gray-600">
          <span aria-hidden>⠿</span>
          <span className="shrink-0 rounded bg-gray-200 px-1 py-0.5">
            {list.kind === 'step' ? 'Step-by-step' : 'Flat'}
          </span>
          {list.title && <span className="truncate font-medium text-gray-800">{list.title}</span>}
        </span>
        <button type="button" onClick={handleDeleteList} className="shrink-0 text-xs text-red-600">
          Delete list
        </button>
      </div>

      <div className="flex flex-col gap-1 p-2">
        {tasksFailed && <p className="text-sm text-red-700">Couldn&apos;t load this list&apos;s tasks.</p>}
        {tasks.length === 0 && !tasksFailed && <p className="text-sm text-gray-500">No tasks yet.</p>}
        {tasks.map((task, index) => {
          const toggleAllowed = task.completed ? canUncomplete(index) : canComplete(index)
          const gated = list.kind === 'step' && !toggleAllowed
          return (
            <TaskRow
              key={task.id}
              task={task}
              disabled={gated}
              disabledReason={
                gated
                  ? task.completed
                    ? 'Only the last completed task can be un-completed'
                    : 'Complete the previous task first'
                  : undefined
              }
              onToggle={(completed) => updateTask.mutate({ id: task.id, listId: list.id, completed })}
              onTextChange={(text) => updateTask.mutate({ id: task.id, listId: list.id, text })}
              onDelete={() => handleDeleteTask(task)}
            />
          )
        })}

        <form onSubmit={handleAddTask} className="mt-1 flex gap-2">
          <AutoGrowTextarea
            value={newTaskText}
            onChange={(e) => setNewTaskText(e.target.value)}
            onKeyDown={handleNewTaskKeyDown}
            placeholder="Add a task"
            className="flex-1 border px-2 py-1 text-sm"
          />
          <button type="submit" disabled={createTask.isPending} className="self-start border px-2 py-1 text-sm">
            Add
          </button>
        </form>
      </div>
    </div>
  )
}

// One task row — checkbox (disabled + explained when 3.6 gates it),
// inline-editable text, delete gated by the confirm dialog (3.4, 3.5).
function TaskRow({
  task,
  disabled,
  disabledReason,
  onToggle,
  onTextChange,
  onDelete,
}: {
  task: Task
  disabled: boolean
  disabledReason?: string
  onToggle: (completed: boolean) => void
  onTextChange: (text: string) => void
  onDelete: () => void
}) {
  const [text, setText] = useState(task.text)

  function commitText() {
    const trimmed = text.trim()
    if (!trimmed) {
      setText(task.text)
      return
    }
    if (trimmed === task.text) return
    onTextChange(trimmed)
  }

  return (
    <div className="flex items-start gap-2">
      <input
        type="checkbox"
        checked={task.completed}
        disabled={disabled}
        title={disabledReason}
        onChange={(e) => onToggle(e.target.checked)}
        aria-label={`Mark "${task.text}" complete`}
        className="mt-2"
      />
      <AutoGrowTextarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commitText}
        className={`flex-1 border px-2 py-1 text-sm ${task.completed ? 'text-gray-400 line-through' : ''}`}
      />
      <button type="button" onClick={onDelete} className="self-start text-xs text-red-600">
        Delete
      </button>
    </div>
  )
}
