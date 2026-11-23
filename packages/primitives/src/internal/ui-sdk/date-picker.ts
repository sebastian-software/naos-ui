export function decorateCalendar(root: ParentNode): () => void {
  // The compiler mounts <template> children outside template.content. Build
  // the SDK's documented day template before replacing its generated weeks.
  const weeks = root.querySelector("ui-calendar-weeks")
  if (weeks && !weeks.querySelector(":scope > template")) {
    const replacement = document.createElement("ui-calendar-weeks")
    const template = document.createElement("template")
    const day = document.createElement("ui-calendar-day")
    day.setAttribute("as-child", "")
    day.setAttribute("part", "table-cell")
    const button = document.createElement("button")
    button.type = "button"
    button.setAttribute("part", "cell-trigger")
    day.append(button)
    template.content.append(day)
    replacement.append(template)
    weeks.replaceWith(replacement)
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
    const number = new Intl.NumberFormat(locale)
    for (const day of root.querySelectorAll("ui-calendar-day")) {
      const value = day.getAttribute("value")
      const button = day.querySelector<HTMLButtonElement>("[part~='cell-trigger']")
      if (value !== null && button) {
        if (day.getAttribute("data-value") !== value) day.setAttribute("data-value", value)
        const label = number.format(Number(value.slice(-2)))
        if (button.textContent !== label) button.textContent = label
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
