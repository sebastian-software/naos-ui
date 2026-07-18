import { effect, event, host, type ComponentOptions } from "@naos-ui/core"
import { prefersReducedMotion, spring } from "@naos-ui/motion"
import { StatusBadge } from "./status-badge.wc.tsx"
import css from "./task-detail.wc.css?inline"

export type TaskDetailProps = {
  taskId?: string
  taskTitle?: string
  taskOwner?: string
  taskStatus?: string
  taskSummary?: string
}

export const options = {
  styles: [css],
} satisfies ComponentOptions

export function TaskDetail({
  taskId = "",
  taskTitle = "",
  taskOwner = "",
  taskStatus = "open",
  taskSummary = "",
}: TaskDetailProps = {}) {
  const back = event("naos-back")

  effect(() => {
    if (prefersReducedMotion()) {
      return
    }
    const card = host().root.querySelector("[data-detail-card]")
    if (!(card instanceof HTMLElement) || typeof card.animate !== "function") {
      return
    }
    const timing = spring("gentle")
    card.animate(
      [
        { opacity: 0, transform: "translateY(10px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: timing.duration, easing: timing.easing }
    )
  })

  return (
    <article part="root" data-detail-card data-task-id={taskId}>
      <button part="back-link" onClick={() => back.emit(undefined)}>
        Back to board
      </button>
      <header part="header">
        <h2 part="title">{taskTitle}</h2>
        <StatusBadge taskStatus={taskStatus} />
      </header>
      <p part="owner">{`Owner: ${taskOwner}`}</p>
      <p part="summary">{taskSummary}</p>
    </article>
  )
}
