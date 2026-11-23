import {
  effect,
  event,
  formControl,
  host,
  onConnected,
  onDisconnected,
  state,
  type ComponentOptions,
} from "@naos-ui/core"
import { bindOptions, listFormValue } from "./internal/ui-sdk/options.js"
import css from "./listbox.wc.css?inline"

export type NaosListboxProps = {
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

export function NaosListbox({
  disabled = false,
  label = "Options",
  multiple = false,
  name = "",
  orientation = "vertical",
  value = "",
}: NaosListboxProps = {}) {
  const selected = state(value.split(/\s+/).filter(Boolean))
  const binding = state<ReturnType<typeof bindOptions> | null>(null)
  const changed = event<{ value: string[] }>("naos-change")
  const form = formControl({
    value: () => listFormValue(selected(), multiple, name),
    reset: () => {
      const next = value.split(/\s+/).filter(Boolean)
      selected.set(next)
      binding()?.reset(next)
    },
    disabled,
  })
  void form
  void name

  onConnected(() => {
    binding.set(
      bindOptions({
        kind: "listbox",
        element: host().element,
        root: host().root,
        value: selected(),
        onValue(values) {
          selected.set(values)
          changed.emit({ value: values })
        },
      }),
    )
  })
  onDisconnected(() => {
    binding()?.destroy()
    binding.set(null)
  })
  effect(() => {
    binding()?.syncDisabled(disabled)
  })

  return (
    <section
      part="root"
      aria-disabled={disabled || undefined}
      data-state={selected().join(" ") || "none"}
      data-disabled={disabled || undefined}
      data-orientation={orientation}
    >
      <span part="label">{label}</span>
      <div
        part="content"
        role="listbox"
        tabindex={disabled ? -1 : 0}
        aria-orientation={orientation}
        aria-multiselectable={multiple || undefined}
        data-state={selected().join(" ") || "none"}
      >
        <slot name="item" />
      </div>
    </section>
  )
}
