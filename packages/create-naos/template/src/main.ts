import "@naos-ui/primitives/button"
import "./app-counter.wc.tsx"

document.addEventListener("change", (event) => {
  if (event instanceof CustomEvent) {
    document.body.dataset.lastChange = String(event.detail)
  }
})
