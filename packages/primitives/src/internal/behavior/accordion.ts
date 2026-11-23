import { accordion } from "@ui-sdk/core/accordion"

export type NaosAccordionController = ReturnType<typeof accordion>

export function createNaosAccordionController(options: Parameters<typeof accordion>[0]) {
  return accordion(options)
}

export function parseNaosAccordionValue(value: string): string[] {
  return value.split(/\s+/).filter(Boolean)
}

type AccordionItem = {
  element: HTMLElement
  trigger: HTMLButtonElement
  content: HTMLElement
  indicator: HTMLElement
  value: string
  disabled: boolean
}

export function syncNaosAccordionItems({
  api,
  disabled,
  host,
  onRequestUpdate,
}: {
  api: NaosAccordionController["api"]
  disabled: boolean
  host: HTMLElement
  onRequestUpdate(): void
}) {
  const listeners = new AbortController()
  const items: AccordionItem[] = []
  const elements = host.querySelectorAll<HTMLElement & { value?: string; disabled?: boolean }>(
    "naos-accordion-item",
  )
  let waitingForUpgrade = false
  for (const element of elements) {
    if (element.closest("naos-accordion") !== host) continue
    const value = element.value ?? element.getAttribute("value")
    if (!value) continue
    const trigger = element.shadowRoot?.querySelector<HTMLButtonElement>('[part~="trigger"]')
    const content = element.shadowRoot?.querySelector<HTMLElement>('[part~="content"]')
    const indicator = element.shadowRoot?.querySelector<HTMLElement>('[part~="indicator"]')
    if (!trigger || !content || !indicator) {
      waitingForUpgrade = true
      continue
    }
    items.push({
      element,
      trigger,
      content,
      indicator,
      value,
      disabled: disabled || Boolean(element.disabled) || element.hasAttribute("disabled"),
    })
  }

  function reflectFocus(item: AccordionItem, focused: boolean) {
    item.element.toggleAttribute("data-focus", focused)
    item.trigger.toggleAttribute("data-focus", focused)
  }

  const enabled = items.filter((item) => !item.disabled)
  for (const item of items) {
    const { element, trigger, content, indicator, value, disabled } = item
    const expanded = api.isOpen(value)
    const state = expanded ? "open" : "closed"
    const prefix = "accordion:naos-accordion"
    element.id = `${prefix}:item:${value}`
    trigger.id = `${prefix}:trigger:${value}`
    content.id = `${prefix}:content:${value}`
    trigger.setAttribute("aria-controls", content.id)
    trigger.setAttribute("aria-expanded", String(expanded))
    content.setAttribute("aria-labelledby", trigger.id)
    content.setAttribute("role", "region")
    trigger.disabled = disabled
    content.hidden = !expanded
    indicator.textContent = expanded ? "-" : "+"
    if (disabled) element.setAttribute("aria-disabled", "true")
    else element.removeAttribute("aria-disabled")
    for (const [part, target] of [
      ["item", element],
      ["item-trigger", trigger],
      ["item-content", content],
      ["item-indicator", indicator],
    ] as const) {
      target.dataset.scope = "accordion"
      target.dataset.part = part
      target.dataset.state = state
      target.toggleAttribute("data-disabled", disabled)
    }
    reflectFocus(item, trigger.matches(":focus"))

    const options = { signal: listeners.signal }
    trigger.addEventListener(
      "click",
      (event) => {
        if (!disabled && !event.defaultPrevented)
          api.toggle(value, { reason: "trigger-press", event })
      },
      options,
    )
    trigger.addEventListener("focus", () => reflectFocus(item, true), options)
    trigger.addEventListener("blur", () => reflectFocus(item, false), options)
    trigger.addEventListener(
      "keydown",
      (event) => {
        const index = enabled.indexOf(item)
        if (index < 0 || event.defaultPrevented) return
        const step = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1
        let next: AccordionItem | undefined
        switch (event.key) {
          case "Home":
            next = enabled[0]
            break
          case "End":
            next = enabled.at(-1)
            break
          case "ArrowUp":
          case "ArrowLeft":
          case "ArrowDown":
          case "ArrowRight":
            next = enabled[(index + step + enabled.length) % enabled.length]
            break
        }
        if (!next) return
        event.preventDefault()
        next.trigger.focus()
      },
      options,
    )
  }

  const observer = new MutationObserver(onRequestUpdate)
  observer.observe(host, {
    attributeFilter: ["disabled", "label", "value"],
    attributes: true,
    childList: true,
    subtree: true,
  })
  const pendingUpgrade = waitingForUpgrade ? setTimeout(onRequestUpdate, 0) : undefined
  return () => {
    if (pendingUpgrade !== undefined) clearTimeout(pendingUpgrade)
    observer.disconnect()
    listeners.abort()
  }
}
