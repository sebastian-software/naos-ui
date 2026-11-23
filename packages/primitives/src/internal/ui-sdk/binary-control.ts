type BooleanAccessor = { (): boolean; set(value: boolean): void }
type Service = {
  set(value: boolean, event?: Event): boolean
  destroy(): void
}
type Options = {
  element: HTMLElement
  property: "checked" | "pressed"
  active: BooleanAccessor
  flush(): void
  onChange(value: boolean): void
  create(initial: boolean): Service
}

// The reflected attribute supplies the reset default. Once connected, the host
// property exposes live state independently, as the checkbox binding does.
export function createBinaryControlBinding({
  element,
  property,
  active,
  flush,
  onChange,
  create,
}: Options) {
  let service: Service | null = null
  let observer: MutationObserver | null = null
  let dirty = false
  let installed = false
  let lastDefault = element.hasAttribute(property)

  function syncService() {
    service?.set(active())
  }
  function setLive(value: boolean, markDirty: boolean) {
    if (markDirty) dirty = true
    active.set(value)
    syncService()
    flush()
  }
  function syncDefault() {
    const next = element.hasAttribute(property)
    if (next !== lastDefault && !dirty) setLive(next, false)
    lastDefault = next
  }
  function installProperty() {
    if (installed) return
    const hadOwn = Object.hasOwn(element, property)
    const initial = hadOwn ? (element as unknown as Record<string, unknown>)[property] : undefined
    Object.defineProperty(element, property, {
      configurable: true,
      get: () => active(),
      set: (value: unknown) => {
        setLive(Boolean(value), true)
      },
    })
    installed = true
    if (hadOwn) setLive(Boolean(initial), true)
  }
  return {
    connect() {
      installProperty()
      syncDefault()
      service = create(active())
      observer = new MutationObserver(syncDefault)
      observer.observe(element, { attributes: true, attributeFilter: [property] })
    },
    activate(event?: Event) {
      syncDefault()
      const next = !active()
      if (!service?.set(next, event)) return
      dirty = true
      active.set(next)
      flush()
      onChange(next)
    },
    reset() {
      dirty = false
      lastDefault = element.hasAttribute(property)
      active.set(lastDefault)
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
