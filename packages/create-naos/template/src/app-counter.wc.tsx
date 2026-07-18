import { event, state, type ComponentOptions } from "@naos-ui/core"
import css from "./app-counter.wc.css?inline"

export const options = {
  styles: [css],
} satisfies ComponentOptions

export type AppCounterProps = {
  label?: string
}

export function AppCounter({ label = "Naos" }: AppCounterProps = {}) {
  const count = state(0)
  const change = event<number>("change")

  return (
    <button
      part="button"
      data-count={count()}
      aria-label={`${label}: ${count()}`}
      onClick={() => {
        count.set(count() + 1)
        change.emit(count())
      }}
    >
      {`${label}: ${count()}`}
    </button>
  )
}
