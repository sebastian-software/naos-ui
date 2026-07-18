import { type ComponentOptions } from "@naos-ui/core"
import css from "./status-badge.wc.css?inline"

export type StatusBadgeProps = {
  taskStatus?: string
}

export const options = {
  styles: [css],
} satisfies ComponentOptions

export function StatusBadge({ taskStatus = "open" }: StatusBadgeProps = {}) {
  return (
    <span part="badge" data-status={taskStatus}>
      {taskStatus === "done" ? "Done" : "Open"}
    </span>
  )
}
