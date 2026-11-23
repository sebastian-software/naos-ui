export function decorateCalendar(root: ParentNode): () => void {
  const apply = () => {
    const trigger = root.querySelector('[part~="trigger"]')
    if (trigger?.getAttribute("aria-haspopup") !== "grid")
      trigger?.setAttribute("aria-haspopup", "grid")
    if (trigger?.getAttribute("aria-controls") !== "naos-date-picker-grid")
      trigger?.setAttribute("aria-controls", "naos-date-picker-grid")
    for (const day of root.querySelectorAll("ui-calendar-day")) {
      day.setAttribute("part", "cell-trigger")
      const value = day.getAttribute("value")
      if (value !== null) day.setAttribute("data-value", value)
    }
  }
  apply()
  const observer = new MutationObserver(apply)
  observer.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["aria-haspopup", "aria-controls"],
  })
  return () => observer.disconnect()
}
