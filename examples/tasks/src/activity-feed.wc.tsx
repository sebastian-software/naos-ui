import { effect, state, type ComponentOptions } from "@naos-ui/core"
import { bindResource } from "@naos-ui/data"
import { EMPTY_ACTIVITY } from "./api.ts"
import { activityResource } from "./resources.ts"
import css from "./activity-feed.wc.css?inline"

export const options = {
  styles: [css],
} satisfies ComponentOptions

export function ActivityFeed() {
  const entries = state<string[]>([])

  effect(() =>
    bindResource(activityResource, ({ data }) => {
      entries.set(data ?? EMPTY_ACTIVITY)
    })
  )

  return (
    <aside part="root" aria-label="Latest activity" data-entry-count={entries().length}>
      <h2 part="title">Activity</h2>
      <ol part="entries">
        {entries().map((entry) => (
          <li key={entry} data-activity-entry>
            {entry}
          </li>
        ))}
      </ol>
    </aside>
  )
}
