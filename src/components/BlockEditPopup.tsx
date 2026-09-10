import { useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { useBlocks, useDeleteBlock, useUpdateBlock } from '../lib/blocks'
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
  const { data: tasks = [] } = useTasks(blockId)
  const [name, setName] = useState(block?.name ?? '')
  const [newTaskText, setNewTaskText] = useState('')
  const updateBlock = useUpdateBlock()
  const deleteBlock = useDeleteBlock()
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
    if (!(await settled(createTask.mutateAsync({ blockId, text: trimmed }))).ok) return
    setNewTaskText('')
  }

  async function handleDeleteTask(task: Task) {
    const confirmed = await confirm(`Delete task "${task.text}"?`)
    if (!confirmed) return
    await settled(deleteTask.mutateAsync({ id: task.id, blockId }))
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
              onToggle={(completed) => updateTask.mutate({ id: task.id, blockId, completed })}
              onTextChange={(text) => updateTask.mutate({ id: task.id, blockId, text })}
              onDelete={() => handleDeleteTask(task)}
            />
          ))}

          <form onSubmit={handleAddTask} className="mt-1 flex gap-2">
            <AutoGrowTextarea
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
              placeholder="Add a task"
              className="flex-1 border px-2 py-1"
            />
            <button type="submit" disabled={createTask.isPending} className="self-start border px-2 py-1">
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
