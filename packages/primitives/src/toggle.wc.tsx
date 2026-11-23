import {
  event,
  formControl,
  host,
  onConnected,
  onDisconnected,
  state,
  type ComponentOptions,
} from "@naos-ui/core"
import { toggle } from "@ui-sdk/core/toggle"
import { createBinaryControlBinding } from "./internal/ui-sdk/binary-control.js"
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
  const binding = state<ReturnType<typeof createBinaryControlBinding> | null>(null)
  const changed = event<{ pressed: boolean }>("naos-change")
  const form = formControl({
    value: () => (active() ? value : null),
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
        createBinaryControlBinding({
          element: host().element,
          property: "pressed",
          active,
          flush() {
            host().flushSync()
          },
          onChange(next) {
            changed.emit({ pressed: next })
          },
          create(initial) {
            const service = toggle({
              id: "naos-toggle",
              defaultPressed: initial,
            })
            return {
              set(next, event) {
                return service.api.setPressed(next, event ? { reason: "press", event } : undefined)
              },
              destroy() {
                service.destroy()
              },
            }
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
        binding()?.activate(event)
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
