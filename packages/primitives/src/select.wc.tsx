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
import { bindOptions } from "./internal/ui-sdk/options.js"
import { getNaosOverlayStateAttributes } from "./internal/behavior/overlay.js"
import css from "./select.wc.css?inline"

export type NaosSelectProps = {
  disabled?: boolean
  label?: string
  name?: string
  placeholder?: string
  value?: string
}

export const options = {
  styles: [css],
} satisfies ComponentOptions

export function NaosSelect({
  disabled = false,
  label = "Options",
  name = "",
  placeholder = "Select an option",
  value = "",
}: NaosSelectProps = {}) {
  const selected = state(value)
  const open = state(false)
  const selectedLabel = state("")
  const binding = state<ReturnType<typeof bindOptions> | null>(null)
  const changed = event<{ value: string }>("naos-change")
  const opened = event<{ open: boolean }>("naos-open-change")
  const form = formControl({
    value: () => selected() || null,
    reset: () => {
      selected.set(value)
      binding()?.reset(value ? [value] : [])
    },
    disabled,
  })
  void form
  void name

  onConnected(() => {
    binding.set(
      bindOptions({
        kind: "select",
        element: host().element,
        root: host().root,
        value: selected() ? [selected()] : [],
        onValue(values) {
          const next = values[0] ?? ""
          selected.set(next)
          changed.emit({ value: next })
        },
        onOpen(next) {
          open.set(next)
          opened.emit({ open: next })
        },
        onLabel(next) {
          selectedLabel.set(next)
        },
      }),
    )
  })
  onDisconnected(() => {
    binding()?.destroy()
    binding.set(null)
    open.set(false)
  })
  effect(() => {
    binding()?.syncDisabled(disabled)
  })

  return (
    <section
      part="root"
      data-disabled={disabled || undefined}
      {...getNaosOverlayStateAttributes({
        kind: "select",
        open: open(),
      })}
    >
      <span part="label">{label}</span>
      <div part="control">
        <button
          part="trigger"
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          disabled={disabled}
          data-state={open() ? "open" : "closed"}
        >
          <span part="value">{selectedLabel() || placeholder}</span>
          <span part="indicator">v</span>
        </button>
      </div>
      <div
        part="positioner"
        {...getNaosOverlayStateAttributes({
          kind: "select",
          open: open(),
        })}
      >
        <div
          part="content"
          {...getNaosOverlayStateAttributes({
            kind: "select",
            open: open(),
          })}
        >
          <div part="list" role="listbox">
            <slot name="item" />
          </div>
        </div>
      </div>
    </section>
  )
}
