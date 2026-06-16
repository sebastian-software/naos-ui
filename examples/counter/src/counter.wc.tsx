import { event, state, type ComponentOptions } from "lean-wc"

export type CounterProps = {
  label?: string
}

export const options = {
  shadow: true,
} satisfies ComponentOptions

export function Counter({ label = "Count" }: CounterProps = {}) {
  const count = state(0)
  const change = event<number>("change")

  return (
    <button
      part="button"
      data-count={count()}
      onClick={() => {
        count.set(count() + 1)
        change.emit(count())
      }}
    >
      {label}: {count()}
    </button>
  )
}
