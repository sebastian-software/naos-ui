import { tabs } from "@ui-sdk/core/tabs"

export type NaosTabsController = ReturnType<typeof tabs>

export function createNaosTabsController(options: Parameters<typeof tabs>[0]) {
  return tabs(options)
}

type NaosTabElement = HTMLElement & {
  disabled?: boolean
  value?: string
}

type NaosTabPanelElement = HTMLElement & {
  value?: string
}

type SyncNaosTabsItemsOptions = {
  api: NaosTabsController["api"]
  host: HTMLElement
  onRequestUpdate(): void
  orientation: "horizontal" | "vertical"
}

type TabItem = {
  disabled: boolean
  element: NaosTabElement
  value: string
}

const tabSelector = "naos-tab"
const panelSelector = "naos-tab-panel"

export function syncNaosTabsItems({
  api,
  host,
  onRequestUpdate,
  orientation,
}: SyncNaosTabsItemsOptions) {
  const cleanups: VoidFunction[] = []
  const items = tabItemsFor(host)
  const panels = tabPanelsFor(host)

  for (const item of items) {
    cleanups.push(syncTabItem({ api, item, items, onRequestUpdate, orientation }))
  }
  for (const panel of panels) {
    if (panel.closest("naos-tabs") === host) syncTabPanel({ api, panel })
  }

  const observer = new MutationObserver(() => onRequestUpdate())
  observer.observe(host, {
    attributeFilter: ["disabled", "value"],
    attributes: true,
    childList: true,
    subtree: true,
  })
  cleanups.push(() => observer.disconnect())

  return () => {
    for (const cleanup of cleanups.splice(0)) cleanup()
  }
}

function syncTabItem({
  api,
  item,
  items,
  onRequestUpdate,
  orientation,
}: {
  api: NaosTabsController["api"]
  item: TabItem
  items: TabItem[]
  onRequestUpdate(): void
  orientation: "horizontal" | "vertical"
}) {
  const { disabled, element, value } = item
  const isSelected = api.getValue() === value
  const isTabStop =
    !disabled && (isSelected || (!api.getValue() && firstEnabledItem(items)?.element === element))

  setStringAttribute(element, "slot", "tab")
  setStringAttribute(element, "role", "tab")
  setStringAttribute(element, "aria-selected", isSelected ? "true" : "false")
  setStringAttribute(element, "aria-disabled", disabled ? "true" : null)
  setStringAttribute(element, "data-state", isSelected ? "selected" : "unselected")
  setStringAttribute(element, "data-orientation", orientation)
  setStringAttribute(element, "data-disabled", disabled ? "" : null)
  element.tabIndex = isTabStop ? 0 : -1

  const selectCurrent = (event: Event) => {
    if (disabled || event.defaultPrevented) return
    api.setValue(value, { reason: "item-press", event })
    element.focus()
    onRequestUpdate()
  }
  const clickListener = (event: MouseEvent) => selectCurrent(event)
  const keyListener = (event: KeyboardEvent) => {
    const next = nextTabItemForKey({ current: item, event, items, orientation })
    if (next == null || event.defaultPrevented) return
    if (next !== item) {
      api.setValue(next.value, { reason: "list-navigation", event })
      next.element.focus()
      onRequestUpdate()
    } else {
      selectCurrent(event)
    }
    event.preventDefault()
  }

  element.addEventListener("click", clickListener)
  element.addEventListener("keydown", keyListener)
  return () => {
    element.removeEventListener("click", clickListener)
    element.removeEventListener("keydown", keyListener)
  }
}

function syncTabPanel({
  api,
  panel,
}: {
  api: NaosTabsController["api"]
  panel: NaosTabPanelElement
}) {
  const value = panel.value ?? panel.getAttribute("value") ?? ""
  if (!value) return
  const isSelected = api.getValue() === value

  setStringAttribute(panel, "slot", "panel")
  setStringAttribute(panel, "role", "tabpanel")
  setStringAttribute(panel, "data-state", isSelected ? "selected" : "unselected")
  setStringAttribute(panel, "data-value", value)
  setStringAttribute(panel, "hidden", isSelected ? null : "")
}

function tabItemsFor(host: HTMLElement): TabItem[] {
  return Array.from(host.querySelectorAll<NaosTabElement>(tabSelector))
    .filter((element) => element.closest("naos-tabs") === host)
    .map((element) => {
      const value = element.value ?? element.getAttribute("value") ?? ""
      return {
        disabled: Boolean(element.disabled) || element.hasAttribute("disabled"),
        element,
        value,
      }
    })
    .filter((item) => item.value.length > 0)
}

function tabPanelsFor(host: HTMLElement): NaosTabPanelElement[] {
  return Array.from(host.querySelectorAll<NaosTabPanelElement>(panelSelector))
}

function firstEnabledItem(items: TabItem[]) {
  return items.find((item) => !item.disabled) ?? null
}

function nextTabItemForKey({
  current,
  event,
  items,
  orientation,
}: {
  current: TabItem
  event: KeyboardEvent
  items: TabItem[]
  orientation: "horizontal" | "vertical"
}) {
  const enabled = items.filter((item) => !item.disabled)
  if (enabled.length === 0) return null

  if (event.key === " " || event.key === "Enter") return current
  if (event.key === "Home") return enabled[0]
  if (event.key === "End") return enabled[enabled.length - 1]

  const index = enabled.findIndex((item) => item.element === current.element)
  if (index < 0) return null
  if (orientation === "horizontal" && event.key === "ArrowRight") {
    return enabled[(index + 1) % enabled.length]
  }
  if (orientation === "horizontal" && event.key === "ArrowLeft") {
    return enabled[(index - 1 + enabled.length) % enabled.length]
  }
  if (orientation === "vertical" && event.key === "ArrowDown") {
    return enabled[(index + 1) % enabled.length]
  }
  if (orientation === "vertical" && event.key === "ArrowUp") {
    return enabled[(index - 1 + enabled.length) % enabled.length]
  }
  return null
}

function setStringAttribute(element: HTMLElement, name: string, value: string | null) {
  if (value == null) {
    if (!element.hasAttribute(name)) return
    element.removeAttribute(name)
    return
  }
  if (element.getAttribute(name) === value) return
  element.setAttribute(name, value)
}

export function firstCustomTabValue(host: HTMLElement) {
  return tabItemsFor(host)[0]?.value ?? ""
}

export function hasCustomTabs(host: HTMLElement) {
  return Array.from(host.querySelectorAll("naos-tab")).some(
    (element) => element.closest("naos-tabs") === host,
  )
}

export function getLegacyTabProps({
  api,
  orientation,
  selected,
  value,
}: {
  api: NaosTabsController["api"] | undefined
  orientation: "horizontal" | "vertical"
  selected: string
  value: string
}) {
  const active = selected === value
  return {
    id: `tabs:naos-tabs:trigger-${value}`,
    type: "button",
    role: "tab",
    "aria-controls": `tabs:naos-tabs:content-${value}`,
    "aria-selected": String(active),
    "data-scope": "tabs",
    "data-part": "trigger",
    "data-selected": active ? "" : undefined,
    "data-orientation": orientation,
    "data-value": value,
    tabindex: active ? 0 : -1,
    onClick(event: Event) {
      if (!event.defaultPrevented) api?.setValue(value, { reason: "item-press", event })
    },
    onKeyDown(event: Event) {
      if (!(event instanceof KeyboardEvent)) return
      const current = event.currentTarget
      if (event.defaultPrevented || !(current instanceof HTMLElement)) return
      const triggers = Array.from(
        current.parentElement?.querySelectorAll<HTMLElement>('[role="tab"]') ?? [],
      )
      const index = triggers.indexOf(current)
      if (index < 0) return
      const isVertical = orientation === "vertical"
      const rtl = !isVertical && getComputedStyle(current).direction === "rtl"
      const forward = isVertical ? "ArrowDown" : rtl ? "ArrowLeft" : "ArrowRight"
      const backward = isVertical ? "ArrowUp" : rtl ? "ArrowRight" : "ArrowLeft"
      let next: HTMLElement | undefined
      if (event.key === "Home") next = triggers[0]
      if (event.key === "End") next = triggers.at(-1)
      if (event.key === forward) next = triggers[(index + 1) % triggers.length]
      if (event.key === backward) next = triggers[(index - 1 + triggers.length) % triggers.length]
      const nextValue = next?.dataset.value
      if (!nextValue) return
      api?.setValue(nextValue, { reason: "list-navigation", event })
      event.preventDefault()
      next?.focus()
    },
  }
}
