import {
  effect,
  event,
  host,
  onConnected,
  onDisconnected,
  state,
  type ComponentOptions,
} from "@naos-ui/core"
import { bindHover } from "./internal/ui-sdk/hover.js"
import { getNaosOverlayStateAttributes } from "./internal/behavior/overlay.js"
import {
  createNaosPresenceSnapshot,
  getNaosPresenceAttributes,
  getNaosPresenceMotionAttributes,
  isNaosPresenceHidden,
  isNaosPresenceOpen,
  nextNaosPresenceSnapshot,
  scheduleNaosPresenceFrame,
  settleNaosPresenceSnapshot,
  waitForNaosPresenceExit,
} from "./internal/behavior/presence.js"
import css from "./tooltip.wc.css?inline"

export type NaosTooltipProps = {
  closeDelay?: number
  disabled?: boolean
  label?: string
  open?: boolean
  openDelay?: number
  text?: string
}

export const options = {
  styles: [css],
} satisfies ComponentOptions

export function NaosTooltip({
  closeDelay = 0,
  disabled = false,
  label = "Help",
  open = false,
  openDelay = 0,
  text = "More information",
}: NaosTooltipProps = {}) {
  const expanded = state(open)
  const presence = state(createNaosPresenceSnapshot(open))
  const changed = event<{ open: boolean }>("naos-open-change")
  const binding = state<ReturnType<typeof bindHover> | null>(null)

  onConnected(() => {
    binding.set(
      bindHover({
        element: host().element,
        root: host().root,
        kind: "tooltip",
        initialOpen: expanded(),
        openDelay,
        closeDelay,
        onOpen(next) {
          expanded.set(next)
          changed.emit({ open: next })
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
    binding()?.syncDelays(openDelay, closeDelay)
  })
  effect(() => {
    const next = nextNaosPresenceSnapshot(presence(), expanded())
    if (next !== presence()) presence.set(next)
  })
  effect(() => {
    const snapshot = presence()
    if (snapshot.phase === "entering") {
      return scheduleNaosPresenceFrame(() => {
        if (expanded()) {
          presence.set(settleNaosPresenceSnapshot(presence(), true))
        }
      })
    }
    if (snapshot.phase !== "closing") return
    const content = host().root.querySelector("[part~='content']")
    return waitForNaosPresenceExit(content instanceof Element ? content : null, () => {
      if (!expanded()) {
        presence.set(settleNaosPresenceSnapshot(presence(), false))
      }
    })
  })

  return (
    <span
      part="root"
      {...getNaosOverlayStateAttributes({
        kind: "tooltip",
        open: isNaosPresenceOpen(presence()),
      })}
      {...getNaosPresenceAttributes(presence())}
      {...getNaosPresenceMotionAttributes()}
    >
      <button
        part="trigger"
        type="button"
        disabled={disabled}
        data-state={expanded() ? "open" : "closed"}
        data-disabled={disabled || undefined}
      >
        <slot name="trigger">{label}</slot>
      </button>
      <span
        part="positioner"
        {...getNaosOverlayStateAttributes({
          kind: "tooltip",
          open: isNaosPresenceOpen(presence()),
        })}
        {...getNaosPresenceAttributes(presence())}
        hidden={isNaosPresenceHidden(presence())}
      >
        <span
          part="content"
          {...getNaosOverlayStateAttributes({
            kind: "tooltip",
            open: isNaosPresenceOpen(presence()),
          })}
          {...getNaosPresenceAttributes(presence())}
          hidden={isNaosPresenceHidden(presence())}
        >
          <slot>{text}</slot>
        </span>
      </span>
    </span>
  )
}
