import { toggleGroup } from "@ui-sdk/core/toggle"
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
import {
  parseNaosToggleGroupValue,
  serializeNaosToggleGroupValue,
  syncNaosToggleGroupItems,
  toggleGroupFormValue,
} from "./internal/ui-sdk/toggle-group.js"
import { primitiveId } from "./internal/ui-sdk/id.js"
import css from "./toggle-group.wc.css?inline"

export type NaosToggleGroupProps = {
  disabled?: boolean
  label?: string
  multiple?: boolean
  name?: string
  orientation?: "horizontal" | "vertical"
  value?: string
}

export const options = {
  styles: [css],
} satisfies ComponentOptions

export function NaosToggleGroup({
  disabled = false,
  label = "Options",
  multiple = false,
  name = "",
  orientation = "horizontal",
  value = "",
}: NaosToggleGroupProps = {}) {
  const selected = state(parseNaosToggleGroupValue(value).slice(0, multiple ? undefined : 1))
  const toggleGroupService = state<ReturnType<typeof toggleGroup> | null>(null)
  const toggleGroupApi = computed(() => toggleGroupService()?.api)
  const changed = event<{ value: string[] }>("naos-change")
  const form = formControl({
    value: () =>
      toggleGroupFormValue({
        multiple,
        orientation,
        defaultValue: selected(),
      }),
    )
  })
  onDisconnected(() => {
    toggleGroupService()?.destroy()
    toggleGroupService.set(null)
  })
  effect(() => {
    const service = toggleGroupService()
    if (service == null) return
    service.setOptions({
      id: service.id,
      multiple,
      orientation,
      onValueChange(nextValue) {
        selected.set(nextValue)
        changed.emit({ value: nextValue })
      },
    })
    const api = service.api
    if (!multiple && selected().length > 1) api.setValue(selected().slice(0, 1))
    return syncNaosToggleGroupItems({
      api,
      disabled,
      host: host().element,
      multiple,
      onRequestUpdate: () => host().update(),
      orientation,
    })
  })

  return (
    <section
      role={multiple ? "group" : "radiogroup"}
      aria-label={label}
      part="root"
      aria-disabled={disabled || undefined}
      data-state={serializeNaosToggleGroupValue(selected()) || "none"}
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
