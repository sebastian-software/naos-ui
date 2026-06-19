import {
  computed,
  effect,
  event,
  host,
  onConnected,
  onDisconnected,
  state,
  type ComponentOptions,
} from "@iktia/core"
import {
  createIktiaZagMenuService,
  getIktiaZagMenuApi,
  stopIktiaZagMenuService,
  syncIktiaMenuItems,
} from "./internal/zag/menu.js"
import type { IktiaZagMenuService } from "./internal/zag/menu.js"
import css from "./menu.wc.css?inline"

export type IktiaMenuProps = {
  disabled?: boolean
  label?: string
  open?: boolean
}

export const options = {
  styles: [css],
} satisfies ComponentOptions

export function IktiaMenu({
  disabled = false,
  label = "Actions",
  open = false,
}: IktiaMenuProps = {}) {
  const expanded = state(open)
  const highlighted = state<string | null>(null)
  const menuService = state<IktiaZagMenuService | null>(null)
  const menuApi = computed(() => getIktiaZagMenuApi(menuService()))
  const opened = event<{ open: boolean }>("iktia-open-change")
  const selected = event<{ value: string }>("iktia-select")

  onConnected(() => {
    const hostElement = host().element
    menuService.set(createIktiaZagMenuService({
      disabled,
      host: hostElement,
      id: "iktia-menu",
      label,
      onHighlightChange(nextValue) {
        highlighted.set(nextValue)
      },
      onOpenChange(nextOpen) {
        expanded.set(nextOpen)
        opened.emit({ open: nextOpen })
      },
      root: host().root,
    }))
    if (open) menuApi()?.setOpen(true)
  })
  onDisconnected(() => {
    stopIktiaZagMenuService(menuService())
    menuService.set(null)
  })
  effect(() => {
    const api = menuApi()
    void expanded()
    void highlighted()
    if (api == null) return
    return syncIktiaMenuItems({
      api,
      disabled,
      host: host().element,
      onRequestUpdate: () => host().update(),
      onSelect(value) {
        selected.emit({ value })
      },
    })
  })
  effect(() => {
    const api = menuApi()
    void expanded()
    if (api == null || !expanded()) return
    const abort = new AbortController()
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      api.setOpen(false)
    }, { signal: abort.signal })
    return () => abort.abort()
  })

  return (
    <div
      part="root"
      data-state={expanded() ? "open" : "closed"}
      data-disabled={disabled || undefined}
    >
      <button
        {...(menuApi()?.getTriggerProps() ?? {})}
        part="trigger"
        data-state={expanded() ? "open" : "closed"}
        disabled={disabled}
      >
        <slot name="trigger">{label}</slot>
      </button>
      <div {...(menuApi()?.getPositionerProps() ?? {})} part="positioner">
        <div
          {...(menuApi()?.getContentProps() ?? {})}
          part="content"
          data-state={expanded() ? "open" : "closed"}
        >
          <slot name="item" />
        </div>
      </div>
    </div>
  )
}
