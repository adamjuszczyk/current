import { useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { useBlocks, useDeleteBlock, useUpdateBlock } from '../lib/blocks'
import { useCreateList, useLists } from '../lib/lists'
import { useCreateTask, useDeleteTask, useTasks, useUpdateTask } from '../lib/tasks'
import { settled } from '../lib/settled'
import type { BlockStatus, Task } from '../types'
import { AutoGrowTextarea } from './AutoGrowTextarea'
import { useConfirm } from './confirmContext'
import { Popup } from './Popup'

const STATUSES: BlockStatus[] = ['upcoming', 'active', 'done']

function blurOnEnter(event: KeyboardEvent<HTMLInputElement>) {
  if (event.key === 'Enter') event.currentTarget.blur()
}

// Opened by double-clicking a Block — the one popup for 4.1-4.5: name,
// status (set manually, never inferred from tasks), and full task CRUD.
// Block and task deletes both go through useConfirm().
export function BlockEditPopup({
  areaId,
  blockId,
  onClose,
}: {
  areaId: string
  blockId: string
  onClose: () => void
}) {
  const { data: blocks = [] } = useBlocks(areaId)
  const block = blocks.find((b) => b.id === blockId)
  // 2a.3's stepping stone: a block has at most one list here (quick-capture
  // and this popup's own lazy-create both only ever make one untitled Flat
  // list), so the first one is "the" block's list. Phase 3 generalises this
  // to many lists of both kinds.
  const { data: lists = [] } = useLists(blockId)
  const list = lists[0] ?? null
  const { data: tasks = [] } = useTasks(list?.id ?? null)
  const [name, setName] = useState(block?.name ?? '')
  const [newTaskText, setNewTaskText] = useState('')
  const updateBlock = useUpdateBlock()
  const deleteBlock = useDeleteBlock()
  const createList = useCreateList()
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const confirm = useConfirm()

  // The block was deleted from elsewhere while this popup was open.
  if (!block) return null
  const blockName = block.name
  const blockStatus = block.status

  function commitName() {
    const trimmed = name.trim()
    if (!trimmed) {
      setName(blockName)
      return
    }
    if (trimmed === blockName) return
    updateBlock.mutate({ id: blockId, areaId, name: trimmed })
  }

  function handleStatusChange(status: BlockStatus) {
    if (status === blockStatus) return
    updateBlock.mutate({ id: blockId, areaId, status })
  }

  async function handleAddTask(event: FormEvent) {
    event.preventDefault()
    const trimmed = newTaskText.trim()
    if (!trimmed) return
    // A block with no tasks yet has no list (2a.1's migration leaves it
    // that way too) — the first task added lazily creates the one
    // untitled Flat list, at the same fixed origin quick-capture uses.
    let listId = list?.id
    if (!listId) {
      const createdList = await settled(createList.mutateAsync({ blockId, kind: 'flat', title: '', x: 24, y: 24 }))
      if (!createdList.ok) return
      listId = createdList.value.id
    }
    if (!(await settled(createTask.mutateAsync({ listId, text: trimmed }))).ok) return
    setNewTaskText('')
  }

  // Enter adds the task (v1's verified behaviour); Shift+Enter inserts a
  // newline instead, so multi-line entry still works before submitting.
  function handleNewTaskKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey) return
    event.preventDefault()
    event.currentTarget.form?.requestSubmit()
  }

  async function handleDeleteTask(task: Task) {
    if (!list) return
    const confirmed = await confirm(`Delete task "${task.text}"?`)
    if (!confirmed) return
    await settled(deleteTask.mutateAsync({ id: task.id, listId: list.id }))
  }

  async function handleDeleteBlock() {
    const confirmed = await confirm(`Delete "${blockName}" and all its tasks? This can't be undone.`)
    if (!confirmed) return
    if (!(await settled(deleteBlock.mutateAsync({ id: blockId, areaId }))).ok) return
    onClose()
  }

  return (
    <Popup onClose={onClose}>
      <div className="flex w-96 flex-col gap-4">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={blurOnEnter}
          autoFocus
          className="border px-2 py-1 text-lg font-medium"
        />

        <div className="flex gap-2">
          {STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => handleStatusChange(status)}
              className={`flex-1 border px-2 py-1 capitalize ${
                status === block.status ? 'bg-black text-white' : ''
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-1">
          {tasks.length === 0 && <p className="text-sm text-gray-500">No tasks yet.</p>}
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onToggle={(completed) => list && updateTask.mutate({ id: task.id, listId: list.id, completed })}
              onTextChange={(text) => list && updateTask.mutate({ id: task.id, listId: list.id, text })}
              onDelete={() => handleDeleteTask(task)}
            />
          ))}

          <form onSubmit={handleAddTask} className="mt-1 flex gap-2">
            <AutoGrowTextarea
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
              onKeyDown={handleNewTaskKeyDown}
              placeholder="Add a task"
              className="flex-1 border px-2 py-1"
            />
            <button
              type="submit"
              disabled={createTask.isPending || createList.isPending}
              className="self-start border px-2 py-1"
            >
              Add
            </button>
          </form>
        </div>

        <button type="button" onClick={handleDeleteBlock} className="self-start border px-2 py-1 text-red-600">
          Delete block
        </button>
      </div>
    </Popup>
  )
}

// One row inside the flat, unordered task list (4.3) — checkbox to toggle
// complete, inline-editable text, delete gated by the confirm dialog above.
function TaskRow({
  task,
  onToggle,
  onTextChange,
  onDelete,
}: {
  task: Task
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
        onChange={(e) => onToggle(e.target.checked)}
        aria-label={`Mark "${task.text}" complete`}
        className="mt-2"
      />
      <AutoGrowTextarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commitText}
        className={`flex-1 border px-2 py-1 ${task.completed ? 'text-gray-400 line-through' : ''}`}
      />
      <button type="button" onClick={onDelete} className="self-start text-red-600">
        Delete
      </button>
    </div>
  )
}
