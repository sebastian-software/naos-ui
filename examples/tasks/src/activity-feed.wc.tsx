import { effect, state, type ComponentOptions } from "@naos-ui/core"
import { activityResource } from "./resources.ts"
import css from "./activity-feed.wc.css?inline"

export const options = {
  styles: [css],
} satisfies ComponentOptions

export function ActivityFeed() {
  const entries = state<string[]>([])

  effect(() => {
    const sync = () => {
      const next = activityResource.snapshot().data ?? []
      if (next.length !== entries().length) {
        entries.set(next)
      }
    }
    const unsubscribe = activityResource.subscribe(sync)
    sync()
    return () => unsubscribe()
  })

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
