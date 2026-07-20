import { createNaosEvent, scheduleNaosUpdate } from "./runtime.js"

/**
 * Private-to-the-runtime instance slot used by compiler-generated element
 * shells. The symbol is exported so independently compiled packages can share
 * the same kernel without exposing fields on the Custom Element instance.
 */
export const K = Symbol("naos.kernel")

export type DirtySources = ReadonlySet<string> | null
export type Cleanup = (() => void) | void
export type KernelNode = Element | Text

export type PropSpec = {
  attribute?: string
  source?: string
  coerce(value: unknown): unknown
  parse?(value: string | null): unknown
  reflect?: boolean
}

export type ComponentMetadata = {
  packageName: string
  packageVersion: string | null
  tagName: string
}

export type LazyStyleSheet = () => CSSStyleSheet

export type KernelSpec = {
  /** A Custom Element can opt into light DOM without changing kernel APIs. */
  shadow?: boolean
  /** Whether the compiler found a declarative shadow root before construction. */
  usesDeclarativeRoot?: boolean
  defaults?: Record<string, unknown>
  props?: Record<string, PropSpec>
  attrs?: Record<string, { prop: string; parse(value: string | null): unknown }>
  /** Maps a state source to the keyed selectors that depend on it. */
  keyedSelectors?: Record<string, readonly string[]>
  styles?: LazyStyleSheet
  initState?(kernel: Kernel): void
  mount?(kernel: Kernel): void
  hydrate?(kernel: Kernel): void
  update?(kernel: Kernel, dirty: DirtySources): void
  effects?(kernel: Kernel, dirty: DirtySources): void
  syncFormValue?(kernel: Kernel, dirty: DirtySources): void
  connected?(kernel: Kernel): void
  disconnected?(kernel: Kernel): void
}

export type Kernel = {
  element: HTMLElement
  spec: KernelSpec
  root: HTMLElement | ShadowRoot
  usesDeclarativeRoot: boolean
  mounted: boolean
  dirty: Set<string>
  needsFullUpdate: boolean
  flushScheduled: boolean
  props: Record<string, unknown>
  state: Record<string, unknown>
  /** Component-owned nodes and caches, keyed by compiler-stable field names. */
  nodes: Record<string, unknown>
  refs: Record<string, Element | null>
  computed: Map<string, unknown>
  hostId: string
  lifecycleAbort: AbortController
  updateAbort: AbortController
  pendingUpdateResolvers: Array<(signal: AbortSignal) => void>
  queuedHostTasks: Array<() => void>
  eventAbortControllers: Set<AbortController>
  effectsConnected: boolean
  effectCleanups: Cleanup[]
  stylesAdopted: boolean
  /** Runtime-owned keyed row bindings, indexed by selector/key tokens. */
  keyedBindings: KeyedRegistry
  internals?: ElementInternals
}

type KernelElement = HTMLElement & { [K]?: Kernel }
type StateAccessor<Value> = (() => Value) & {
  set(value: Value): void
  update(updater: (value: Value) => Value): void
}

const metadataKey = Symbol.for("naos.component.metadata")
const keyedBindingsKey = Symbol("naos.keyed.bindings")

type KeyedRecord = {
  [keyedBindingsKey]?: Map<string, string>
}

type KeyedRegistry = Map<string, Map<object, Map<string, () => void>>>

let registrationWarningEmitted = false

/** Creates the complete per-instance state record. */
export function createKernel(element: HTMLElement, spec: KernelSpec): Kernel {
  const existingRoot = element.shadowRoot
  const usesShadowRoot = spec.shadow ?? true
  const root = usesShadowRoot ? (existingRoot ?? element.attachShadow({ mode: "open" })) : element

  return {
    element,
    spec,
    root,
    usesDeclarativeRoot: spec.usesDeclarativeRoot ?? Boolean(existingRoot),
    mounted: false,
    dirty: new Set(),
    needsFullUpdate: true,
    flushScheduled: false,
    props: { ...spec.defaults },
    state: {},
    nodes: {},
    refs: {},
    computed: new Map(),
    hostId: "",
    lifecycleAbort: new AbortController(),
    updateAbort: new AbortController(),
    pendingUpdateResolvers: [],
    queuedHostTasks: [],
    eventAbortControllers: new Set(),
    effectsConnected: false,
    effectCleanups: [],
    stylesAdopted: false,
    keyedBindings: new Map(),
  }
}

/** Defines compiler-described props without adding a base-class API surface. */
export function defineProps(
  elementConstructor: CustomElementConstructor,
  spec: Pick<KernelSpec, "props">,
): void {
  for (const [name, definition] of Object.entries(spec.props ?? {})) {
    Object.defineProperty(elementConstructor.prototype, name, {
      configurable: true,
      get(this: KernelElement) {
        return requiredKernel(this).props[name]
      },
      set(this: KernelElement, value: unknown) {
        setProp(requiredKernel(this), definition.source ?? name, definition, value)
      },
    })
  }
}

/** Applies a public prop write, reflects it where applicable, then flushes. */
export function setProp(kernel: Kernel, name: string, definition: PropSpec, value: unknown): void {
  const nextValue = definition.coerce(value)
  kernel.props[name] = nextValue
  markDirty(kernel, name)

  if (definition.reflect && definition.attribute) {
    reflectProp(kernel.element, definition.attribute, nextValue)
  }

  flushSync(kernel)
}

/** Handles an observed-attribute change using the compiler-emitted table. */
export function attrChanged(
  kernel: Kernel,
  name: string,
  oldValue: string | null,
  newValue: string | null,
): void {
  if (oldValue === newValue) return

  const definition = kernel.spec.attrs?.[name]
  if (!definition) return

  kernel.props[definition.prop] = definition.parse(newValue)
  markDirty(kernel, definition.prop)
  flushSync(kernel)
}

/** Runs the generated mount/hydration callbacks and the first render. */
export function connect(kernel: Kernel): void {
  if (!kernel.stylesAdopted) {
    adoptStyles(kernel)
    kernel.stylesAdopted = true
  }

  if (!kernel.mounted) {
    ensureHostId(kernel)
    kernel.spec.initState?.(kernel)
    if (kernel.usesDeclarativeRoot) {
      kernel.spec.hydrate?.(kernel)
    } else {
      kernel.spec.mount?.(kernel)
    }
    kernel.mounted = true
  } else {
    markAllDirty(kernel)
  }

  kernel.effectsConnected = true
  kernel.spec.connected?.(kernel)
  flushSync(kernel)
}

/** Releases lifecycle-scoped work while preserving DOM for a later reconnect. */
export function disconnect(kernel: Kernel): void {
  kernel.effectsConnected = false
  kernel.flushScheduled = false
  kernel.spec.disconnected?.(kernel)
  abortEventHandlers(kernel)
  kernel.lifecycleAbort.abort()
  abortHostUpdateScope(kernel)
  cleanupEffects(kernel)
  kernel.lifecycleAbort = new AbortController()
}

/** Marks a compiler source as dirty and invalidates computed values. */
export function markDirty(kernel: Kernel, source: string): void {
  kernel.dirty.add(source)
  kernel.computed.clear()
}

/** Forces the next update pass to visit every generated binding. */
export function markAllDirty(kernel: Kernel): void {
  kernel.needsFullUpdate = true
  kernel.dirty.clear()
  kernel.computed.clear()
}

/** Schedules a coalesced microtask flush. */
export function scheduleFlush(kernel: Kernel): void {
  if (kernel.flushScheduled) return

  kernel.flushScheduled = true
  scheduleNaosUpdate(() => {
    if (!kernel.flushScheduled) return
    kernel.flushScheduled = false
    flush(kernel)
  })
}

/** Flushes pending work synchronously, cancelling a scheduled turn if present. */
export function flushSync(kernel: Kernel): void {
  kernel.flushScheduled = false
  flush(kernel)
}

/** Executes the generated update pipeline within one host-update scope. */
export function flush(kernel: Kernel): void {
  if (!kernel.mounted) return

  let flushError: unknown
  let didFail = false
  beginHostUpdateScope(kernel)

  try {
    const dirty = consumeDirtySources(kernel)
    kernel.computed.clear()
    kernel.spec.update?.(kernel, dirty)
    runKeyedBindings(kernel, dirty)
    kernel.spec.syncFormValue?.(kernel, dirty)
    if (kernel.effectsConnected) {
      kernel.spec.effects?.(kernel, dirty)
    }
  } catch (error) {
    flushError = error
    didFail = true
    markAllDirty(kernel)
  } finally {
    finishHostUpdateScope(kernel)
  }

  if (didFail) reportError(kernel, flushError)
}

/** Returns true when a generated guarded binding needs to run. */
export function shouldUpdate(dependencies: readonly string[] | null, dirty: DirtySources): boolean {
  if (dirty === null || dependencies === null) return true
  return dependencies.some((source) => dirty.has(source))
}

/** Returns a state accessor used by compiled `state()` bindings. */
export function stateAccessor<Value>(kernel: Kernel, name: string): StateAccessor<Value> {
  const read = (() => kernel.state[name] as Value) as StateAccessor<Value>

  read.set = (value) => {
    if (Object.is(kernel.state[name], value)) return
    const previousValue = kernel.state[name]
    kernel.state[name] = value
    markDirty(kernel, name)
    markKeyedSelectorsDirty(kernel, name, previousValue, value)
    scheduleFlush(kernel)
  }
  read.update = (updater) => {
    read.set(updater(read()))
  }

  return read
}

/** Returns a cached compiler-generated `computed()` accessor. */
export function computedAccessor<Value>(
  kernel: Kernel,
  name: string,
  compute: () => Value,
): () => Value {
  return () => {
    if (!kernel.computed.has(name)) {
      kernel.computed.set(name, compute())
    }
    return kernel.computed.get(name) as Value
  }
}

/** Creates a compiler-declared Custom Event emitter. */
export function emitter<Detail>(kernel: Kernel, name: string): { emit(detail: Detail): void } {
  return {
    emit(detail) {
      kernel.element.dispatchEvent(createNaosEvent(name, detail))
    },
  }
}

/** Returns the runtime-owned portion of the generated `host()` API. */
export function hostApi(kernel: Kernel): () => {
  id: string
  element: HTMLElement
  root: HTMLElement | ShadowRoot
  props: Record<string, unknown>
  signal: AbortSignal
  update(): Promise<AbortSignal>
  queueTask(task: () => void): void
  flushSync(): void
} {
  return () => ({
    id: kernel.hostId,
    element: kernel.element,
    root: kernel.root,
    props: kernel.props,
    signal: kernel.lifecycleAbort.signal,
    update: () =>
      new Promise((resolve) => {
        kernel.pendingUpdateResolvers.push(resolve)
        markAllDirty(kernel)
        scheduleFlush(kernel)
      }),
    queueTask: (task) => {
      kernel.queuedHostTasks.push(task)
      scheduleFlush(kernel)
    },
    flushSync: () => flushSync(kernel),
  })
}

/** Installs a component listener with an abort signal scoped to its latest run. */
export function listen(
  kernel: Kernel,
  node: EventTarget,
  type: string,
  handler: (event: Event, signal: AbortSignal) => void,
  options?: AddEventListenerOptions | boolean,
): () => void {
  let controller: AbortController | undefined
  const listener = (event: Event) => {
    controller?.abort()
    const nextController = new AbortController()
    controller = nextController
    kernel.eventAbortControllers.add(nextController)
    const signal = nextController.signal
    signal.addEventListener("abort", () => kernel.eventAbortControllers.delete(nextController), {
      once: true,
    })
    handler(event, signal)
  }
  node.addEventListener(type, listener, options)

  return () => {
    controller?.abort()
    node.removeEventListener(
      type,
      listener,
      typeof options === "boolean" ? options : options?.capture,
    )
  }
}

/** Runs one generated effect with cleanup and dependency gating. */
export function runEffect(
  kernel: Kernel,
  index: number,
  dirty: DirtySources,
  dependencies: readonly string[] | null,
  body: () => Cleanup,
): void {
  if (!shouldUpdate(dependencies, dirty)) return
  cleanupEffect(kernel, index)
  const cleanup = body()
  if (typeof cleanup === "function") {
    kernel.effectCleanups[index] = cleanup
  }
}

/** Writes or removes one native attribute using JSX's nullish/falsy semantics. */
export function setAttr(element: Element, name: string, value: unknown, removeFalse = true): void {
  if (value == null || (removeFalse && value === false)) {
    element.removeAttribute(name)
    return
  }
  element.setAttribute(name, String(value))
}

/** Caches one constructable sheet per generated module. */
export function lazySheet(sources: readonly string[]): LazyStyleSheet {
  let sheet: CSSStyleSheet | undefined
  return () => {
    if (!sheet) {
      sheet = new CSSStyleSheet()
      sheet.replaceSync(sources.join("\n"))
    }
    return sheet
  }
}

/** Reorders keyed DOM nodes in the compiler-provided order. */
export function reconcileKeyed(container: Node, nodes: readonly Node[]): void
/** Reconciles keyed records; record construction and patching remain generated. */
export function reconcileKeyed<Item, Key, Record extends { node: Node }>(
  container: Node,
  records: ReadonlyMap<Key, Record>,
  items: readonly Item[],
  keyOf: (item: Item, index: number) => Key,
  build: (item: Item, index: number) => Record,
  patch: (record: Record, item: Item, index: number) => void,
  dispose?: (record: Record) => void,
): Map<Key, Record>
export function reconcileKeyed<Item, Key, Record extends { node: Node }>(
  container: Node,
  recordsOrNodes: ReadonlyMap<Key, Record> | readonly Node[],
  items?: readonly Item[],
  keyOf?: (item: Item, index: number) => Key,
  build?: (item: Item, index: number) => Record,
  patch?: (record: Record, item: Item, index: number) => void,
  dispose?: (record: Record) => void,
): Map<Key, Record> | void {
  if (Array.isArray(recordsOrNodes)) {
    reconcileKeyedNodes(container, recordsOrNodes)
    return
  }

  const records = recordsOrNodes as ReadonlyMap<Key, Record>
  const nextRecords = new Map<Key, Record>()
  const nodes: Node[] = []

  for (let index = 0; index < items!.length; index += 1) {
    const item = items![index]!
    const key = keyOf!(item, index)
    const record = records.get(key) ?? build!(item, index)
    patch!(record, item, index)
    nextRecords.set(key, record)
    nodes.push(record.node)
  }

  reconcileKeyedNodes(container, nodes)

  if (dispose) {
    for (const [key, record] of records) {
      if (!nextRecords.has(key)) dispose(record)
    }
  }
  return nextRecords
}

function reconcileKeyedNodes(container: Node, nodes: readonly Node[]): void {
  let cursor = container.firstChild
  for (const node of nodes) {
    if (cursor === node) {
      cursor = cursor.nextSibling
    } else {
      container.insertBefore(node, cursor)
    }
  }
  while (cursor) {
    const next = cursor.nextSibling
    container.removeChild(cursor)
    cursor = next
  }
}

/** Registers an individual keyed-selector binding for a generated list row. */
export function registerKeyedBinding(
  kernel: Kernel,
  selector: string,
  key: unknown,
  record: object & KeyedRecord,
  bindingName: string,
  update: () => void,
): void {
  const token = keyedSelectorToken(selector, key)
  const bindingsByName = (record[keyedBindingsKey] ??= new Map())
  const previousToken = bindingsByName.get(bindingName)
  if (previousToken && previousToken !== token) {
    unregisterKeyedBindingToken(kernel, previousToken, record, bindingName)
  }

  const registry = keyedRegistry(kernel)
  let records = registry.get(token)
  if (!records) {
    records = new Map()
    registry.set(token, records)
  }
  let bindings = records.get(record)
  if (!bindings) {
    bindings = new Map()
    records.set(record, bindings)
  }
  bindings.set(bindingName, update)
  bindingsByName.set(bindingName, token)
}

/** Removes all keyed-selector registrations owned by a list row record. */
export function unregisterKeyedBindings(kernel: Kernel, record: object & KeyedRecord): void {
  const bindingsByName = record[keyedBindingsKey]
  if (!bindingsByName) return
  for (const [bindingName, token] of bindingsByName) {
    unregisterKeyedBindingToken(kernel, token, record, bindingName)
  }
  bindingsByName.clear()
}

/** Registers a Custom Element with Naos's package/version conflict guard. */
export function defineComponent(
  tagName: string,
  elementConstructor: CustomElementConstructor,
  metadata: ComponentMetadata,
): void {
  Object.defineProperty(elementConstructor, metadataKey, {
    configurable: true,
    value: Object.freeze(metadata),
  })

  const registered = customElements.get(tagName)
  if (!registered) {
    customElements.define(tagName, elementConstructor)
    return
  }
  if (registered === elementConstructor) return

  const registeredMetadata = (
    registered as typeof registered & {
      [metadataKey]?: ComponentMetadata
    }
  )[metadataKey]
  if (
    registeredMetadata?.packageName === metadata.packageName &&
    registeredMetadata?.packageVersion === metadata.packageVersion
  ) {
    return
  }
  if (registrationWarningEmitted) return

  registrationWarningEmitted = true
  const registeredOwner =
    registeredMetadata?.packageName && registeredMetadata.packageVersion
      ? `${registeredMetadata.packageName}@${registeredMetadata.packageVersion}`
      : "unknown"
  const attemptedOwner = metadata.packageVersion
    ? `${metadata.packageName}@${metadata.packageVersion}`
    : `${metadata.packageName}@unknown`
  console.warn(
    `naos-ui: <${metadata.tagName}> is already registered by ${registeredOwner} (attempted: ${attemptedOwner}). Running two versions of the same package on one page is not supported; the first registration wins.`,
  )
}

/** Resets module-scoped duplicate-registration warning state for isolated tests. */
export function resetRegistrationWarningForTesting(): void {
  registrationWarningEmitted = false
}

function requiredKernel(element: KernelElement): Kernel {
  const kernel = element[K]
  if (!kernel) {
    throw new Error("Naos property accessed before its kernel was created.")
  }
  return kernel
}

function reflectProp(element: HTMLElement, name: string, value: unknown): void {
  if (typeof value === "boolean") {
    if (value) element.setAttribute(name, "")
    else element.removeAttribute(name)
    return
  }
  const next = String(value)
  if (element.getAttribute(name) !== next) element.setAttribute(name, next)
}

function adoptStyles(kernel: Kernel): void {
  const styles = kernel.spec.styles
  if (!styles) return
  const sheet = styles()
  if (kernel.root instanceof ShadowRoot) {
    kernel.root.adoptedStyleSheets = [sheet]
    return
  }

  const root = kernel.element.getRootNode()
  if ("adoptedStyleSheets" in root) {
    const styleRoot = root as Document | ShadowRoot
    if (!styleRoot.adoptedStyleSheets.includes(sheet)) {
      // A light-DOM sheet belongs to the document/shadow root, not one element;
      // retain it so reconnecting or unmounting one instance cannot affect peers.
      styleRoot.adoptedStyleSheets = [...styleRoot.adoptedStyleSheets, sheet]
    }
  }
}

function consumeDirtySources(kernel: Kernel): DirtySources {
  if (kernel.needsFullUpdate) {
    kernel.needsFullUpdate = false
    kernel.dirty.clear()
    return null
  }
  const dirty = kernel.dirty
  kernel.dirty = new Set()
  return dirty
}

function beginHostUpdateScope(kernel: Kernel): void {
  kernel.updateAbort.abort()
  kernel.updateAbort = new AbortController()
}

function finishHostUpdateScope(kernel: Kernel): void {
  const signal = kernel.updateAbort.signal
  const resolvers = kernel.pendingUpdateResolvers
  kernel.pendingUpdateResolvers = []
  for (const resolve of resolvers) resolve(signal)

  const tasks = kernel.queuedHostTasks
  kernel.queuedHostTasks = []
  for (const task of tasks) {
    try {
      task()
    } catch (error) {
      reportError(kernel, error)
    }
  }
}

function abortHostUpdateScope(kernel: Kernel): void {
  kernel.updateAbort.abort()
  const signal = kernel.updateAbort.signal
  const resolvers = kernel.pendingUpdateResolvers
  kernel.pendingUpdateResolvers = []
  for (const resolve of resolvers) resolve(signal)
  kernel.queuedHostTasks = []
  kernel.updateAbort = new AbortController()
}

function abortEventHandlers(kernel: Kernel): void {
  for (const controller of Array.from(kernel.eventAbortControllers)) controller.abort()
  kernel.eventAbortControllers.clear()
}

function cleanupEffects(kernel: Kernel): void {
  for (let index = 0; index < kernel.effectCleanups.length; index += 1) {
    cleanupEffect(kernel, index)
  }
}

function cleanupEffect(kernel: Kernel, index: number): void {
  const cleanup = kernel.effectCleanups[index]
  if (typeof cleanup === "function") cleanup()
  kernel.effectCleanups[index] = undefined
}

export function reportError(kernel: Kernel, error: unknown): void {
  kernel.element.dispatchEvent(createNaosEvent("naos-error", { error }))
  const reporter = globalThis.reportError
  if (typeof reporter === "function") {
    reporter.call(globalThis, error)
    return
  }
  setTimeout(() => {
    throw error
  }, 0)
}

export function ensureHostId(kernel: Kernel): void {
  if (kernel.hostId) return
  if (kernel.element.id) {
    kernel.hostId = kernel.element.id
    return
  }
  const root = kernel.element.getRootNode()
  const siblings =
    typeof (root as ParentNode).querySelectorAll === "function"
      ? Array.from((root as ParentNode).querySelectorAll(kernel.element.localName))
      : []
  const index = siblings.indexOf(kernel.element)
  kernel.hostId = `${kernel.element.localName}-${index < 0 ? 1 : index + 1}`
}

function markKeyedSelectorsDirty(
  kernel: Kernel,
  source: string,
  previousValue: unknown,
  nextValue: unknown,
): void {
  if (Object.is(previousValue, nextValue)) return
  const selectors = kernel.spec.keyedSelectors?.[source]
  if (!selectors || kernel.keyedBindings.size === 0) return
  for (const selector of selectors) {
    kernel.dirty.add(keyedSelectorToken(selector, previousValue))
    kernel.dirty.add(keyedSelectorToken(selector, nextValue))
  }
}

function keyedSelectorToken(selector: string, key: unknown): string {
  const type = key === null ? "null" : typeof key
  return `@naos-ui:keyed:${selector}:${type}:${String(key)}`
}

function keyedRegistry(kernel: Kernel): KeyedRegistry {
  return kernel.keyedBindings
}

function unregisterKeyedBindingToken(
  kernel: Kernel,
  token: string,
  record: object,
  bindingName: string,
): void {
  const records = keyedRegistry(kernel).get(token)
  if (!records) return
  const bindings = records.get(record)
  if (!bindings) return
  bindings.delete(bindingName)
  if (bindings.size === 0) records.delete(record)
  if (records.size === 0) keyedRegistry(kernel).delete(token)
}

function runKeyedBindings(kernel: Kernel, dirty: DirtySources): void {
  if (dirty === null) return
  const registry = keyedRegistry(kernel)
  for (const source of dirty) {
    const records = registry.get(source)
    if (!records) continue
    for (const bindings of Array.from(records.values())) {
      for (const update of Array.from(bindings.values())) update()
    }
  }
}
