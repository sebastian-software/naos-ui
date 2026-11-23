import {
  effect,
  event,
  host,
  onConnected,
  onDisconnected,
  state,
  type ComponentOptions,
} from "@naos-ui/core"
import "@ui-sdk/web/dialog"
import type { DialogEvents, UiDialogElement } from "@ui-sdk/web/dialog"
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
import css from "./dialog.wc.css?inline"

export type NaosDialogProps = {
  alert?: boolean
  description?: string
  label?: string
  modal?: boolean
  open?: boolean
  title?: string
}

export const options = {
  styles: [css],
} satisfies ComponentOptions

export function NaosDialog({
  alert = false,
  description = "Dialog content",
  label = "Open dialog",
  modal = true,
  open = false,
  title = "Dialog",
}: NaosDialogProps = {}) {
  const expanded = state(open)
  const presence = state(createNaosPresenceSnapshot(open))
  const changed = event<{ open: boolean }>("naos-open-change")

  onConnected(() => {
    const control = host().root.querySelector<UiDialogElement>("ui-dialog")
    if (control) control.open = expanded()
    if (alert && expanded()) {
      setTimeout(
        (root: ShadowRoot) => {
          if (root.querySelector<UiDialogElement>("ui-dialog")?.open)
            root.querySelector<HTMLElement>("[part~=close]")?.focus()
        },
        0,
        host().root,
      )
    }
  })
  effect(() => {
    const content = host().root.querySelector("[part~=content]")
    if (!content) return
    const role = alert ? "alertdialog" : "dialog"
    const applyRole = () => {
      if (content.getAttribute("role") !== role) content.setAttribute("role", role)
    }
    const observer = new MutationObserver(applyRole)
    observer.observe(content, { attributes: true, attributeFilter: ["role"] })
    applyRole()
    return () => observer.disconnect()
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
    <ui-dialog
      default-open={open}
      {...{ modal: alert || modal ? "true" : "false" }}
      {...{ "close-on-outside-press": alert ? "false" : "true" }}
      onOpenchange={(event) => {
        if (event.target !== event.currentTarget) return
        const detail = (event as DialogEvents["openchange"]).detail
        const nextOpen = detail.value
        if (nextOpen === expanded()) return
        expanded.set(nextOpen)
        changed.emit({ open: nextOpen })
        if (alert && nextOpen) {
          setTimeout(
            (root: ShadowRoot) => {
              const control = root.querySelector<UiDialogElement>("ui-dialog")
              const cancel = root.querySelector<HTMLElement>("[part~=close]")
              if (control?.open) cancel?.focus()
            },
            0,
            host().root,
          )
        }
        if (!nextOpen && (detail.reason === "outside-press" || detail.reason === "escape-key")) {
          setTimeout(
            (trigger: Element | null, control: UiDialogElement | null) => {
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
            host().root.querySelector<UiDialogElement>("ui-dialog"),
          )
        }
      }}
      part="root"
      {...getNaosOverlayStateAttributes({
        kind: "dialog",
        modal: alert || modal,
        open: isNaosPresenceOpen(presence()),
      })}
      {...getNaosPresenceAttributes(presence())}
      {...getNaosPresenceMotionAttributes()}
    >
      <ui-dialog-trigger>
        <button
          part="trigger"
          aria-expanded={expanded() ? "true" : "false"}
          data-state={expanded() ? "open" : "closed"}
        >
          <slot name="trigger">{label}</slot>
        </button>
      </ui-dialog-trigger>
      <ui-dialog-backdrop
        part="backdrop"
        {...getNaosOverlayStateAttributes({
          kind: "dialog",
          modal: alert || modal,
          open: isNaosPresenceOpen(presence()),
        })}
        {...getNaosPresenceAttributes(presence())}
        hidden={isNaosPresenceHidden(presence())}
      />
      <div
        part="positioner"
        {...getNaosOverlayStateAttributes({
          kind: "dialog",
          modal: alert || modal,
          open: isNaosPresenceOpen(presence()),
        })}
        {...getNaosPresenceAttributes(presence())}
        hidden={isNaosPresenceHidden(presence())}
      >
        <ui-dialog-content
          keep-mounted
          initial-focus={alert ? "[part~=close]" : undefined}
          part="content"
          aria-modal={alert || modal ? "true" : undefined}
          {...getNaosOverlayStateAttributes({
            kind: "dialog",
            modal: alert || modal,
            open: isNaosPresenceOpen(presence()),
          })}
          {...getNaosPresenceAttributes(presence())}
          hidden={isNaosPresenceHidden(presence())}
        >
          <div part="header">
            <ui-dialog-title as-child>
              <h2 part="title">
                <slot name="title">{title}</slot>
              </h2>
            </ui-dialog-title>
            <ui-dialog-close>
              <button part="close">
                <slot name="close">Close</slot>
              </button>
            </ui-dialog-close>
          </div>
          <ui-dialog-description part="description">
            <slot>{description}</slot>
          </ui-dialog-description>
          <slot name="actions" />
        </ui-dialog-content>
      </div>
    </ui-dialog>
  )
}
