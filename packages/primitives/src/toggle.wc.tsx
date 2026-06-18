import { event, formControl, on, state, type ComponentOptions } from "@iktia/core"
import {
  nextTogglePressed,
  toggleFormValue,
} from "./internal/behavior/toggle.js"
import css from "./toggle.wc.css?inline"

export type IktiaToggleProps = {
  disabled?: boolean
  label?: string
  name?: string
  pressed?: boolean
  value?: string
}

export const options = {
  styles: [css],
} satisfies ComponentOptions

export function IktiaToggle({
  disabled = false,
  label = "Toggle",
  name = "",
  pressed = false,
  value = "on",
}: IktiaToggleProps = {}) {
  const active = state(pressed)
  const changed = event<{ pressed: boolean }>("iktia-change")
  const form = formControl({
    value: () => toggleFormValue(active(), value),
    reset: () => {
      active.set(pressed)
    },
    disabled,
  })
  void form
  void name

  return (
    <button
      part="root control"
      type="button"
      data-state={active() ? "on" : "off"}
      data-disabled={disabled || undefined}
      aria-pressed={active()}
      disabled={disabled}
      onClick={on("click", () => {
        if (disabled) return
        active.set(nextTogglePressed(active()))
        changed.emit({ pressed: active() })
      })}
    >
      <span part="label">
        <slot>{label}</slot>
      </span>
      <span part="indicator">{active() ? "On" : "Off"}</span>
    </button>
  )
}
