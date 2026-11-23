import { radioGroup } from "@ui-sdk/core/radio"
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
} from "@naos-ui/core"
import { createNaosRadioGroupContextController } from "./internal/ui-sdk/radio-group.js"
import type { NaosRadioGroupContextController } from "./internal/ui-sdk/radio-group.js"
import { primitiveId } from "./internal/ui-sdk/id.js"
import css from "./radio-group.wc.css?inline"

export type NaosRadioGroupProps = {
  disabled?: boolean
  label?: string
  name?: string
  orientation?: "horizontal" | "vertical"
  value?: string
}

export const options = {
  styles: [css],
} satisfies ComponentOptions

export function NaosRadioGroup({
  disabled = false,
  label = "Options",
  name = "",
  orientation = "vertical",
  value = "",
}: NaosRadioGroupProps = {}) {
  const selected = state(value)
  const radioContext = state<NaosRadioGroupContextController | null>(null)
  const radioService = state<ReturnType<typeof radioGroup> | null>(null)
  const radioApi = computed(() => radioService()?.api)
  const changed = event<{ value: string }>("naos-change")
  const form = formControl({
    value: () => selected() || null,
    reset: () => {
      selected.set(value)
      if (value) radioApi()?.setValue(value)
      else radioApi()?.setValue(null)
    },
    disabled,
  })
  void form
  void name

  onConnected(() => {
    radioService.set(
      radioGroup({
        id: primitiveId("radio-group"),
        name,
        onValueChange(nextValue) {
          selected.set(nextValue ?? "")
          changed.emit({ value: nextValue ?? "" })
        },
        defaultValue: selected(),
      }),
    )
    radioContext.set(
      createNaosRadioGroupContextController({
        host: host().element,
        onRequestUpdate: () => host().update(),
      }),
    )
  })
  onDisconnected(() => {
    radioContext()?.destroy()
    radioContext.set(null)
    radioService()?.destroy()
    radioService.set(null)
  })
  effect(() => {
    const api = radioApi()
    const context = radioContext()
    if (api == null || context == null) return
    void selected()
    context.update({
      api,
      disabled,
      orientation,
    })
  })

  return (
    <section
      role="radiogroup"
      aria-label={label}
      part="root"
      aria-disabled={disabled || undefined}
      data-state={selected() || "none"}
      data-disabled={disabled || undefined}
      data-orientation={orientation}
    >
      <span part="label">{label}</span>
      <div part="items">
        <slot />
      </div>
    </section>
  )
}
