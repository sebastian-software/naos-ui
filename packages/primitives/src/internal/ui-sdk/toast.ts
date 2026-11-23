import { createToaster, type ToastOptions } from "@ui-sdk/core/toast"
import type { UiToastRegionElement } from "@ui-sdk/web/toast"

const notifications = createToaster<string | Node>({ duration: 5000 })

export function createNaosToast({
  closable,
  ...options
}: ToastOptions<string> & { closable: boolean }) {
  return notifications({
    ...options,
    dismissible: closable,
    cancel: closable ? { label: "Dismiss" } : undefined,
  })
}

export function bindToastRegion(
  region: UiToastRegionElement,
  update: (count: number) => void,
  status: (id: string, state: string) => void,
) {
  region.renderToast = (toast, element) => {
    element.setAttribute("part", "toast")
    element.dataset.state = "visible"
    element.dataset.type = toast.type
    element.querySelector("ui-toast-title")?.setAttribute("part", "title")
    element.querySelector("ui-toast-description")?.setAttribute("part", "description")
    const close = element.querySelector("ui-toast-close button")
    close?.setAttribute("part", "close")
    close?.setAttribute("aria-label", "Dismiss notification")
  }
  region.toaster = notifications
  let visible = new Set<string>()
  const sync = () => {
    const next = new Set(
      notifications
        .toasts()
        .slice(0, 4)
        .map((toast) => toast.id),
    )
    for (const id of visible) {
      if (!next.has(id)) {
        status(id, "dismissing")
        status(id, "unmounted")
      }
    }
    for (const id of next) if (!visible.has(id)) status(id, "visible")
    visible = next
    update(next.size)
  }
  sync()
  return notifications.subscribe(sync)
}
