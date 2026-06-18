import { event, formControl, on, state, type ComponentOptions } from "@iktia/core"
import {
  checkboxFormValue,
  nextCheckboxState,
} from "./internal/behavior/checkbox.js"
import css from "./checkbox.wc.css?inline"

export type IktiaCheckboxProps = {
  checked?: boolean
  disabled?: boolean
  indeterminate?: boolean
  label?: string
  name?: string
  value?: string
}

export const options = {
  styles: [css],
} satisfies ComponentOptions

export function IktiaCheckbox({
  checked = false,
  disabled = false,
  indeterminate = false,
  label = "Checkbox",
  name = "",
  value = "on",
}: IktiaCheckboxProps = {}) {
  const selected = state(checked)
  const mixed = state(indeterminate)
  const changed = event<{ checked: boolean; indeterminate: boolean }>("iktia-change")
  const form = formControl({
    value: () => checkboxFormValue(selected(), value),
    reset: () => {
      selected.set(checked)
      mixed.set(indeterminate)
    },
    disabled,
  })
  void form
  void name

  return (
    <button
      part="root control"
      type="button"
      role="checkbox"
      aria-checked={mixed() ? "mixed" : selected() ? "true" : "false"}
      data-state={mixed() ? "indeterminate" : selected() ? "checked" : "unchecked"}
      data-disabled={disabled || undefined}
      disabled={disabled}
      onClick={on("click", () => {
        if (disabled) return
        const next = nextCheckboxState({
          checked: selected(),
          indeterminate: mixed(),
        })
        selected.set(next.checked)
        mixed.set(next.indeterminate)
        changed.emit({ checked: selected(), indeterminate: mixed() })
      })}
    >
      <span part="indicator">{mixed() ? "-" : selected() ? "✓" : ""}</span>
      <span part="label">
        <slot>{label}</slot>
      </span>
    </button>
  )
}
