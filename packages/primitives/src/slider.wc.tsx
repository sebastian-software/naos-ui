import "@ui-sdk/web/slider"
import {
  event,
  formControl,
  host,
  onConnected,
  onDisconnected,
  state,
  type ComponentOptions,
} from "@naos-ui/core"
import { exposeSliderThumb } from "./internal/ui-sdk/slider.js"
import css from "./slider.wc.css?inline"

export type NaosSliderProps = {
  disabled?: boolean
  label?: string
  max?: number
  min?: number
  name?: string
  step?: number
  value?: number
}
export const options = { styles: [css] } satisfies ComponentOptions

export function NaosSlider({
  disabled = false,
  label = "Slider",
  max = 100,
  min = 0,
  name = "",
  step = 1,
  value = 0,
}: NaosSliderProps = {}) {
  let thumb: HTMLInputElement | null = null
  const current = state(value)
  const changed = event<{ value: number }>("naos-change")
  const cleanup = state<(() => void) | null>(null)
  const form = formControl({
    value: () => String(current()),
    reset: () => {
      current.set(value)
      const control = host().root.querySelector("ui-slider")
      if (control) control.value = value
    },
    disabled,
  })
  void form
  void name
  onConnected(() => {
    const control = host().root.querySelector("ui-slider")
    if (control) control.value = current()
    if (thumb) cleanup.set(exposeSliderThumb(thumb))
  })
  onDisconnected(() => {
    cleanup()?.()
    cleanup.set(null)
  })
  return (
    <ui-slider
      part="root"
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      data-state={disabled ? "disabled" : "ready"}
      data-disabled={disabled || undefined}
      data-value={String(current())}
      onValuechange={(event) => {
        const next = (event as CustomEvent<{ value: number | number[] }>).detail.value
        const scalar = Array.isArray(next) ? (next[0] ?? min) : next
        current.set(scalar)
        changed.emit({ value: scalar })
      }}
    >
      <div part="header">
        <span part="label">{label}</span>
        <output part="value">{current()}</output>
      </div>
      <ui-slider-control part="control">
        <ui-slider-track part="track">
          <ui-slider-indicator part="range" />
        </ui-slider-track>
        <ui-slider-thumb>
          <ui-slider-thumb-input>
            <input
              ref={thumb}
              part="thumb"
              aria-label={label}
              aria-valuemin={min}
              aria-valuemax={max}
              aria-valuenow={current()}
              aria-disabled={disabled ? "true" : undefined}
            />
          </ui-slider-thumb-input>
        </ui-slider-thumb>
      </ui-slider-control>
    </ui-slider>
  )
}
