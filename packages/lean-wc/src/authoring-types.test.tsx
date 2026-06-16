/** @jsxImportSource lean-wc */
import { component, event, prop, state } from "lean-wc"

component("x-counter", { shadow: true }, () => {
  const label = prop.string("label", "Count")
  const enabled = prop.boolean("enabled", true)
  const count = state(0)
  const change = event<number>("change")
  const ready = event<void>("ready")

  label.set("Next")
  enabled.update((value) => !value)
  count.update((value) => value + 1)
  change.emit(count())
  ready.emit()

  // @ts-expect-error numeric events require numeric detail
  change.emit("wrong")

  // @ts-expect-error boolean props reject string values
  enabled.set("true")

  return (
    <button
      class="counter"
      data-count={count()}
      disabled={!enabled()}
      onClick={() => {
        count.set(count() + 1)
        change.emit(count())
      }}
    >
      <slot name="icon" />
      {label()}: {count()}
    </button>
  )
})

type FunctionCounterProps = {
  enabled?: boolean
  label?: string
  onChange?: (event: CustomEvent<number>) => void
}

function FunctionCounter({
  enabled = true,
  label = "Count",
  onChange,
}: FunctionCounterProps = {}) {
  const count = state(0)
  const change = event<number>("change")

  return (
    <button
      disabled={!enabled}
      onClick={() => {
        count.update((value) => value + 1)
        change.emit(count())
        onChange?.(new CustomEvent("change", { detail: count() }))
      }}
    >
      {label}: {count()}
    </button>
  )
}

;<FunctionCounter
  enabled
  label="Clicks"
  onChange={(event) => {
    const detail: number = event.detail
    return detail
  }}
/>

// @ts-expect-error label rejects numeric values
;<FunctionCounter label={1} />
