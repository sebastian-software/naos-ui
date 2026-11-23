import { checkbox } from "@ui-sdk/core/checkbox"
import { primitiveId } from "./id.js"

type Accessor<T> = { (): T; set(value: T): void }
type Options = {
  element: HTMLElement
  selected: Accessor<boolean>
  mixed: Accessor<boolean>
  flush(): void
  onChange(checked: boolean, indeterminate: boolean): void
}

// The generated prop is a reflected default. A native checkbox instead exposes
// live checkedness on its property, independently of the checked attribute.
export function createCheckboxBinding({ element, selected, mixed, flush, onChange }: Options) {
  let service: ReturnType<typeof checkbox> | null = null
  let observer: MutationObserver | null = null
  let dirty = false
  let suppress = false
  let installed = false
  let lastChecked = element.hasAttribute("checked")
  let lastMixed = element.hasAttribute("indeterminate")
  const syncService = () => {
    if (!service) return
    suppress = true
    try {
      service.api.setChecked(mixed() ? "indeterminate" : selected())
    } finally {
      suppress = false
    }
  }
  const setChecked = (value: boolean, markDirty: boolean) => {
    if (markDirty) dirty = true
    selected.set(value)
    syncService()
    flush()
  }
  const setMixed = (value: boolean) => {
    mixed.set(value)
    syncService()
    flush()
  }
  const syncDefaults = () => {
    const nextChecked = element.hasAttribute("checked")
    const nextMixed = element.hasAttribute("indeterminate")
    if (nextChecked !== lastChecked && !dirty) setChecked(nextChecked, false)
    if (nextMixed !== lastMixed) setMixed(nextMixed)
    lastChecked = nextChecked
    lastMixed = nextMixed
  }
  function installProperties() {
    if (installed) return
    const hadChecked = Object.hasOwn(element, "checked")
    const hadMixed = Object.hasOwn(element, "indeterminate")
    const oldChecked = hadChecked
      ? (element as HTMLElement & { checked: unknown }).checked
      : undefined
    const oldMixed = hadMixed
      ? (element as HTMLElement & { indeterminate: unknown }).indeterminate
      : undefined
    Object.defineProperties(element, {
      checked: {
        configurable: true,
        get: () => selected(),
        set: (value: unknown) => {
          setChecked(Boolean(value), true)
        },
      },
      indeterminate: {
        configurable: true,
        get: () => mixed(),
        set: (value: unknown) => {
          setMixed(Boolean(value))
        },
      },
    })
    installed = true
    if (hadChecked) setChecked(Boolean(oldChecked), true)
    if (hadMixed) setMixed(Boolean(oldMixed))
  }
  return {
    connect() {
      installProperties()
      syncDefaults()
      service = checkbox({
        id: primitiveId("checkbox"),
        defaultChecked: mixed() ? "indeterminate" : selected(),
        onCheckedChange(next) {
          if (suppress) return
          dirty = true
          selected.set(next === true)
          mixed.set(next === "indeterminate")
          flush()
          onChange(next === true, next === "indeterminate")
        },
      })
      observer = new MutationObserver(syncDefaults)
      observer.observe(element, { attributes: true, attributeFilter: ["checked", "indeterminate"] })
    },
    toggle() {
      // Attribute reactions run in a microtask; consume pending defaults before
      // input so a same-task checked attribute change cannot be lost.
      syncDefaults()
      // The SDK uses one tri-state value. Native activation flips the
      // independent checked bit even when the presentation is mixed.
      service?.api.setChecked(!selected(), { reason: "press" })
    },
    reset() {
      dirty = false
      lastChecked = element.hasAttribute("checked")
      selected.set(lastChecked)
      syncService()
    },
    disconnect() {
      observer?.disconnect()
      observer = null
      service?.destroy()
      service = null
    },
  }
}
