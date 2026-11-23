import { selectionArrowStep } from "./selection-key.js"
import type { SegmentedControlApi } from "@ui-sdk/core/segmented-control"
type NaosSegmentedItemElement = HTMLElement & {
  disabled?: boolean
  value?: string
}

type SyncNaosSegmentedItemsOptions = {
  api: SegmentedControlApi
  disabled: boolean
  host: HTMLElement
  onRequestUpdate(): void
  orientation: "horizontal" | "vertical"
}

type SegmentedItem = {
  disabled: boolean
  element: NaosSegmentedItemElement
  value: string
}

const segmentedSelector = "naos-segmented-item"

export function syncNaosSegmentedItems({
  api,
  disabled,
  host,
  onRequestUpdate,
  orientation,
}: SyncNaosSegmentedItemsOptions) {
  const cleanups: VoidFunction[] = []
  const items = segmentedItemsFor(host, disabled)

  for (const item of items) {
    cleanups.push(
      syncSegmentedItem({
        api,
        item,
        items,
        onRequestUpdate,
        orientation,
      }),
    )
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

function syncSegmentedItem({
  api,
  item,
  items,
  onRequestUpdate,
  orientation,
}: {
  api: SegmentedControlApi
  item: SegmentedItem
  items: SegmentedItem[]
  onRequestUpdate(): void
  orientation: "horizontal" | "vertical"
}) {
  const { disabled, element, value } = item
  const chosen = api.getValue() === value
  const tabStop =
    items.find((candidate) => !candidate.disabled && candidate.value === api.getValue()) ??
    firstEnabledItem(items)

  setStringAttribute(element, "role", "radio")
  setStringAttribute(element, "aria-checked", chosen ? "true" : "false")
  setStringAttribute(element, "aria-disabled", disabled ? "true" : null)
  setStringAttribute(element, "data-state", chosen ? "selected" : "unselected")
  setStringAttribute(element, "data-orientation", orientation)
  setStringAttribute(element, "data-disabled", disabled ? "" : null)
  element.tabIndex = tabStop?.element === element ? 0 : -1

  const selectCurrent = () => {
    if (disabled) return
    api.setValue(value)
    element.focus()
    onRequestUpdate()
  }
  const clickListener = (event: MouseEvent) => {
    if (!event.defaultPrevented) selectCurrent()
  }
  const keyListener = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.isComposing || disabled) return
    const next = nextSegmentedItemForKey({ current: item, event, items, orientation })
    if (next == null) return
    event.preventDefault()
    if (next !== item) {
      api.setValue(next.value)
      next.element.focus()
      onRequestUpdate()
      return
    }
    selectCurrent()
  }

  element.addEventListener("click", clickListener)
  element.addEventListener("keydown", keyListener)
  return () => {
    element.removeEventListener("click", clickListener)
    element.removeEventListener("keydown", keyListener)
  }
}

function segmentedItemsFor(host: HTMLElement, groupDisabled: boolean): SegmentedItem[] {
  return Array.from(host.querySelectorAll<NaosSegmentedItemElement>(segmentedSelector))
    .filter((element) => element.closest("naos-segmented-control") === host)
    .map((element) => {
      const value = element.value ?? element.getAttribute("value") ?? ""
      return {
        disabled: groupDisabled || Boolean(element.disabled) || element.hasAttribute("disabled"),
        element,
        value,
      }
    })
    .filter((item) => item.value.length > 0)
}

function firstEnabledItem(items: SegmentedItem[]) {
  return items.find((item) => !item.disabled) ?? null
}

function nextSegmentedItemForKey({
  current,
  event,
  items,
  orientation,
}: {
  current: SegmentedItem
  event: KeyboardEvent
  items: SegmentedItem[]
  orientation: "horizontal" | "vertical"
}) {
  const enabled = items.filter((item) => !item.disabled)
  if (enabled.length === 0) return null

  if (event.key === " " || event.key === "Enter") return current
  if (event.key === "Home") return enabled[0]
  if (event.key === "End") return enabled[enabled.length - 1]

  const index = enabled.findIndex((item) => item.element === current.element)
  if (index < 0) return null
  const step = selectionArrowStep(event.key, orientation, current.element)
  return step === 0 ? null : enabled[(index + step + enabled.length) % enabled.length]
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
