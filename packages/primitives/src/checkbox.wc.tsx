import {
  event,
  formControl,
  host,
  onConnected,
  onDisconnected,
  state,
  type ComponentOptions,
} from "@naos-ui/core"
import { createCheckboxBinding } from "./internal/ui-sdk/checkbox.js"
import css from "./checkbox.wc.css?inline"

export type NaosCheckboxProps = {
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

export function NaosCheckbox({
  checked = false,
  disabled = false,
  indeterminate = false,
  label = "Checkbox",
  name = "",
  value = "on",
}: NaosCheckboxProps = {}) {
  const selected = state(checked)
  const mixed = state(indeterminate)
  const binding = state<ReturnType<typeof createCheckboxBinding> | null>(null)
  const changed = event<{ checked: boolean; indeterminate: boolean }>("naos-change")
  const form = formControl({
    value: () => (selected() ? value : null),
    reset: () => {
      binding()?.reset()
    },
    disabled,
  })
  void form
  void name

  onConnected(() => {
    if (!binding()) {
      binding.set(
        createCheckboxBinding({
          element: host().element,
          selected,
          mixed,
          flush() {
            host().flushSync()
          },
          onChange(nextChecked, nextMixed) {
            changed.emit({ checked: nextChecked, indeterminate: nextMixed })
          },
        }),
      )
    }
    binding()?.connect()
  })
  onDisconnected(() => {
    binding()?.disconnect()
  })

  return (
    <span part="wrapper">
      <button
        part="root control"
        type="button"
        role="checkbox"
        aria-checked={mixed() ? "mixed" : selected() ? "true" : "false"}
        data-state={mixed() ? "indeterminate" : selected() ? "checked" : "unchecked"}
        data-disabled={disabled || undefined}
        disabled={disabled}
        onClick={() => {
          if (disabled) return
          binding()?.toggle()
        }}
      >
        <span
          part="indicator"
          data-state={mixed() ? "indeterminate" : selected() ? "checked" : "unchecked"}
        >
          {mixed() ? "-" : selected() ? "✓" : ""}
        </span>
        <span part="label">
          <slot>{label}</slot>
        </span>
      </button>
    </span>
  )
}
