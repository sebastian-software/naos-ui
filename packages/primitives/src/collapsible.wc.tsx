import { event, onConnected, onDisconnected, state, type ComponentOptions } from "@naos-ui/core"
import { collapsible } from "@ui-sdk/core/collapsible"
import css from "./collapsible.wc.css?inline"

export type NaosCollapsibleProps = {
  disabled?: boolean
  label?: string
  open?: boolean
}

export const options = {
  styles: [css],
} satisfies ComponentOptions

export function NaosCollapsible({
  disabled = false,
  label = "Details",
  open = false,
}: NaosCollapsibleProps = {}) {
  const expanded = state(open)
  const controller = state<ReturnType<typeof collapsible> | null>(null)
  const changed = event<{ open: boolean }>("naos-open-change")

  onConnected(() => {
    controller.set(
      collapsible({
        id: "naos-collapsible",
        defaultOpen: expanded(),
        onOpenChange(nextOpen) {
          expanded.set(nextOpen)
          changed.emit({ open: nextOpen })
        },
      }),
    )
  })
  onDisconnected(() => {
    controller()?.destroy()
    controller.set(null)
  })

  return (
    <div
      id="collapsible:naos-collapsible"
      data-scope="collapsible"
      data-part="root"
      part="root"
      data-state={expanded() ? "open" : "closed"}
      data-disabled={disabled || undefined}
    >
      <button
        id="collapsible:naos-collapsible:trigger"
        type="button"
        aria-controls="collapsible:naos-collapsible:content"
        data-scope="collapsible"
        data-part="trigger"
        data-disabled={disabled || undefined}
        onClick={(event) => {
          if (event.defaultPrevented || disabled) return
          controller()?.api.toggle({ reason: "trigger-press", event })
        }}
        part="trigger"
        aria-expanded={expanded() ? "true" : "false"}
        disabled={disabled}
        data-state={expanded() ? "open" : "closed"}
      >
        <span
          data-scope="collapsible"
          data-part="indicator"
          data-disabled={disabled || undefined}
          part="indicator"
          aria-hidden="true"
          data-state={expanded() ? "open" : "closed"}
        >
          {expanded() ? "-" : "+"}
        </span>
        <span part="label">
          <slot name="trigger">{label}</slot>
        </span>
      </button>
      <div
        id="collapsible:naos-collapsible:content"
        hidden={!expanded()}
        data-collapsible=""
        data-scope="collapsible"
        data-part="content"
        data-disabled={disabled || undefined}
        part="content"
        data-state={expanded() ? "open" : "closed"}
      >
        <slot />
      </div>
    </div>
  )
}
