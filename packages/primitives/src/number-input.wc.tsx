import "@ui-sdk/web/number-input"
import { event, formControl, host, onConnected, state, type ComponentOptions } from "@naos-ui/core"
import css from "./number-input.wc.css?inline"

export type NaosNumberInputProps = {
  disabled?: boolean
  label?: string
  max?: number
  min?: number
  name?: string
  step?: number
  value?: string
}

export const options = { styles: [css] } satisfies ComponentOptions

export function NaosNumberInput({
  disabled = false,
  label = "Number",
  max = 100,
  min = 0,
  name = "",
  step = 1,
  value = "",
}: NaosNumberInputProps = {}) {
  const current = state(value)
  const changed = event<{ value: string; valueAsNumber: number }>("naos-change")
  const form = formControl({
    value: () => current(),
    reset: () => {
      current.set(value)
      const control = host().root.querySelector("ui-number-input")
      if (control) control.value = value === "" ? null : Number(value)
    },
    disabled,
  })
  void form
  void name

  onConnected(() => {
    const control = host().root.querySelector("ui-number-input")
    if (control) control.value = current() === "" ? null : Number(current())
  })

  return (
    <ui-number-input
      part="root"
      default-value={value === "" ? undefined : Number(value)}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      data-state={current() === "" ? "empty" : "filled"}
      data-disabled={disabled || undefined}
      onValuechange={(event) => {
        const next = (event as CustomEvent<{ value: number | null }>).detail.value
        current.set(next === null ? "" : String(next))
        changed.emit({
          value: next === null ? "" : String(next),
          valueAsNumber: next ?? Number.NaN,
        })
      }}
    >
      <label part="label" for="number-input-control">
        {label}
      </label>
      <div part="control">
        <ui-number-input-decrement>
          <button part="decrement" type="button" aria-label={`Decrease ${label}`}>
            -
          </button>
        </ui-number-input-decrement>
        <ui-number-input-control>
          <input
            id="number-input-control"
            part="input"
            role="spinbutton"
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={current() === "" ? undefined : Number(current())}
            disabled={disabled}
          />
        </ui-number-input-control>
        <ui-number-input-increment>
          <button part="increment" type="button" aria-label={`Increase ${label}`}>
            +
          </button>
        </ui-number-input-increment>
      </div>
      <output part="value">{current()}</output>
    </ui-number-input>
  )
}
