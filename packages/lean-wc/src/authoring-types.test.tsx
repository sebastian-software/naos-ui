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

