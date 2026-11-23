import { selectionArrowStep } from "./selection-key.js"
import type { ToggleGroupApi } from "@ui-sdk/core/toggle"
type NaosToggleItemElement = HTMLElement & {
  disabled?: boolean
  value?: string
}

type SyncNaosToggleGroupItemsOptions = {
  api: ToggleGroupApi
  disabled: boolean
  host: HTMLElement
  multiple: boolean
  onRequestUpdate(): void
  orientation: "horizontal" | "vertical"
}

type ToggleItem = {
  disabled: boolean
  element: NaosToggleItemElement
  value: string
}

const toggleSelector = "naos-toggle-item"

export function parseNaosToggleGroupValue(value: string): string[] {
  return value.split(/\s+/).filter(Boolean)
}

export function serializeNaosToggleGroupValue(value: string[]): string {
  return value.join(" ")
}

export function toggleGroupFormValue({
  multiple,
  name,
  value,
}: {
  multiple: boolean
  name: string
  value: string[]
}): FormDataEntryValue | FormData | null {
  if (value.length === 0) return null
  if (!multiple) return value[0] ?? null
  if (!name) return null
  const data = new FormData()
  for (const item of value) data.append(name, item)
  return data
}

export function syncNaosToggleGroupItems({
  api,
  disabled,
  host,
  multiple,
  onRequestUpdate,
  orientation,
}: SyncNaosToggleGroupItemsOptions) {
  const cleanups: VoidFunction[] = []
  const items = toggleItemsFor(host, disabled)

  for (const item of items) {
    cleanups.push(
      syncToggleItem({
        api,
        item,
        items,
        multiple,
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

function syncToggleItem({
  api,
  item,
  items,
  multiple,
  onRequestUpdate,
  orientation,
}: {
  api: ToggleGroupApi
  item: ToggleItem
  items: ToggleItem[]
  multiple: boolean
  onRequestUpdate(): void
  orientation: "horizontal" | "vertical"
}) {
  const { disabled, element, value } = item
  const chosen = api.getValue().includes(value)
  const tabStop =
    items.find((candidate) => !candidate.disabled && candidate.element.matches(":focus")) ??
    items.find((candidate) => !candidate.disabled && api.isPressed(candidate.value)) ??
    firstEnabledItem(items)

  setStringAttribute(element, "role", multiple ? "button" : "radio")
  setStringAttribute(element, "aria-pressed", multiple ? String(chosen) : null)
  setStringAttribute(element, "aria-checked", multiple ? null : String(chosen))
  setStringAttribute(element, "aria-disabled", disabled ? "true" : null)
  setStringAttribute(element, "data-state", chosen ? "on" : "off")
  setStringAttribute(element, "data-orientation", orientation)
  setStringAttribute(element, "data-disabled", disabled ? "" : null)
  element.tabIndex = tabStop?.element === element ? 0 : -1

  const selectCurrent = () => {
    if (disabled) return
    api.toggle(value)
    element.focus()
    onRequestUpdate()
  }
  const clickListener = (event: MouseEvent) => {
    if (!event.defaultPrevented) selectCurrent()
  }
  const keyListener = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.isComposing || disabled) return
    const next = nextToggleItemForKey({ current: item, event, items, orientation })
    if (next == null) return
    event.preventDefault()
    if (next !== item) {
      next.element.focus()
      for (const candidate of items) candidate.element.tabIndex = candidate === next ? 0 : -1
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

function toggleItemsFor(host: HTMLElement, groupDisabled: boolean): ToggleItem[] {
  return Array.from(host.querySelectorAll<NaosToggleItemElement>(toggleSelector))
    .filter((element) => element.closest("naos-toggle-group") === host)
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

function firstEnabledItem(items: ToggleItem[]) {
  return items.find((item) => !item.disabled) ?? null
}

function nextToggleItemForKey({
  current,
  event,
  items,
  orientation,
}: {
  current: ToggleItem
  event: KeyboardEvent
  items: ToggleItem[]
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
