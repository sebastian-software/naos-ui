import {
  computed,
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
  const switchService = state<ReturnType<typeof switchPrimitive> | null>(null)
  const switchApi = computed(() => switchService()?.api)
  const changed = event<{ checked: boolean }>("naos-change")
  const form = formControl({
    value: () => (active() ? value : null),
    reset: () => {
      active.set(checked)
      switchApi()?.setChecked(checked)
    },
    disabled,
  })
  void form
  void name

  onConnected(() => {
    switchService.set(
      switchPrimitive({
        id: primitiveId("switch"),
        defaultChecked: active(),
        onCheckedChange(next) {
          active.set(next)
          changed.emit({ checked: next })
        },
      }),
    )
  })
  onDisconnected(() => {
    switchService()?.destroy()
    switchService.set(null)
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
        onChange={() => {
          if (!disabled) switchApi()?.toggle()
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
          switchApi()?.toggle()
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
