import { bindLayer, position } from "@ui-sdk/core"
import { primitiveId } from "./id.js"

type Options = {
  element: HTMLElement
  root: ParentNode
  kind: "tooltip" | "hover-card"
  initialOpen: boolean
  openDelay: number
  closeDelay: number
  onOpen(open: boolean): void
}

export function bindHover({
  element,
  root,
  kind,
  initialOpen,
  openDelay,
  closeDelay,
  onOpen,
}: Options) {
  const trigger = root.querySelector<HTMLElement>("[part~='trigger']")!
  const content = root.querySelector<HTMLElement>("[part~='content']")!
  const positioner = root.querySelector<HTMLElement>("[part~='positioner']")!
  const abort = new AbortController()
  let open = false
  let stopLayer: VoidFunction | undefined
  let stopPosition: VoidFunction | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let pending: boolean | undefined
  function cancelTimer() {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
    pending = undefined
  }
  const disabled = () => element.hasAttribute("disabled")
  content.id = primitiveId(kind) + "-content"
  if (kind === "tooltip") {
    content.setAttribute("role", "tooltip")
    trigger.setAttribute("aria-describedby", content.id)
  } else content.setAttribute("data-scope", "hover-card")
  function setOpen(next: boolean, notify = true) {
    cancelTimer()
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
  function schedule(next: boolean) {
    if (pending === next) return
    cancelTimer()
    if (next === open || (next && disabled())) return
    const delay = Math.max(
      0,
      Number.isFinite(next ? openDelay : closeDelay) ? (next ? openDelay : closeDelay) : 0,
    )
    if (delay === 0) {
      setOpen(next)
      return
    }
    pending = next
    timer = setTimeout(() => setOpen(next), delay)
  }
  const openPointer = (event: PointerEvent) => {
    if (event.pointerType !== "touch") schedule(true)
  }
  trigger.addEventListener("pointerenter", openPointer, { signal: abort.signal })
  trigger.addEventListener("pointermove", openPointer, { signal: abort.signal })
  trigger.addEventListener("pointerleave", () => schedule(false), { signal: abort.signal })
  trigger.addEventListener("focus", () => schedule(true), { signal: abort.signal })
  trigger.addEventListener("blur", () => schedule(false), { signal: abort.signal })
  if (kind === "hover-card") {
    content.addEventListener("pointerenter", openPointer, { signal: abort.signal })
    content.addEventListener("pointerleave", () => schedule(false), { signal: abort.signal })
  }
  if (initialOpen) setOpen(true, false)
  return {
    syncDisabled(blocked: boolean) {
      if (blocked) setOpen(false)
    },
    syncDelays(nextOpen: number, nextClose: number) {
      openDelay = nextOpen
      closeDelay = nextClose
    },
    destroy() {
      cancelTimer()
      abort.abort()
      stopLayer?.()
      stopPosition?.()
    },
  }
}
