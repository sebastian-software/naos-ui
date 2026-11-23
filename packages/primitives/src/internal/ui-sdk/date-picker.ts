import { dateFormatter } from "@ui-sdk/core/date"

export function decorateCalendar(root: ParentNode): () => void {
  // The compiler mounts <template> children outside template.content. Build
  // the SDK's documented day template before replacing its generated weeks.
  const weeks = root.querySelector("ui-calendar-weeks")
  if (weeks && !weeks.querySelector(":scope > template")) {
    const replacement = document.createElement("ui-calendar-weeks")
    const template = document.createElement("template")
    // Parse in the template's inert document so custom-element constructors
    // run only after each clone has its as-child target in place.
    template.innerHTML = `<ui-calendar-day as-child part="table-cell"><span part="cell-trigger"></span></ui-calendar-day>`
    replacement.append(template)
    // Let the SDK release the old day bindings before registering the same
    // dates on new targets. Otherwise Firefox loses their keyboard handlers.
    const marker = document.createComment("calendar weeks")
    weeks.replaceWith(marker)
    queueMicrotask(() => marker.replaceWith(replacement))
  }
  const apply = () => {
    const trigger = root.querySelector('[part~="trigger"]')
    if (trigger?.getAttribute("aria-haspopup") !== "grid")
      trigger?.setAttribute("aria-haspopup", "grid")
    if (trigger?.getAttribute("aria-controls") !== "naos-date-picker-grid")
      trigger?.setAttribute("aria-controls", "naos-date-picker-grid")
    for (const [selector, part] of [
      ["ui-calendar-weekdays", "table-head"],
      ["ui-calendar-weekday", "table-header"],
      ["ui-calendar-weeks", "table-body"],
      ["ui-calendar-week > [role=gridcell]", "table-cell"],
    ] as const) {
      for (const node of root.querySelectorAll(selector)) {
        if (!node.part.contains(part)) node.part.add(part)
      }
    }
    const locale = root.querySelector("ui-date-picker")?.getAttribute("locale") || "en-US"
    const formatter = dateFormatter(locale, { day: "numeric" })
    for (const day of root.querySelectorAll("ui-calendar-day")) {
      const value = day.getAttribute("value")
      const target = day.querySelector<HTMLElement>("[part~='cell-trigger']")
      if (value !== null && target) {
        if (day.getAttribute("data-value") !== value) day.setAttribute("data-value", value)
        const label = formatter.format(Date.UTC(2000, 0, Number(value.slice(8))))
        if (target.textContent !== label) target.textContent = label
      }
    }
  }
  apply()
  const observer = new MutationObserver(apply)
  observer.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["aria-haspopup", "aria-controls", "locale"],
  })
  return () => observer.disconnect()
}
