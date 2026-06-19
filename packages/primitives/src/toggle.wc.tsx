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
  createIktiaZagToggleService,
  getIktiaZagToggleApi,
  stopIktiaZagToggleService,
  withoutIktiaZagToggleClick,
} from "./internal/zag/toggle.js"
import type { IktiaZagToggleService } from "./internal/zag/toggle.js"
import css from "./toggle.wc.css?inline"

export type IktiaToggleProps = {
  disabled?: boolean
  label?: string
  name?: string
  pressed?: boolean
  value?: string
}

export const options = {
  styles: [css],
} satisfies ComponentOptions

export function IktiaToggle({
  disabled = false,
  label = "Toggle",
  name = "",
  pressed = false,
  value = "on",
}: IktiaToggleProps = {}) {
  const active = state(pressed)
  const toggleService = state<IktiaZagToggleService | null>(null)
  const toggleApi = computed(() => getIktiaZagToggleApi(toggleService()))
  const rootProps = computed(() =>
    withoutIktiaZagToggleClick(toggleApi()?.getRootProps() ?? {})
  )
  const changed = event<{ pressed: boolean }>("iktia-change")
  const form = formControl({
    value: () => (active() ? value : null),
    reset: () => {
      active.set(pressed)
      toggleApi()?.setPressed(pressed)
    },
    disabled,
  })
  void form
  void name

  onConnected(() => {
    toggleService.set(createIktiaZagToggleService({
      disabled,
      host: host().element,
      id: "iktia-toggle",
      onPressedChange(nextPressed) {
        active.set(nextPressed)
        changed.emit({ pressed: nextPressed })
      },
      pressed: active(),
      root: host().root,
    }))
  })
  onDisconnected(() => {
    stopIktiaZagToggleService(toggleService())
    toggleService.set(null)
  })

  return (
    <button
      {...rootProps()}
      part="root control"
      type="button"
      data-state={active() ? "on" : "off"}
      data-disabled={disabled || undefined}
      aria-pressed={active()}
      disabled={disabled}
      onClick={on("click", () => {
        if (disabled) return
        toggleApi()?.setPressed(!active())
      })}
    >
      <span part="label">
        <slot>{label}</slot>
      </span>
      <span {...(toggleApi()?.getIndicatorProps() ?? {})} part="indicator">
        {active() ? "On" : "Off"}
      </span>
    </button>
  )
}
