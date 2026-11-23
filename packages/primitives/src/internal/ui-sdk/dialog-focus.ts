import type { UiDialogElement } from "@ui-sdk/web/dialog"

const pending = new WeakMap<ParentNode, ReturnType<typeof setTimeout>>()

export function cancelDialogInitialFocus(root: ParentNode) {
  clearTimeout(pending.get(root))
  pending.delete(root)
}

// The SDK selector cannot resolve a target inside Naos's shadow root.
export function scheduleDialogInitialFocus(root: ParentNode) {
  cancelDialogInitialFocus(root)
  pending.set(
    root,
    setTimeout(() => {
      pending.delete(root)
      const control = root.querySelector<UiDialogElement>("ui-dialog")
      const content = root.querySelector<HTMLElement>("[part~=content]")
      const trigger = root.querySelector<HTMLElement>("[part~=trigger]")
      const cancel = root.querySelector<HTMLElement>("[part~=close]")
      const active = root instanceof ShadowRoot ? root.activeElement : null
      if (
        control?.isConnected &&
        control.open &&
        (!active || active === content || active === trigger || active === cancel)
      )
        cancel?.focus()
    }, 0),
  )
}

export function hasOpenNestedDialog(element: HTMLElement) {
  return Array.from(element.querySelectorAll<HTMLElement>("naos-dialog")).some(
    (dialog) => dialog.shadowRoot?.querySelector<UiDialogElement>("ui-dialog")?.open,
  )
}

// Closing a native popover can asynchronously return focus to the body. Retry
// only while focus is still lost, so an explicit new focus is never displaced.
export function scheduleDialogReturnFocus(root: ParentNode) {
  cancelDialogInitialFocus(root)
  const control = root.querySelector<UiDialogElement>("ui-dialog")
  const trigger = root.querySelector<HTMLElement>("[part~=trigger]")
  trigger?.focus()
  pending.set(
    root,
    setTimeout(() => {
      pending.delete(root)
      if (control?.isConnected && !control.open && document.activeElement === document.body)
        trigger?.focus()
    }, 50),
  )
}
