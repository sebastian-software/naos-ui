import {
  computed,
  event,
  formControl,
  onConnected,
  onDisconnected,
  state,
  type ComponentOptions,
} from "@naos-ui/core"
import { checkbox } from "@ui-sdk/core/checkbox"
import { primitiveId } from "./internal/ui-sdk/id.js"
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
  const checkboxService = state<ReturnType<typeof checkbox> | null>(null)
  const checkboxApi = computed(() => checkboxService()?.api)
  const changed = event<{ checked: boolean; indeterminate: boolean }>("naos-change")
  const form = formControl({
    value: () => (selected() ? value : null),
    reset: () => {
      selected.set(checked)
      mixed.set(indeterminate)
      checkboxApi()?.setChecked(indeterminate ? "indeterminate" : checked)
    },
    disabled,
  })
  void form
  void name

  onConnected(() => {
    checkboxService.set(
      checkbox({
        id: primitiveId("checkbox"),
        defaultChecked: mixed() ? "indeterminate" : selected(),
        onCheckedChange(next) {
          selected.set(next === true)
          mixed.set(next === "indeterminate")
          changed.emit({ checked: next === true, indeterminate: next === "indeterminate" })
        },
      }),
    )
  })
  onDisconnected(() => {
    checkboxService()?.destroy()
    checkboxService.set(null)
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
          checkboxApi()?.toggle()
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
