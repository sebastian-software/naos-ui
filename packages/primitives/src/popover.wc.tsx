import { effect, event, host, onConnected, state, type ComponentOptions } from "@naos-ui/core"
import "@ui-sdk/web/popover"
import type { PopoverEvents, UiPopoverElement } from "@ui-sdk/web/popover"
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
import css from "./popover.wc.css?inline"

export type NaosPopoverProps = {
  label?: string
  modal?: boolean
  open?: boolean
  title?: string
}

export const options = {
  styles: [css],
} satisfies ComponentOptions

export function NaosPopover({
  label = "Open",
  modal = false,
  open = false,
  title = "Details",
}: NaosPopoverProps = {}) {
  const expanded = state(open)
  const presence = state(createNaosPresenceSnapshot(open))
  const changed = event<{ open: boolean }>("naos-open-change")

  onConnected(() => {
    const control = host().root.querySelector<UiPopoverElement>("ui-popover")
    if (control) control.open = expanded()
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
    <ui-popover
      default-open={open}
      {...{ modal: modal ? "true" : "false" }}
      close-on-outside-press
      onOpenchange={(event) => {
        if (event.target !== event.currentTarget) return
        const detail = (event as PopoverEvents["openchange"]).detail
        const nextOpen = detail.value
        if (nextOpen === expanded()) return
        expanded.set(nextOpen)
        changed.emit({ open: nextOpen })
        if (!nextOpen && (detail.reason === "outside-press" || detail.reason === "escape-key")) {
          setTimeout(
            (trigger: Element | null, control: UiPopoverElement | null) => {
              if (
                trigger instanceof HTMLElement &&
                trigger.isConnected &&
                control &&
                !control.open
              ) {
                trigger.focus()
              }
            },
            0,
            host().root.querySelector("[part~=trigger]"),
            host().root.querySelector<UiPopoverElement>("ui-popover"),
          )
        }
      }}
      part="root"
      {...getNaosOverlayStateAttributes({
        kind: "popover",
        modal,
        open: isNaosPresenceOpen(presence()),
      })}
      {...getNaosPresenceAttributes(presence())}
      {...getNaosPresenceMotionAttributes()}
    >
      <ui-popover-trigger>
        <button
          part="trigger"
          aria-expanded={expanded() ? "true" : "false"}
          data-state={expanded() ? "open" : "closed"}
        >
          <slot name="trigger">{label}</slot>
        </button>
      </ui-popover-trigger>
      <div
        part="positioner"
        {...getNaosOverlayStateAttributes({
          kind: "popover",
          modal,
          open: isNaosPresenceOpen(presence()),
        })}
        {...getNaosPresenceAttributes(presence())}
        hidden={isNaosPresenceHidden(presence())}
      >
        <ui-popover-content
          keep-mounted
          initial-focus="none"
          {...{ align: "start" }}
          part="content"
          {...getNaosOverlayStateAttributes({
            kind: "popover",
            modal,
            open: isNaosPresenceOpen(presence()),
          })}
          {...getNaosPresenceAttributes(presence())}
          hidden={isNaosPresenceHidden(presence())}
        >
          <div part="header">
            <ui-popover-title as-child>
              <h2 part="title">
                <slot name="title">{title}</slot>
              </h2>
            </ui-popover-title>
            <ui-popover-close>
              <button part="close">
                <slot name="close">Close</slot>
              </button>
            </ui-popover-close>
          </div>
          <ui-popover-description part="description">
            <slot />
          </ui-popover-description>
        </ui-popover-content>
      </div>
    </ui-popover>
  )
}
