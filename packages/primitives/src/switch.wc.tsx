import {
  effect,
  host,
  event,
  formControl,
  onConnected,
  onDisconnected,
  state,
  type ComponentOptions,
} from "@naos-ui/core"
import { switchPrimitive } from "@ui-sdk/core/switch"
import { primitiveId } from "./internal/ui-sdk/id.js"
import { createBinaryControlBinding } from "./internal/ui-sdk/binary-control.js"
import css from "./switch.wc.css?inline"

export type NaosSwitchProps = {
  checked?: boolean
  disabled?: boolean
  label?: string
  name?: string
  value?: string
}

export const options = {
  styles: [css],
} satisfies ComponentOptions

export function NaosSwitch({
  checked = false,
  disabled = false,
  label = "Switch",
  name = "",
  value = "on",
}: NaosSwitchProps = {}) {
  const active = state(checked)
  const binding = state<ReturnType<typeof createBinaryControlBinding> | null>(null)
  const changed = event<{ checked: boolean }>("naos-change")
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
          property: "checked",
          active,
          flush() {
            host().flushSync()
          },
          onChange(next) {
            changed.emit({ checked: next })
          },
          create(initial) {
            const service = switchPrimitive({
              id: primitiveId("switch"),
              defaultChecked: initial,
            })
            return {
              set(next, event) {
                return service.api.setChecked(next, event ? { reason: "press", event } : undefined)
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

  effect(() => {
    const input = host().root.querySelector("input")
    if (input) input.checked = active()
  })

  return (
    <label
      part="root control"
      data-state={active() ? "checked" : "unchecked"}
      data-disabled={disabled || undefined}
    >
      <input
        type="checkbox"
        tabindex={-1}
        aria-hidden="true"
        onChange={(event) => {
          if (!disabled) binding()?.activate(event)
        }}
        disabled={disabled}
        name={undefined}
        value={value}
      />
      <span
        part="track"
        role="switch"
        tabindex={disabled ? -1 : 0}
        aria-labelledby="switch-label"
        aria-disabled={disabled || undefined}
        onKeyDown={(event) => {
          if (disabled || event.key !== " ") return
          event.preventDefault()
          binding()?.activate(event)
        }}
        aria-checked={active() ? "true" : "false"}
        data-state={active() ? "checked" : "unchecked"}
      >
        <span part="thumb" data-state={active() ? "checked" : "unchecked"} />
      </span>
      <span part="label" id="switch-label">
        <slot>{label}</slot>
      </span>
    </label>
  )
}
