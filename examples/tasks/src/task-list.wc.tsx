import { effect, event, host, state, type ComponentOptions } from "@naos-ui/core"
import { filterTasks, type Task } from "./api.ts"
import { captureRects, flipAfterUpdate } from "./motion-helpers.ts"
import { tasksResource } from "./resources.ts"
import { StatusBadge } from "./status-badge.wc.tsx"
import css from "./task-list.wc.css?inline"

export const options = {
  styles: [css],
} satisfies ComponentOptions

export function TaskList() {
  const loadState = state("pending")
  const tasks = state<Task[]>([])
  const filter = state("all")
  const openTask = event<{ id: string }>("naos-open-task")

  effect(() => {
    const sync = () => {
      const snapshot = tasksResource.snapshot()
      if (snapshot.status !== loadState()) {
        loadState.set(snapshot.status)
      }
      const nextTasks = snapshot.data ?? []
      if (nextTasks.length !== tasks().length) {
        tasks.set(nextTasks)
      }
    }
    const unsubscribe = tasksResource.subscribe(sync)
    sync()
    return () => unsubscribe()
  })

  return (
    <section part="root" data-load-state={loadState()}>
      <header part="toolbar">
        <h2>Tasks</h2>
        <div part="filters" role="group" aria-label="Filter tasks">
          <button
            part="filter"
            data-filter="all"
            aria-pressed={filter() === "all"}
            onClick={() => {
              const rects = captureRects(host().root, "[data-task-row]")
              filter.set("all")
              flipAfterUpdate(rects)
            }}
          >
            All
          </button>
          <button
            part="filter"
            data-filter="open"
            aria-pressed={filter() === "open"}
            onClick={() => {
              const rects = captureRects(host().root, "[data-task-row]")
              filter.set("open")
              flipAfterUpdate(rects)
            }}
          >
            Open
          </button>
          <button
            part="filter"
            data-filter="done"
            aria-pressed={filter() === "done"}
            onClick={() => {
              const rects = captureRects(host().root, "[data-task-row]")
              filter.set("done")
              flipAfterUpdate(rects)
            }}
          >
            Done
          </button>
        </div>
      </header>
      <ul part="list">
        {filterTasks(tasks(), filter()).map((task) => (
          <li key={task.id} data-task-row data-task-id={task.id}>
            <button part="task-link" onClick={() => openTask.emit({ id: task.id })}>
              <span part="task-title">{task.title}</span>
              <span part="task-owner">{task.owner}</span>
            </button>
            <StatusBadge taskStatus={task.status} />
          </li>
        ))}
      </ul>
    </section>
  )
}
