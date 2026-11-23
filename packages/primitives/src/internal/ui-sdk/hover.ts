import { bindLayer, position } from "@ui-sdk/core"
import { primitiveId } from "./id.js"

type Options = {
  element: HTMLElement
  root: ParentNode
  kind: "tooltip" | "hover-card"
  initialOpen: boolean
  onOpen(open: boolean): void
}

export function bindHover({ element, root, kind, initialOpen, onOpen }: Options) {
  const trigger = root.querySelector<HTMLElement>("[part~='trigger']")!
  const content = root.querySelector<HTMLElement>("[part~='content']")!
  const positioner = root.querySelector<HTMLElement>("[part~='positioner']")!
  const abort = new AbortController()
  let open = false
  let stopLayer: VoidFunction | undefined
  let stopPosition: VoidFunction | undefined
  const disabled = () => element.hasAttribute("disabled")
  content.id = primitiveId(kind) + "-content"
  if (kind === "tooltip") {
    content.setAttribute("role", "tooltip")
    trigger.setAttribute("aria-describedby", content.id)
  } else content.setAttribute("data-scope", "hover-card")
  function setOpen(next: boolean, notify = true) {
    if (next === open || (next && disabled())) return
    open = next
    stopLayer?.()
    stopPosition?.()
    stopLayer = undefined
    stopPosition = undefined
    if (next) {
      stopLayer = bindLayer(content, {
        contains: (target) =>
          target === element || element.contains(target) || trigger.contains(target),
        onDismiss: () => setOpen(false),
      })
      stopPosition = position(trigger, positioner, { side: "top", align: "center" })
    }
    if (notify) onOpen(next)
  }
  const openPointer = (event: PointerEvent) => {
    if (event.pointerType !== "touch") setOpen(true)
  }
  trigger.addEventListener("pointerenter", openPointer, { signal: abort.signal })
  trigger.addEventListener("pointermove", openPointer, { signal: abort.signal })
  trigger.addEventListener("pointerleave", () => setOpen(false), { signal: abort.signal })
  trigger.addEventListener("focus", () => setOpen(true), { signal: abort.signal })
  trigger.addEventListener("blur", () => setOpen(false), { signal: abort.signal })
  if (kind === "hover-card") {
    content.addEventListener("pointerenter", openPointer, { signal: abort.signal })
    content.addEventListener("pointerleave", () => setOpen(false), { signal: abort.signal })
  }
  if (initialOpen) setOpen(true, false)
  return {
    syncDisabled(blocked: boolean) {
      if (blocked) setOpen(false)
    },
    destroy() {
      abort.abort()
      stopLayer?.()
      stopPosition?.()
    },
  }
}
