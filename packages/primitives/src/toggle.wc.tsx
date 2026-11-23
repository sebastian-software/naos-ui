import {
  event,
  formControl,
  onConnected,
  onDisconnected,
  state,
  type ComponentOptions,
} from "@naos-ui/core"
import { toggle } from "@ui-sdk/core/toggle"
import css from "./toggle.wc.css?inline"

export type NaosToggleProps = {
  disabled?: boolean
  label?: string
  name?: string
  pressed?: boolean
  value?: string
}

export const options = {
  styles: [css],
} satisfies ComponentOptions

export function NaosToggle({
  disabled = false,
  label = "Toggle",
  name = "",
  pressed = false,
  value = "on",
}: NaosToggleProps = {}) {
  const active = state(pressed)
  const controller = state<ReturnType<typeof toggle> | null>(null)
  const changed = event<{ pressed: boolean }>("naos-change")
  const form = formControl({
    value: () => (active() ? value : null),
    reset: () => {
      controller()?.api.setPressed(pressed)
    },
    disabled,
  })
  void form
  void name

  onConnected(() => {
    controller.set(
      toggle({
        id: "naos-toggle",
        defaultPressed: active(),
        onPressedChange(nextPressed) {
          active.set(nextPressed)
          changed.emit({ pressed: nextPressed })
        },
      }),
    )
  })
  onDisconnected(() => {
    controller()?.destroy()
    controller.set(null)
  })

  return (
    <button
      data-scope="toggle"
      data-part="root"
      data-pressed={active() || undefined}
      part="root control"
      type="button"
      data-state={active() ? "on" : "off"}
      data-disabled={disabled || undefined}
      aria-pressed={active()}
      disabled={disabled}
      onClick={(event) => {
        if (disabled || event.defaultPrevented) return
        controller()?.api.toggle({ reason: "press", event })
      }}
    >
      <span part="label">
        <slot>{label}</slot>
      </span>
      <span
        part="indicator"
        data-scope="toggle"
        data-part="indicator"
        data-disabled={disabled || undefined}
        data-pressed={active() || undefined}
        data-state={active() ? "on" : "off"}
      >
        {active() ? "On" : "Off"}
      </span>
    </button>
  )
}
