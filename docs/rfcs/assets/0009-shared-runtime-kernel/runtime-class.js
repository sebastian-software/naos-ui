// Variant A: abstract base class. Same logic as runtime-fn.js, as methods.
const metadataKey = Symbol.for("naos.component.metadata")
let registrationWarned = false

export class NaosElement extends HTMLElement {
  #root
  #mounted = false
  #dirty = new Set()
  #full = true
  #scheduled = false
  #props
  #state = {}
  #abort = new AbortController()
  #scopeAbort = new AbortController()
  #resolvers = []
  #tasks = []
  #eventAborts = new Set()
  #effectsOn = false
  #cleanups = []
  #cache = new Map()
  #hostId = ""

  constructor() {
    super()
    const existing = this.shadowRoot
    if (existing) {
      this.#root = existing
    } else {
      this.#root = this.attachShadow({ mode: "open" })
    }
    this.#props = { ...this.constructor._naosSpec.defaults }
  }

  static _naosDefineProps() {
    const spec = this._naosSpec
    for (const name of Object.keys(spec.props)) {
      const def = spec.props[name]
      Object.defineProperty(this.prototype, name, {
        get() {
          return this._naosProps[name]
        },
        set(value) {
          this._naosSetProp(name, def, value)
        },
      })
    }
  }

  get _naosProps() {
    return this.#props
  }

  get _naosState() {
    return this.#state
  }

  get _naosRoot() {
    return this.#root
  }

  _naosSetProp(name, def, value) {
    const next = def.coerce(value)
    this.#props[name] = next
    this._naosMarkDirty(name)
    def.reflect(this, next)
    this._naosFlushSync()
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return
    const def = this.constructor._naosSpec.attrs[name]
    if (!def) return
    this.#props[def.prop] = def.parse(newValue)
    this._naosMarkDirty(def.prop)
    this._naosFlushSync()
  }

  connectedCallback() {
    if (!this.#mounted) {
      this.#ensureHostId()
      this._naosInitState()
      this.#adoptStyles()
      this._naosMount()
      this.#mounted = true
    } else {
      this._naosMarkAllDirty()
    }
    this.#effectsOn = true
    this._naosFlushSync()
  }

  disconnectedCallback() {
    this.#effectsOn = false
    for (const controller of Array.from(this.#eventAborts)) controller.abort()
    this.#eventAborts.clear()
    this.#abort.abort()
    this.#abortScope()
    for (let index = 0; index < this.#cleanups.length; index += 1) this.#cleanupEffect(index)
    this.#abort = new AbortController()
  }

  _naosInitState() {}

  _naosMount() {}

  _naosUpdate(_dirty) {}

  _naosEffects(_dirty) {}

  #cleanupEffect(index) {
    const cleanup = this.#cleanups[index]
    if (typeof cleanup === "function") cleanup()
    this.#cleanups[index] = undefined
  }

  #adoptStyles() {
    this.#root.adoptedStyleSheets = [this.constructor._naosSpec.styles()]
  }

  _naosMarkDirty(source) {
    this.#dirty.add(source)
    this.#cache.clear()
  }

  _naosMarkAllDirty() {
    this.#full = true
    this.#dirty.clear()
    this.#cache.clear()
  }

  _naosScheduleFlush() {
    if (this.#scheduled) return
    this.#scheduled = true
    queueMicrotask(() => {
      if (!this.#scheduled) return
      this.#scheduled = false
      this.#flush()
    })
  }

  _naosFlushSync() {
    this.#scheduled = false
    this.#flush()
  }

  #flush() {
    if (!this.#mounted) return
    let flushError
    let didFail = false
    this.#scopeAbort.abort()
    this.#scopeAbort = new AbortController()
    try {
      const dirty = this.#consumeDirty()
      this.#cache.clear()
      this._naosUpdate(dirty)
      if (this.#effectsOn) this._naosEffects(dirty)
    } catch (error) {
      flushError = error
      didFail = true
      this._naosMarkAllDirty()
    } finally {
      this.#finishScope()
    }
    if (didFail) this.#reportError(flushError)
  }

  #consumeDirty() {
    if (this.#full) {
      this.#full = false
      this.#dirty.clear()
      return null
    }
    const dirty = this.#dirty
    this.#dirty = new Set()
    return dirty
  }

  _naosShouldUpdate(dependencies, dirty) {
    if (dirty === null || dependencies === null) return true
    for (const source of dependencies) {
      if (dirty.has(source)) return true
    }
    return false
  }

  #finishScope() {
    const signal = this.#scopeAbort.signal
    const resolvers = this.#resolvers
    this.#resolvers = []
    for (const resolve of resolvers) resolve(signal)
    const tasks = this.#tasks
    this.#tasks = []
    for (const task of tasks) {
      try {
        task()
      } catch (error) {
        this.#reportError(error)
      }
    }
  }

  #abortScope() {
    this.#scopeAbort.abort()
    const signal = this.#scopeAbort.signal
    const resolvers = this.#resolvers
    this.#resolvers = []
    for (const resolve of resolvers) resolve(signal)
    this.#tasks = []
    this.#scopeAbort = new AbortController()
  }

  #reportError(error) {
    this.dispatchEvent(
      new CustomEvent("naos-error", {
        detail: { error },
        bubbles: true,
        composed: true,
        cancelable: false,
      }),
    )
    const reporter = globalThis.reportError
    if (typeof reporter === "function") {
      reporter.call(globalThis, error)
      return
    }
    setTimeout(() => {
      throw error
    }, 0)
  }

  #ensureHostId() {
    if (this.#hostId) return
    if (this.id) {
      this.#hostId = this.id
      return
    }
    const root = this.getRootNode()
    const siblings =
      typeof root.querySelectorAll === "function"
        ? Array.from(root.querySelectorAll(this.localName))
        : []
    const index = siblings.indexOf(this)
    this.#hostId = `${this.localName}-${index < 0 ? 1 : index + 1}`
  }

  _naosStateAccessor(name) {
    const read = () => this.#state[name]
    read.set = (value) => {
      if (Object.is(this.#state[name], value)) return
      this.#state[name] = value
      this._naosMarkDirty(name)
      this._naosScheduleFlush()
    }
    read.update = (updater) => {
      read.set(updater(read()))
    }
    return read
  }

  _naosComputedAccessor(name, compute) {
    return () => {
      if (!this.#cache.has(name)) this.#cache.set(name, compute())
      return this.#cache.get(name)
    }
  }

  _naosEmitter(name) {
    return {
      emit: (detail) => {
        this.dispatchEvent(
          new CustomEvent(name, { detail, bubbles: true, composed: true, cancelable: false }),
        )
      },
    }
  }

  _naosHostApi() {
    return () => ({
      id: this.#hostId,
      element: this,
      root: this.#root,
      props: this.#props,
      signal: this.#abort.signal,
      update: () =>
        new Promise((resolve) => {
          this.#resolvers.push(resolve)
          this._naosMarkAllDirty()
          this._naosScheduleFlush()
        }),
      queueTask: (task) => {
        this.#tasks.push(task)
        this._naosScheduleFlush()
      },
      flushSync: () => this._naosFlushSync(),
    })
  }

  _naosListen(node, type, handler) {
    let controller = null
    node.addEventListener(type, (event) => {
      if (controller) controller.abort()
      controller = new AbortController()
      this.#eventAborts.add(controller)
      const signal = controller.signal
      signal.addEventListener("abort", () => this.#eventAborts.delete(controller), { once: true })
      handler(event, signal)
    })
  }

  _naosRunEffect(index, dirty, dependencies, body) {
    if (!this._naosShouldUpdate(dependencies, dirty)) return
    this.#cleanupEffect(index)
    const cleanup = body()
    if (typeof cleanup === "function") this.#cleanups[index] = cleanup
  }

  _naosSetAttr(node, name, value) {
    if (value == null || value === false) {
      node.removeAttribute(name)
    } else {
      node.setAttribute(name, String(value))
    }
  }

  _naosReconcileKeyed(container, records, items, keyOf, build, patch) {
    const nextRecords = new Map()
    const nodes = []
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index]
      const key = keyOf(item, index)
      let record = records.get(key)
      if (!record) record = build(item, index)
      record.value = item
      record.index = index
      patch(record, item, index)
      nextRecords.set(key, record)
      nodes.push(record.node)
    }
    let cursor = container.firstChild
    for (const ordered of nodes) {
      if (cursor === ordered) {
        cursor = cursor.nextSibling
      } else {
        container.insertBefore(ordered, cursor)
      }
    }
    while (cursor) {
      const next = cursor.nextSibling
      container.removeChild(cursor)
      cursor = next
    }
    return nextRecords
  }
}

export function lazySheet(sources) {
  let sheet
  return () => {
    if (!sheet) {
      sheet = new CSSStyleSheet()
      sheet.replaceSync(sources.join("\n"))
    }
    return sheet
  }
}

export function defineComponent(tag, ctor, metadata) {
  Object.defineProperty(ctor, metadataKey, { value: Object.freeze(metadata) })
  const registered = customElements.get(tag)
  if (!registered) {
    customElements.define(tag, ctor)
    return
  }
  if (registered === ctor) return
  const existing = registered[metadataKey]
  if (
    existing?.packageName === metadata.packageName &&
    existing?.packageVersion === metadata.packageVersion
  )
    return
  if (registrationWarned) return
  registrationWarned = true
  console.warn(`naos-ui: <${tag}> is already registered by ${existing?.packageName ?? "unknown"}.`)
}
