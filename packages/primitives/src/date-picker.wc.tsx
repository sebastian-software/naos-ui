import "@ui-sdk/web/date-picker"
import {
  event,
  formControl,
  host,
  onConnected,
  onDisconnected,
  state,
  type ComponentOptions,
} from "@naos-ui/core"
import { decorateCalendar } from "./internal/ui-sdk/date-picker.js"
import css from "./date-picker.wc.css?inline"

export type NaosDatePickerProps = {
  disabled?: boolean
  label?: string
  locale?: string
  name?: string
  placeholder?: string
  readOnly?: boolean
  required?: boolean
  value?: string
}
export const options = { styles: [css] } satisfies ComponentOptions
export function NaosDatePicker({
  disabled = false,
  label = "Date",
  locale = "en-US",
  name = "",
  placeholder = "mm/dd/yyyy",
  readOnly = false,
  required = false,
  value = "",
}: NaosDatePickerProps = {}) {
  const current = state(value)
  const opened = state(false)
  const focused = state("")
  const cleanup = state<(() => void) | null>(null)
  const changed = event<{ value: string }>("naos-change")
  const focusChanged = event<{ focusedValue: string }>("naos-focus-change")
  const openChanged = event<{ open: boolean }>("naos-open-change")
  const form = formControl({
    value: () => current() || null,
    reset: () => {
      current.set(value)
      const picker = host().root.querySelector("ui-date-picker")
      if (picker) picker.value = value || null
    },
    disabled,
  })
  void form
  void name
  onConnected(() => {
    const picker = host().root.querySelector("ui-date-picker")
    if (picker) {
      picker.value = current() || null
      if (current()) picker.month = current().slice(0, 7)
    }
    cleanup.set(decorateCalendar(host().root))
  })
  onDisconnected(() => {
    cleanup()?.()
    cleanup.set(null)
  })
  return (
    <ui-date-picker
      part="root"
      locale={locale}
      fixed-weeks
      disabled={disabled}
      readonly={readOnly}
      required={required}
      data-state={opened() ? "open" : "closed"}
      data-disabled={disabled || undefined}
      data-readonly={readOnly || undefined}
      data-value={current()}
      data-focused-value={focused()}
      onValuechange={(event) => {
        const next = (event as CustomEvent<{ value: string | null }>).detail.value ?? ""
        current.set(next)
        changed.emit({ value: next })
      }}
      onOpenchange={(event) => {
        const next = (event as CustomEvent<{ value: boolean }>).detail.value
        opened.set(next)
        openChanged.emit({ open: next })
      }}
    >
      <label part="label" for="date-picker-input">
        {label}
      </label>
      <div part="control">
        <ui-date-picker-input>
          <input
            id="date-picker-input"
            part="input"
            placeholder={placeholder}
            disabled={disabled}
          />
        </ui-date-picker-input>
        <ui-date-picker-trigger>
          <button type="button" part="trigger" aria-haspopup="grid" disabled={disabled}>
            Pick
          </button>
        </ui-date-picker-trigger>
        <ui-date-picker-clear>
          <button type="button" part="clear" disabled={disabled}>
            Clear
          </button>
        </ui-date-picker-clear>
      </div>
      <ui-date-picker-content part="content" data-state={opened() ? "open" : "closed"}>
        <div part="header">
          <ui-calendar-previous>
            <button type="button" part="prev">
              Prev
            </button>
          </ui-calendar-previous>
          <ui-calendar-heading part="range" />
          <ui-calendar-next>
            <button type="button" part="next">
              Next
            </button>
          </ui-calendar-next>
        </div>
        <ui-calendar-grid
          id="naos-date-picker-grid"
          part="table"
          onFocusin={(event) => {
            const target = event.target as HTMLElement
            const date = target.getAttribute("value")
            if (date) {
              focused.set(date)
              focusChanged.emit({ focusedValue: date })
            }
          }}
        />
      </ui-date-picker-content>
    </ui-date-picker>
  )
}
