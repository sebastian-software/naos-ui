import {
  computed,
  event,
  formControl,
  host,
  on,
  onConnected,
  onDisconnected,
  state,
  type ComponentOptions,
} from "@iktia/core"
import {
  checkboxStateFor,
  createIktiaZagCheckboxService,
  getIktiaZagCheckboxApi,
  stopIktiaZagCheckboxService,
} from "./internal/zag/checkbox.js"
import type { IktiaZagCheckboxService } from "./internal/zag/checkbox.js"
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
  const checkboxService = state<IktiaZagCheckboxService | null>(null)
  const checkboxApi = computed(() => getIktiaZagCheckboxApi(checkboxService()))
  const changed = event<{ checked: boolean; indeterminate: boolean }>("iktia-change")
  const form = formControl({
    value: () => (selected() ? value : null),
    reset: () => {
      selected.set(checked)
      mixed.set(indeterminate)
      checkboxApi()?.setChecked(checkboxStateFor({ checked, indeterminate }))
    },
    disabled,
  })
  void form
  void name

  onConnected(() => {
    checkboxService.set(createIktiaZagCheckboxService({
      checked: selected(),
      disabled,
      host: host().element,
      id: "iktia-checkbox",
      indeterminate: mixed(),
      onCheckedChange(details) {
        selected.set(details.checked)
        mixed.set(details.indeterminate)
        changed.emit(details)
      },
      root: host().root,
      value,
    }))
  })
  onDisconnected(() => {
    stopIktiaZagCheckboxService(checkboxService())
    checkboxService.set(null)
  })

  return (
    <span part="wrapper">
      <input
        {...(checkboxApi()?.getHiddenInputProps() ?? {})}
        disabled={disabled}
        name={undefined}
        value={value}
      />
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
          checkboxApi()?.toggleChecked()
        })}
      >
        <span
          {...(checkboxApi()?.getControlProps() ?? {})}
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
