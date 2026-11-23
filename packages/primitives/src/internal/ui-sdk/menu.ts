import {
  bindLayer,
  createListbox,
  createTypeahead,
  definePrimitive,
  isTypeaheadKey,
  position,
} from "@ui-sdk/core"
import { primitiveId } from "./id.js"

const menuNavigation = definePrimitive({
  name: "naos-menu-navigation",
  state: () => ({ highlighted: null as string | null }),
  api: (context) => createListbox(context, { key: "highlighted", focus: "virtual" }),
  slots: () => ({}),
})

type Options = {
  element: HTMLElement
  root: ParentNode
  context: boolean
  initialOpen: boolean
  onOpen(open: boolean): void
  onSelect(value: string): void
}

export function bindMenu({ element, root, context, initialOpen, onOpen, onSelect }: Options) {
  const trigger = root.querySelector<HTMLElement>("[part~='trigger']")!
  const content = root.querySelector<HTMLElement>("[part~='content']")!
  const positioner = root.querySelector<HTMLElement>("[part~='positioner']")!
  const navigation = menuNavigation({ id: primitiveId("menu") })
  const search = createTypeahead()
  const abort = new AbortController()
  const signal = abort.signal
  let items: HTMLElement[] = []
  let releases: VoidFunction[] = []
  let open = false
  let stopLayer: VoidFunction | undefined
  let stopPosition: VoidFunction | undefined
  let focusTimer: ReturnType<typeof setTimeout> | undefined
  const disabled = () => element.hasAttribute("disabled")
  const key = (item: HTMLElement) => item.getAttribute("value") ?? ""
  const label = (item: HTMLElement) =>
    item.getAttribute("label") || item.textContent?.trim() || key(item)
  const enabled = () => items.filter((item) => !item.hasAttribute("disabled"))
  const render = () => {
    const highlighted = navigation.get().highlighted
    const active = items.find((item) => key(item) === highlighted)
    if (active) content.setAttribute("aria-activedescendant", active.id)
    else content.removeAttribute("aria-activedescendant")
    if ("ariaActiveDescendantElement" in content)
      content.ariaActiveDescendantElement = active ?? null
    for (const item of items) {
      const blocked = disabled() || item.hasAttribute("disabled")
      item.toggleAttribute("data-disabled", blocked)
      if (blocked) item.setAttribute("aria-disabled", "true")
      else item.removeAttribute("aria-disabled")
      item.toggleAttribute("data-highlighted", highlighted === key(item))
      item.setAttribute("data-state", highlighted === key(item) ? "highlighted" : "idle")
    }
  }
  const refresh = () => {
    releases.forEach((release) => release())
    items = Array.from(element.querySelectorAll<HTMLElement>(":scope > naos-menu-item[value]"))
    releases = items.map((item) => {
      item.slot = "item"
      item.setAttribute("role", "menuitem")
      item.tabIndex = -1
      const option = {
        key: key(item),
        props: { value: key(item), label: label(item), disabled: item.hasAttribute("disabled") },
      }
      if (!item.id) item.id = navigation.api.attrs(navigation.get(), option).id
      return navigation.api.bind(item, option)
    })
    content.setAttribute(
      "aria-label",
      element.getAttribute("label") || (context ? "Context menu" : "Actions"),
    )
    render()
  }
  function setOpen(
    next: boolean,
    restore = false,
    notify = true,
    point?: { x: number; y: number },
  ) {
    if (next === open || (next && disabled())) return
    open = next
    content.hidden = !next
    trigger.setAttribute("aria-expanded", String(next))
    stopLayer?.()
    stopPosition?.()
    stopLayer = undefined
    stopPosition = undefined
    if (next) {
      stopLayer = bindLayer(content, {
        contains: (target) =>
          target === element || element.contains(target) || trigger.contains(target),
        onDismiss: () => setOpen(false, true),
      })
      stopPosition = position(point ?? trigger, positioner, { side: "bottom", align: "start" })
    } else {
      navigation.api.highlight(null)
      if (restore) {
        trigger.focus()
        clearTimeout(focusTimer)
        focusTimer = setTimeout(() => {
          if (trigger.isConnected && !open) trigger.focus()
        }, 0)
      }
    }
    if (notify) onOpen(next)
  }
  function choose(item: HTMLElement) {
    if (disabled() || item.hasAttribute("disabled")) return
    const value = key(item)
    setOpen(false, true)
    onSelect(value)
  }
  function keydown(event: KeyboardEvent) {
    if (disabled() || event.defaultPrevented || event.isComposing) return
    const active = items.find((item) => key(item) === navigation.get().highlighted)
    if (context && (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10"))) {
      event.preventDefault()
      setOpen(true)
      content.focus()
      return
    }
    if (event.key === "Escape" && open) {
      event.preventDefault()
      setOpen(false, true)
      return
    }
    if (event.key === "Tab" && open) {
      setOpen(false)
      return
    }
    if (event.key === "Enter" || (event.key === " " && !search.active())) {
      event.preventDefault()
      if (!open) {
        setOpen(true)
        content.focus()
        navigation.api.move("first", event)
      } else if (active) choose(active)
      return
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault()
      setOpen(true)
      content.focus()
      navigation.api.move(event.key === "Home" ? "first" : "last", event)
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      setOpen(true)
      content.focus()
      navigation.api.move(event.key === "ArrowDown" ? 1 : -1, event)
    } else if (isTypeaheadKey(event) && open) {
      const candidates = enabled()
      const index = search(
        event.key,
        candidates.map(label),
        candidates.findIndex((item) => item === active),
      )
      if (index >= 0) {
        event.preventDefault()
        navigation.api.highlight(key(candidates[index]!), { event })
      }
    }
  }
  if (context) {
    trigger.setAttribute("data-scope", "menu")
    trigger.setAttribute("data-part", "context-trigger")
  }
  trigger.setAttribute("aria-haspopup", "menu")
  trigger.setAttribute("aria-expanded", "false")
  content.id = navigation.id + "-content"
  trigger.setAttribute("aria-controls", content.id)
  content.setAttribute("role", "menu")
  content.tabIndex = -1
  content.hidden = true
  trigger.addEventListener("keydown", keydown, { signal })
  content.addEventListener("keydown", keydown, { signal })
  if (context) {
    trigger.addEventListener(
      "contextmenu",
      (event) => {
        if (!disabled()) {
          event.preventDefault()
          setOpen(
            true,
            false,
            true,
            event.detail === 0 ? undefined : { x: event.clientX, y: event.clientY },
          )
          content.focus()
        }
      },
      { signal },
    )
  } else
    trigger.addEventListener(
      "click",
      () => {
        setOpen(!open)
        if (open) content.focus()
      },
      { signal },
    )
  element.addEventListener(
    "click",
    (event) => {
      const item = items.find((candidate) => event.composedPath().includes(candidate))
      if (item) choose(item)
    },
    { signal },
  )
  element.addEventListener(
    "pointermove",
    (event) => {
      const item = items.find((candidate) => event.composedPath().includes(candidate))
      if (item && !disabled() && !item.hasAttribute("disabled"))
        navigation.api.highlight(key(item), { event })
    },
    { signal },
  )
  const unsubscribe = navigation.subscribe(render)
  refresh()
  const observer = new MutationObserver(refresh)
  observer.observe(element, {
    attributes: true,
    attributeFilter: ["value", "disabled", "label"],
    childList: true,
    characterData: true,
    subtree: true,
  })
  if (initialOpen) setOpen(true, false, false)
  return {
    syncDisabled(blocked: boolean) {
      if (blocked) setOpen(false)
      render()
    },
    destroy() {
      clearTimeout(focusTimer)
      abort.abort()
      observer.disconnect()
      stopLayer?.()
      stopPosition?.()
      releases.forEach((release) => release())
      unsubscribe()
      search.reset()
      navigation.destroy()
    },
  }
}
