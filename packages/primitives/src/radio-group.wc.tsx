import {
  computed,
  effect,
  event,
  formControl,
  host,
  onConnected,
  onDisconnected,
  state,
  type ComponentOptions,
} from "@iktia/core"
import {
  createIktiaZagRadioGroupService,
  getIktiaZagRadioGroupApi,
  stopIktiaZagRadioGroupService,
  syncIktiaRadioGroupItems,
} from "./internal/zag/radio-group.js"
import type { IktiaZagRadioGroupService } from "./internal/zag/radio-group.js"
import css from "./radio-group.wc.css?inline"

export type IktiaRadioGroupProps = {
  disabled?: boolean
  label?: string
  name?: string
  orientation?: "horizontal" | "vertical"
  value?: string
}

export const options = {
  styles: [css],
} satisfies ComponentOptions

export function IktiaRadioGroup({
  disabled = false,
  label = "Options",
  name = "",
  orientation = "vertical",
  value = "",
}: IktiaRadioGroupProps = {}) {
  const selected = state(value)
  const radioService = state<IktiaZagRadioGroupService | null>(null)
  const radioApi = computed(() => getIktiaZagRadioGroupApi(radioService()))
  const changed = event<{ value: string }>("iktia-change")
  const form = formControl({
    value: () => selected() || null,
    reset: () => {
      selected.set(value)
      if (value) radioApi()?.setValue(value)
      else radioApi()?.clearValue()
    },
    disabled,
  })
  void form
  void name

  onConnected(() => {
    radioService.set(createIktiaZagRadioGroupService({
      disabled,
      host: host().element,
      id: "iktia-radio-group",
      name,
      onValueChange(nextValue) {
        selected.set(nextValue)
        changed.emit({ value: nextValue })
      },
      orientation,
      root: host().root,
      value: selected(),
    }))
  })
  onDisconnected(() => {
    stopIktiaZagRadioGroupService(radioService())
    radioService.set(null)
  })
  effect(() => {
    const api = radioApi()
    if (api == null) return
    return syncIktiaRadioGroupItems({
      api,
      disabled,
      host: host().element,
      onRequestUpdate: () => host().update(),
      orientation,
    })
  })

  return (
    <section
      {...(radioApi()?.getRootProps() ?? {})}
      part="root"
      aria-disabled={disabled || undefined}
      data-state={selected() || "none"}
      data-disabled={disabled || undefined}
      data-orientation={orientation}
    >
      <span {...(radioApi()?.getLabelProps() ?? {})} part="label">
        {label}
      </span>
      <div part="items">
        <slot />
      </div>
    </section>
  )
}
