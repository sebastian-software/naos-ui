import "@naos-ui/primitives/popover"
import "@naos-ui/primitives/select"
import "@naos-ui/primitives/select-item"

const events = document.createElement("pre")
events.id = "primitive-events"
events.hidden = true
events.textContent = "[]"
document.body.append(events)

const eventLog: Array<{
  tag: string
  id: string
  type: string
  detail: unknown
  bubbles: boolean
  composed: boolean
}> = []
for (const type of ["naos-open-change", "naos-change"]) {
  // Capture non-bubbling events too, so a propagation regression is visible.
  document.addEventListener(
    type,
    (event) => {
      if (!(event instanceof CustomEvent && event.target instanceof HTMLElement)) return
      eventLog.push({
        tag: event.target.localName,
        id: event.target.id,
        type,
        detail: event.detail,
        bubbles: event.bubbles,
        composed: event.composed,
      })
      events.textContent = JSON.stringify(eventLog)
    },
    true,
  )
}
