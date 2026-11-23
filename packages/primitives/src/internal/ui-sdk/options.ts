import {
  bindLayer,
  createListbox,
  createTypeahead,
  definePrimitive,
  isTypeaheadKey,
  position,
} from "@ui-sdk/core"
import { primitiveId } from "./id.js"
import { selectionArrowStep } from "./selection-key.js"

const optionNavigation = definePrimitive({
  name: "naos-option-navigation",
  state: () => ({ highlighted: null as string | null }),
  api: (context) => createListbox(context, { key: "highlighted", focus: "virtual" }),
  slots: () => ({}),
})

type Kind = "select" | "combobox" | "listbox"
type BindOptions = {
  kind: Kind
  freeText?: boolean
  element: HTMLElement
  root: ParentNode
  value: string[]
  onValue(values: string[]): void
  onLabel?(label: string): void
  onInput?(input: string): void
  onDraft?(input: string): void
  onCommit?(input: string): void
  onOpen?(open: boolean): void
}

export function listFormValue(values: string[], multiple: boolean, name: string) {
  if (!multiple) return values[0] || null
  if (!name || !values.length) return null
  const data = new FormData()
  for (const value of values) data.append(name, value)
  return data
}

export function bindOptions({
  element,
  root,
  kind,
  freeText = false,
  value,
  onValue,
  onLabel,
  onInput,
  onDraft,
  onCommit,
  onOpen,
}: BindOptions) {
  const part = (name: string) => root.querySelector<HTMLElement>(`[part~="${name}"]`)!
  const content = part("content")
  const trigger = kind === "listbox" ? content : part("trigger")
  const input = root.querySelector("input")
  const focusTarget = input ?? trigger
  const list = kind === "listbox" ? content : part("list")
  const navigation = optionNavigation({ id: primitiveId(kind) })
  const search = createTypeahead()
  const listeners = new AbortController()
  const signal = listeners.signal
  const disabled = () => groupDisabled || disabledFromHost()
  let selected = value
  let open = false
  let choosing = false
  let stopLayer: VoidFunction | undefined
  let stopPosition: VoidFunction | undefined
  let items: HTMLElement[] = []
  let currentLabel = ""
  let initialRefresh = true
  let groupDisabled = disabledFromHost()
  function disabledFromHost() {
    return element.matches(":disabled,[disabled]")
  }
  const bindings = new Map<
    HTMLElement,
    {
      option: { key: string; props: { value: string; label: string; disabled: boolean } }
      release: VoidFunction
    }
  >()
  const key = (item: HTMLElement) => item.getAttribute("value") ?? ""
  const label = (item: HTMLElement) =>
    item.getAttribute("label") || item.textContent?.trim() || key(item)
  const selectedLabel = () => {
    const item = items.find((item) => key(item) === selected[0])
    return item ? label(item) : ""
  }
  const available = () => items.filter((item) => !item.hasAttribute("disabled"))
  const itemFrom = (event: Event) => items.find((item) => event.composedPath().includes(item))
  const render = () => {
    let active: HTMLElement | undefined
    for (const item of items) {
      const checked = selected.includes(key(item))
      const blocked = disabled() || item.hasAttribute("disabled")
      const highlighted = !blocked && navigation.get().highlighted === key(item)
      if (highlighted) active = item
      item.setAttribute("aria-selected", String(checked))
      item.setAttribute("data-state", checked ? "checked" : "unchecked")
      item.toggleAttribute("data-highlighted", highlighted)
      item.toggleAttribute("data-disabled", blocked)
      if (blocked) item.setAttribute("aria-disabled", "true")
      else item.removeAttribute("aria-disabled")
    }
    // The option is authored in light DOM. An ID reference from the shadow root
    // cannot reach it, so prefer the explicit cross-root ARIA reference.
    if (Reflect.has(focusTarget, "ariaActiveDescendantElement")) {
      focusTarget.ariaActiveDescendantElement = active ?? null
    } else if (active) {
      focusTarget.setAttribute("aria-activedescendant", active.id)
    } else {
      focusTarget.removeAttribute("aria-activedescendant")
    }
  }
  const refresh = () => {
    const itemTag = `naos-${kind}-item`
    items = Array.from(element.querySelectorAll<HTMLElement>(`${itemTag}[value]`)).filter(
      (item) => item.closest(`naos-${kind}`) === element && key(item) !== "",
    )
    for (const [item, binding] of bindings) {
      if (items.includes(item) && binding.option.key === key(item)) continue
      binding.release()
      bindings.delete(item)
    }
    for (const item of items) {
      // A slotted wrapper can hold options authored as descendants.
      let slotted = item
      while (slotted.parentElement && slotted.parentElement !== element)
        slotted = slotted.parentElement
      if (!slotted.slot) slotted.slot = "item"
      item.setAttribute("role", "option")
      item.setAttribute("data-value", key(item))
      const props = {
        value: key(item),
        label: label(item),
        disabled: item.hasAttribute("disabled"),
      }
      const existing = bindings.get(item)
      if (existing) {
        existing.option.props = props
      } else {
        const option = { key: key(item), props }
        if (!item.id) item.id = navigation.api.attrs(navigation.get(), option).id
        bindings.set(item, { option, release: navigation.api.bind(item, option) })
      }
    }
    const highlighted = navigation.get().highlighted
    if (highlighted !== null && !available().some((item) => key(item) === highlighted)) {
      navigation.api.highlight(null)
    }
    render()
    const nextLabel = selectedLabel()
    if (input && !freeText && (!open || input.value === currentLabel)) input.value = nextLabel
    if (
      input &&
      freeText &&
      (initialRefresh || (!open && selected.length > 0 && input.value === currentLabel))
    )
      input.value = nextLabel || selected[0] || ""
    initialRefresh = false
    currentLabel = nextLabel
    onLabel?.(nextLabel)
  }
  list.id = navigation.id + "-list"
  focusTarget.setAttribute("aria-controls", list.id)
  const labelNode = part("label")
  labelNode.id = navigation.id + "-label"
  focusTarget.setAttribute("aria-labelledby", labelNode.id)
  list.setAttribute("aria-labelledby", labelNode.id)
  if (input) {
    labelNode.setAttribute("for", input.id || (input.id = navigation.id + "-input"))
    trigger.tabIndex = -1
    trigger.setAttribute("aria-controls", list.id)
    trigger.setAttribute("aria-haspopup", "listbox")
    trigger.setAttribute("aria-expanded", "false")
  }

  function writeInput(next: string) {
    if (!input || input.value === next) return
    input.value = next
    onInput?.(next)
  }

  function setOpen(next: boolean, restore = false) {
    if (kind === "listbox" || next === open || (disabled() && next)) return
    open = next
    content.hidden = !next
    focusTarget.setAttribute("aria-expanded", String(next))
    trigger.setAttribute("aria-expanded", String(next))
    stopLayer?.()
    stopPosition?.()
    stopLayer = undefined
    stopPosition = undefined
    if (next) {
      navigation.api.highlight(
        available()
          .find((item) => selected.includes(key(item)))
          ?.getAttribute("value") ?? null,
      )
      stopLayer = bindLayer(content, {
        contains: (target) =>
          target === element || element.contains(target) || part("control").contains(target),
        onDismiss: (reason) => setOpen(false, reason === "escape-key"),
      })
      stopPosition = position(part("control"), part("positioner"), {
        side: "bottom",
        align: "start",
      })
    } else {
      navigation.api.highlight(null)
      search.reset()
      if (freeText && input) {
        if (!choosing) onCommit?.(input.value)
      } else writeInput(selectedLabel())
      if (restore) focusTarget.focus()
    }
    onOpen?.(next)
  }
  function choose(item: HTMLElement) {
    if (disabled() || item.hasAttribute("disabled")) return
    const next = key(item)
    choosing = true
    if (kind === "select") setOpen(false, true)
    if (kind === "listbox" && element.hasAttribute("multiple")) {
      selected = selected.includes(next) ? selected.filter((v) => v !== next) : [...selected, next]
      onValue(selected)
    } else if (selected[0] !== next) {
      selected = [next]
      onValue(selected)
    }
    writeInput(label(item))
    onLabel?.(selectedLabel())
    if (kind === "listbox") navigation.api.highlight(next)
    setOpen(false, true)
    choosing = false
    render()
  }
  function keydown(event: KeyboardEvent) {
    if (disabled() || event.isComposing || event.defaultPrevented) return
    if (kind !== "listbox" && event.key === "Tab") {
      setOpen(false)
      return
    }
    const active = items.find((item) => key(item) === navigation.get().highlighted)
    if (event.key === "Enter" || (!input && event.key === " " && !search.active())) {
      if (freeText && input && !active) {
        if (open) {
          event.preventDefault()
          setOpen(false)
        }
        return
      }
      event.preventDefault()
      if (!open && kind !== "listbox") setOpen(true)
      else if (active) choose(active)
      return
    }
    if (event.key === "Home" || event.key === "End") {
      if (input && !open) return
      event.preventDefault()
      setOpen(true)
      navigation.api.move(event.key === "Home" ? "first" : "last", event)
    } else if (!input && isTypeaheadKey(event)) {
      const enabled = available()
      const idx = search(
        event.key,
        enabled.map(label),
        enabled.findIndex((item) => item === active),
      )
      if (idx < 0) return
      event.preventDefault()
      if (kind === "select" && !open) choose(enabled[idx]!)
      else navigation.api.highlight(key(enabled[idx]!), { event })
    } else if (kind === "listbox") {
      const orientation =
        element.getAttribute("orientation") === "horizontal" ? "horizontal" : "vertical"
      const step = selectionArrowStep(event.key, orientation, focusTarget)
      if (step) {
        event.preventDefault()
        navigation.api.move(step, event)
      } else if (event.key === "PageUp" || event.key === "PageDown") {
        navigation.api.keydown(event)
      }
    } else if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault()
      setOpen(true)
      if (!event.altKey && navigation.get().highlighted === null) {
        navigation.api.move(event.key === "ArrowDown" ? "first" : "last", event)
      }
    } else if (["ArrowDown", "ArrowUp", "PageUp", "PageDown"].includes(event.key)) {
      setOpen(true)
      navigation.api.keydown(event)
    }
  }
  focusTarget.addEventListener("keydown", keydown, { signal })
  element.addEventListener(
    "click",
    (event) => {
      const item = itemFrom(event)
      if (item && !event.defaultPrevented && (kind === "listbox" || open)) choose(item)
    },
    { signal },
  )
  element.addEventListener(
    "pointermove",
    (event) => {
      const item = itemFrom(event)
      if (item && (kind === "listbox" || open) && !disabled() && !item.hasAttribute("disabled"))
        navigation.api.highlight(key(item), { event })
    },
    { signal },
  )
  if (kind !== "listbox") {
    trigger.addEventListener(
      "click",
      () => {
        setOpen(!open)
        if (input) input.focus()
      },
      { signal },
    )
    focusTarget.setAttribute("aria-expanded", "false")
    content.hidden = true
  }
  if (input) {
    input.addEventListener("click", () => setOpen(true), { signal })
    input.addEventListener(
      "input",
      () => {
        if (disabled()) return
        onInput?.(input.value)
        if (freeText) {
          selected = []
          onDraft?.(input.value)
          render()
        }
        setOpen(true)
        const match = available().find((item) =>
          label(item).toLocaleLowerCase().startsWith(input.value.toLocaleLowerCase()),
        )
        navigation.api.highlight(match ? key(match) : null)
      },
      { signal },
    )
  }
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
  return {
    reset(values: string[]) {
      const changed =
        values.length !== selected.length ||
        values.some((value, index) => selected[index] !== value)
      selected = values
      if (changed) onValue(values)
      writeInput(selectedLabel() || (freeText ? selected[0] || "" : ""))
      choosing = true
      setOpen(false)
      choosing = false
      navigation.api.highlight(null)
      refresh()
    },
    syncDisabled(blocked: boolean) {
      groupDisabled = blocked
      if (blocked) setOpen(false)
      render()
    },
    destroy() {
      listeners.abort()
      observer.disconnect()
      stopLayer?.()
      stopPosition?.()
      unsubscribe()
      for (const binding of bindings.values()) binding.release()
      navigation.destroy()
      search.reset()
    },
  }
}
