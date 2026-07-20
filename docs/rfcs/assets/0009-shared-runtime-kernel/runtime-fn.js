// Variant B: functional kernel. Free functions over a per-instance state record.
export const K = Symbol("naos.kernel")

export function createKernel(el, spec) {
  const existing = el.shadowRoot
  return {
    el,
    spec,
    root: existing ?? el.attachShadow({ mode: "open" }),
    declarative: Boolean(existing),
    mounted: false,
    dirty: new Set(),
    full: true,
    scheduled: false,
    props: { ...spec.defaults },
    state: {},
    abort: new AbortController(),
    scopeAbort: new AbortController(),
    resolvers: [],
    tasks: [],
    eventAborts: new Set(),
    effectsOn: false,
    cleanups: [],
    cache: new Map(),
    hostId: "",
  }
}

export function defineProps(ctor, spec) {
  for (const name of Object.keys(spec.props)) {
    const def = spec.props[name]
    Object.defineProperty(ctor.prototype, name, {
      get() {
        return this[K].props[name]
      },
      set(value) {
        setProp(this[K], name, def, value)
      },
    })
  }
}

export function setProp(k, name, def, value) {
  const next = def.coerce(value)
  k.props[name] = next
  markDirty(k, name)
  def.reflect(k.el, next)
  flushSync(k)
}

export function attrChanged(k, name, oldValue, newValue) {
  if (oldValue === newValue) return
  const def = k.spec.attrs[name]
  if (!def) return
  k.props[def.prop] = def.parse(newValue)
  markDirty(k, def.prop)
  flushSync(k)
}

export function connect(k) {
  if (!k.mounted) {
    ensureHostId(k)
    if (k.spec.initState) k.spec.initState(k)
    adoptStyles(k)
    k.spec.mount(k)
    k.mounted = true
  } else {
    markAllDirty(k)
  }
  k.effectsOn = true
  flushSync(k)
}

export function disconnect(k) {
  k.effectsOn = false
  for (const controller of Array.from(k.eventAborts)) controller.abort()
  k.eventAborts.clear()
  k.abort.abort()
  abortScope(k)
  for (let index = 0; index < k.cleanups.length; index += 1) cleanupEffect(k, index)
  k.abort = new AbortController()
}

export function cleanupEffect(k, index) {
  const cleanup = k.cleanups[index]
  if (typeof cleanup === "function") cleanup()
  k.cleanups[index] = undefined
}

export function adoptStyles(k) {
  k.root.adoptedStyleSheets = [k.spec.styles()]
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

export function markDirty(k, source) {
  k.dirty.add(source)
  k.cache.clear()
}

export function markAllDirty(k) {
  k.full = true
  k.dirty.clear()
  k.cache.clear()
}

export function scheduleFlush(k) {
  if (k.scheduled) return
  k.scheduled = true
  queueMicrotask(() => {
    if (!k.scheduled) return
    k.scheduled = false
    flush(k)
  })
}

export function flushSync(k) {
  k.scheduled = false
  flush(k)
}

export function flush(k) {
  if (!k.mounted) return
  let flushError
  let didFail = false
  k.scopeAbort.abort()
  k.scopeAbort = new AbortController()
  try {
    const dirty = consumeDirty(k)
    k.cache.clear()
    k.spec.update(k, dirty)
    if (k.effectsOn && k.spec.effects) k.spec.effects(k, dirty)
  } catch (error) {
    flushError = error
    didFail = true
    markAllDirty(k)
  } finally {
    finishScope(k)
  }
  if (didFail) reportError_(k, flushError)
}

export function consumeDirty(k) {
  if (k.full) {
    k.full = false
    k.dirty.clear()
    return null
  }
  const dirty = k.dirty
  k.dirty = new Set()
  return dirty
}

export function shouldUpdate(dependencies, dirty) {
  if (dirty === null || dependencies === null) return true
  for (const source of dependencies) {
    if (dirty.has(source)) return true
  }
  return false
}

export function finishScope(k) {
  const signal = k.scopeAbort.signal
  const resolvers = k.resolvers
  k.resolvers = []
  for (const resolve of resolvers) resolve(signal)
  const tasks = k.tasks
  k.tasks = []
  for (const task of tasks) {
    try {
      task()
    } catch (error) {
      reportError_(k, error)
    }
  }
}

export function abortScope(k) {
  k.scopeAbort.abort()
  const signal = k.scopeAbort.signal
  const resolvers = k.resolvers
  k.resolvers = []
  for (const resolve of resolvers) resolve(signal)
  k.tasks = []
  k.scopeAbort = new AbortController()
}

export function reportError_(k, error) {
  k.el.dispatchEvent(
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

export function ensureHostId(k) {
  if (k.hostId) return
  if (k.el.id) {
    k.hostId = k.el.id
    return
  }
  const root = k.el.getRootNode()
  const siblings =
    typeof root.querySelectorAll === "function"
      ? Array.from(root.querySelectorAll(k.el.localName))
      : []
  const index = siblings.indexOf(k.el)
  k.hostId = `${k.el.localName}-${index < 0 ? 1 : index + 1}`
}

export function stateAccessor(k, name) {
  const read = () => k.state[name]
  read.set = (value) => {
    if (Object.is(k.state[name], value)) return
    k.state[name] = value
    markDirty(k, name)
    scheduleFlush(k)
  }
  read.update = (updater) => {
    read.set(updater(read()))
  }
  return read
}

export function computedAccessor(k, name, compute) {
  return () => {
    if (!k.cache.has(name)) k.cache.set(name, compute())
    return k.cache.get(name)
  }
}

export function emitter(k, name) {
  return {
    emit: (detail) => {
      k.el.dispatchEvent(
        new CustomEvent(name, { detail, bubbles: true, composed: true, cancelable: false }),
      )
    },
  }
}

export function hostApi(k) {
  return () => ({
    id: k.hostId,
    element: k.el,
    root: k.root,
    props: k.props,
    signal: k.abort.signal,
    update: () =>
      new Promise((resolve) => {
        k.resolvers.push(resolve)
        markAllDirty(k)
        scheduleFlush(k)
      }),
    queueTask: (task) => {
      k.tasks.push(task)
      scheduleFlush(k)
    },
    flushSync: () => flushSync(k),
  })
}

export function listen(k, node, type, handler) {
  let controller = null
  node.addEventListener(type, (event) => {
    if (controller) controller.abort()
    controller = new AbortController()
    k.eventAborts.add(controller)
    const signal = controller.signal
    signal.addEventListener("abort", () => k.eventAborts.delete(controller), { once: true })
    handler(event, signal)
  })
}

export function runEffect(k, index, dirty, dependencies, body) {
  if (!shouldUpdate(dependencies, dirty)) return
  cleanupEffect(k, index)
  const cleanup = body()
  if (typeof cleanup === "function") k.cleanups[index] = cleanup
}

export function setAttr(node, name, value) {
  if (value == null || value === false) {
    node.removeAttribute(name)
  } else {
    node.setAttribute(name, String(value))
  }
}

export function reconcileKeyed(container, records, items, keyOf, build, patch) {
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

const metadataKey = Symbol.for("naos.component.metadata")
let registrationWarned = false

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
