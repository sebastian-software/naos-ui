import {
  effect,
  event,
  host,
  onConnected,
  onDisconnected,
  state,
  type ComponentOptions,
} from "@naos-ui/core"
import { bindMenu } from "./internal/ui-sdk/menu.js"
import { getNaosOverlayStateAttributes } from "./internal/behavior/overlay.js"
import css from "./menu.wc.css?inline"

export type NaosMenuProps = {
  disabled?: boolean
  label?: string
  open?: boolean
}

export const options = {
  styles: [css],
} satisfies ComponentOptions

export function NaosMenu({
  disabled = false,
  label = "Actions",
  open = false,
}: NaosMenuProps = {}) {
  const expanded = state(open)
  const binding = state<ReturnType<typeof bindMenu> | null>(null)
  const opened = event<{ open: boolean }>("naos-open-change")
  const selected = event<{ value: string }>("naos-select")

  onConnected(() => {
    binding.set(
      bindMenu({
        element: host().element,
        root: host().root,
        context: false,
        initialOpen: expanded(),
        onOpen(next) {
          expanded.set(next)
          opened.emit({ open: next })
        },
        onSelect(value) {
          selected.emit({ value })
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
    <div
      part="root"
      data-disabled={disabled || undefined}
      {...getNaosOverlayStateAttributes({
        kind: "menu",
        open: expanded(),
      })}
    >
      <button
        part="trigger"
        type="button"
        data-state={expanded() ? "open" : "closed"}
        disabled={disabled}
      >
        <slot name="trigger">{label}</slot>
      </button>
      <div
        part="positioner"
        {...getNaosOverlayStateAttributes({
          kind: "menu",
          open: expanded(),
        })}
      >
        <div
          part="content"
          {...getNaosOverlayStateAttributes({
            kind: "menu",
            open: expanded(),
          })}
        >
          <slot name="item" />
        </div>
      </div>
    </div>
  )
}
