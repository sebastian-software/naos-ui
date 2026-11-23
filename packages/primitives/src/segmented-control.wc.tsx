import { segmentedControl } from "@ui-sdk/core/segmented-control"
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
import { syncNaosSegmentedItems } from "./internal/ui-sdk/segmented-control.js"
import { primitiveId } from "./internal/ui-sdk/id.js"
import css from "./segmented-control.wc.css?inline"

export type NaosSegmentedControlProps = {
  disabled?: boolean
  label?: string
  name?: string
  orientation?: "horizontal" | "vertical"
  value?: string
}

export const options = {
  styles: [css],
} satisfies ComponentOptions

export function NaosSegmentedControl({
  disabled = false,
  label = "Options",
  name = "",
  orientation = "horizontal",
  value = "",
}: NaosSegmentedControlProps = {}) {
  const selected = state(value)
  const segmentedService = state<ReturnType<typeof segmentedControl> | null>(null)
  const segmentedApi = computed(() => segmentedService()?.api)
  const changed = event<{ value: string }>("naos-change")
  const form = formControl({
    value: () => selected() || null,
    reset: () => {
      selected.set(value)
      segmentedApi()?.setValue(value || null)
    },
    disabled,
  })
  void form
  void name

  onConnected(() => {
    segmentedService.set(
      segmentedControl({
        id: primitiveId("segmented-control"),
        onValueChange(nextValue) {
          selected.set(nextValue ?? "")
          changed.emit({ value: nextValue ?? "" })
        },
        orientation,
        defaultValue: selected(),
      }),
    )
  })
  onDisconnected(() => {
    segmentedService()?.destroy()
    segmentedService.set(null)
  })
  effect(() => {
    const api = segmentedApi()
    void selected()
    if (api == null) return
    return syncNaosSegmentedItems({
      api,
      disabled,
      host: host().element,
      onRequestUpdate: () => host().update(),
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
