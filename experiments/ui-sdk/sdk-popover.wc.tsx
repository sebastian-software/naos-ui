import "@ui-sdk/web/popover"
import type { PopoverEvents } from "@ui-sdk/web/popover"
import { event } from "@naos-ui/core"

export function LabPopover({
  label = "Open",
  title = "Details",
}: { label?: string; title?: string } = {}) {
  const changed = event<{ open: boolean }>("naos-open-change")
  return (
    <ui-popover
      close-on-outside-press
      onOpenchange={(e) => changed.emit({ open: (e as PopoverEvents["openchange"]).detail.value })}
    >
      <ui-popover-trigger>
        <button part="trigger">
          <slot name="trigger">{label}</slot>
        </button>
      </ui-popover-trigger>
      <ui-popover-content part="content" keep-mounted>
        <ui-popover-title>{title}</ui-popover-title>
        <slot />
        <ui-popover-close>
          <button part="close">Close</button>
        </ui-popover-close>
      </ui-popover-content>
    </ui-popover>
  )
}
