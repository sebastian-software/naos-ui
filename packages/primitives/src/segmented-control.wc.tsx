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
  createIktiaZagSegmentedControlService,
  getIktiaZagSegmentedControlApi,
  stopIktiaZagSegmentedControlService,
  syncIktiaSegmentedItems,
} from "./internal/zag/segmented-control.js"
import type { IktiaZagSegmentedControlService } from "./internal/zag/segmented-control.js"
import css from "./segmented-control.wc.css?inline"

export type IktiaSegmentedControlProps = {
  disabled?: boolean
  label?: string
  name?: string
  orientation?: "horizontal" | "vertical"
  value?: string
}

export const options = {
  styles: [css],
} satisfies ComponentOptions

export function IktiaSegmentedControl({
  disabled = false,
  label = "Options",
  name = "",
  orientation = "horizontal",
  value = "",
}: IktiaSegmentedControlProps = {}) {
  const selected = state(value)
  const segmentedService = state<IktiaZagSegmentedControlService | null>(null)
  const segmentedApi = computed(() =>
    getIktiaZagSegmentedControlApi(segmentedService())
  )
  const changed = event<{ value: string }>("iktia-change")
  const form = formControl({
    value: () => selected() || null,
    reset: () => {
      selected.set(value)
      segmentedApi()?.setValue(value ? [value] : [])
    },
    disabled,
  })
  void form
  void name

  onConnected(() => {
    segmentedService.set(createIktiaZagSegmentedControlService({
      disabled,
      host: host().element,
      id: "iktia-segmented-control",
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
    stopIktiaZagSegmentedControlService(segmentedService())
    segmentedService.set(null)
  })
  effect(() => {
    const api = segmentedApi()
    if (api == null) return
    return syncIktiaSegmentedItems({
      api,
      disabled,
      host: host().element,
      onRequestUpdate: () => host().update(),
      orientation,
    })
  })

  return (
    <section
      {...(segmentedApi()?.getRootProps() ?? {})}
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
