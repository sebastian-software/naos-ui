import "@ui-sdk/web/select"
import type { SelectEvents } from "@ui-sdk/web/select"
import { effect, event, formControl, host, state } from "@naos-ui/core"

export function LabSelect({
  name = "",
  value = "",
  label = "City",
  disabled = false,
}: {
  name?: string
  value?: string
  label?: string
  disabled?: boolean
} = {}) {
  const selected = state(value)
  const changed = event<{ value: string }>("naos-change")
  const form = formControl({
    value: () => selected() || null,
    reset: () => {
      selected.set(value)
      const control = host().root.querySelector("ui-select")
      if (control) control.value = value
    },
    disabled,
  })
  void form
  void name
  effect(() => {
    const { element, root } = host()
    const control = root.querySelector("ui-select")
    if (!control) return
    const sync = () => {
      control.items = Array.from(element.querySelectorAll(":scope > naos-select-item"), (item) => ({
        value: item.getAttribute("value") ?? "",
        label: item.getAttribute("label") ?? item.textContent?.trim() ?? "",
        disabled: item.hasAttribute("disabled"),
      }))
    }
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(element, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["label", "value", "disabled"],
    })
    return () => observer.disconnect()
  })
  return (
    <ui-select
      default-value={value}
      disabled={disabled}
      onValuechange={(e) => {
        const next = (e as SelectEvents["valuechange"]).detail.value
        if (typeof next === "string") {
          selected.set(next)
          changed.emit({ value: next })
        }
      }}
    >
      <ui-select-label>{label}</ui-select-label>
      <ui-select-trigger>
        <button part="trigger" type="button" />
      </ui-select-trigger>
    </ui-select>
  )
}
