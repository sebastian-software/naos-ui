import { type ComponentOptions } from "@naos-ui/core"
import { ActivityFeed } from "./activity-feed.wc.tsx"
import { TaskList } from "./task-list.wc.tsx"
import css from "./board.wc.css?inline"

export const options = {
  styles: [css],
} satisfies ComponentOptions

export function Board() {
  return (
    <div part="root">
      <TaskList />
      <ActivityFeed />
    </div>
  )
}
