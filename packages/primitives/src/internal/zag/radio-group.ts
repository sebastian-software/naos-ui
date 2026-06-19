import {
  connect,
  machine as radioGroupMachine,
  type Api as ZagRadioGroupApi,
} from "@zag-js/radio-group"

import { normalizeZagProps } from "./props.js"
import { createZagScope } from "./scope.js"
import { createZagService } from "./service.js"

export type IktiaZagRadioGroupService = ReturnType<typeof createZagService>

type IktiaZagRadioGroupServiceOptions = {
  disabled: boolean
  host: HTMLElement
  id: string
  name: string
  onValueChange(value: string): void
  orientation: "horizontal" | "vertical"
  root: ParentNode
  value: string
}

type IktiaRadioItemElement = HTMLElement & {
  disabled?: boolean
  value?: string
}

type SyncIktiaRadioGroupItemsOptions = {
  api: ZagRadioGroupApi
  disabled: boolean
  host: HTMLElement
  onRequestUpdate(): void
  orientation: "horizontal" | "vertical"
}

type RadioItem = {
  disabled: boolean
  element: IktiaRadioItemElement
  value: string
}

const radioSelector = "iktia-radio"

export function createIktiaZagRadioGroupService({
  disabled,
  host,
  id,
  name,
  onValueChange,
  orientation,
  root,
  value,
}: IktiaZagRadioGroupServiceOptions): IktiaZagRadioGroupService {
  return createZagService({
    machine: radioGroupMachine as never,
    props: {
      defaultValue: value || null,
      disabled,
      id,
      name,
      onValueChange(details: { value: string | null }) {
        onValueChange(details.value ?? "")
      },
      orientation,
    },
    scope: createZagScope({
      host,
      id,
      root: root as Document | ShadowRoot,
    }),
  })
}

export function getIktiaZagRadioGroupApi(
  service: IktiaZagRadioGroupService | null
): ZagRadioGroupApi | null {
  if (service == null) return null
  return connect(service as never, normalizeZagProps as never)
}

export function stopIktiaZagRadioGroupService(
  service: IktiaZagRadioGroupService | null
) {
  service?.stop()
}

export function syncIktiaRadioGroupItems({
  api,
  disabled,
  host,
  onRequestUpdate,
  orientation,
}: SyncIktiaRadioGroupItemsOptions) {
  const cleanups: VoidFunction[] = []
  const items = radioItemsFor(host, disabled)

  for (const item of items) {
    cleanups.push(syncRadioItem({ api, item, items, onRequestUpdate, orientation }))
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

function syncRadioItem({
  api,
  item,
  items,
  onRequestUpdate,
  orientation,
}: {
  api: ZagRadioGroupApi
  item: RadioItem
  items: RadioItem[]
  onRequestUpdate(): void
  orientation: "horizontal" | "vertical"
}) {
  const { disabled, element, value } = item
  const state = api.getItemState({ disabled, value })
  const isTabStop =
    !disabled &&
    (state.checked ||
      (api.value == null && firstEnabledItem(items)?.element === element))

  setStringAttribute(element, "role", "radio")
  setStringAttribute(element, "aria-checked", state.checked ? "true" : "false")
  setStringAttribute(element, "aria-disabled", disabled ? "true" : null)
  setStringAttribute(element, "data-state", state.checked ? "checked" : "unchecked")
  setStringAttribute(element, "data-orientation", orientation)
  setStringAttribute(element, "data-disabled", disabled ? "" : null)
  element.tabIndex = isTabStop ? 0 : -1

  const selectCurrent = () => {
    if (disabled) return
    api.setValue(value)
    element.focus()
    onRequestUpdate()
  }
  const clickListener = () => selectCurrent()
  const keyListener = (event: KeyboardEvent) => {
    const next = nextRadioItemForKey({ current: item, event, items, orientation })
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

function radioItemsFor(host: HTMLElement, groupDisabled: boolean): RadioItem[] {
  return Array.from(host.querySelectorAll<IktiaRadioItemElement>(radioSelector))
    .map((element) => {
      const value = element.value ?? element.getAttribute("value") ?? ""
      return {
        disabled:
          groupDisabled ||
          Boolean(element.disabled) ||
          element.hasAttribute("disabled"),
        element,
        value,
      }
    })
    .filter((item) => item.value.length > 0)
}

function firstEnabledItem(items: RadioItem[]) {
  return items.find((item) => !item.disabled) ?? null
}

function nextRadioItemForKey({
  current,
  event,
  items,
  orientation,
}: {
  current: RadioItem
  event: KeyboardEvent
  items: RadioItem[]
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

function setStringAttribute(
  element: HTMLElement,
  name: string,
  value: string | null
) {
  if (value == null) {
    if (!element.hasAttribute(name)) return
    element.removeAttribute(name)
    return
  }
  if (element.getAttribute(name) === value) return
  element.setAttribute(name, value)
}
