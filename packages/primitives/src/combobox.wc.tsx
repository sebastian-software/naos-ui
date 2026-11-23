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
import css from "./combobox.wc.css?inline"

export type NaosComboboxProps = {
  disabled?: boolean
  freeText?: boolean
  label?: string
  name?: string
  placeholder?: string
  value?: string
}

export const options = {
  styles: [css],
} satisfies ComponentOptions

export function NaosCombobox({
  disabled = false,
  freeText = false,
  label = "Options",
  name = "",
  placeholder = "Search options",
  value = "",
}: NaosComboboxProps = {}) {
  const selected = state(value)
  const committed = state(value)
  const open = state(false)
  const binding = state<ReturnType<typeof bindOptions> | null>(null)
  const changed = event<{ value: string }>("naos-change")
  const inputChanged = event<{ inputValue: string }>("naos-input")
  const opened = event<{ open: boolean }>("naos-open-change")
  const form = formControl({
    value: () => (freeText ? selected() : selected() || null),
    reset: () => {
      selected.set(value)
      committed.set(value)
      binding()?.reset(value ? [value] : [])
    },
    disabled,
  })
  void form
  void name

  onConnected(() => {
    binding.set(
      bindOptions({
        kind: "combobox",
        freeText,
        element: host().element,
        root: host().root,
        value: selected() ? [selected()] : [],
        onValue(values) {
          const next = values[0] ?? ""
          selected.set(next)
          if (next !== committed()) {
            committed.set(next)
            changed.emit({ value: next })
          }
        },
        onOpen(next) {
          open.set(next)
          opened.emit({ open: next })
        },
        onDraft(next) {
          selected.set(next)
        },
        onCommit(next) {
          selected.set(next)
          if (next !== committed()) {
            committed.set(next)
            changed.emit({ value: next })
          }
        },
        onInput(next) {
          inputChanged.emit({ inputValue: next })
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
      {...getNaosOverlayStateAttributes({
        kind: "combobox",
        open: open(),
      })}
      data-disabled={disabled || undefined}
    >
      <label part="label">{label}</label>
      <div part="control">
        <input
          part="input"
          role="combobox"
          aria-autocomplete="list"
          placeholder={placeholder}
          disabled={disabled}
          data-state={open() ? "open" : "closed"}
        />
        <button
          part="trigger"
          type="button"
          aria-label={label}
          disabled={disabled}
          data-state={open() ? "open" : "closed"}
        >
          v
        </button>
      </div>
      <div
        part="positioner"
        {...getNaosOverlayStateAttributes({
          kind: "combobox",
          open: open(),
        })}
      >
        <div
          part="content"
          {...getNaosOverlayStateAttributes({
            kind: "combobox",
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
