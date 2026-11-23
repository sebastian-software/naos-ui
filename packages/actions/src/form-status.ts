export type NaosFormStatus = {
  readonly pending: boolean
}

type StatusSource = {
  pending(): boolean
  subscribe(listener: () => void): () => void
}

type FormStatusEntry = {
  sources: Set<StatusSource>
  associations: Set<() => void>
}

const statusEntries = new WeakMap<HTMLFormElement, FormStatusEntry>()
const probes = new WeakMap<Event, HTMLFormElement | null>()
const probeType = "naos:form-status-request"
const idleStatus = Object.freeze({ pending: false })
const pendingStatus = Object.freeze({ pending: true })

function isForm(node: unknown): node is HTMLFormElement {
  return (
    node !== null &&
    typeof node === "object" &&
    "nodeType" in node &&
    node.nodeType === 1 &&
    "localName" in node &&
    node.localName === "form" &&
    "namespaceURI" in node &&
    node.namespaceURI === "http://www.w3.org/1999/xhtml"
  )
}

function handleStatusProbe(event: Event): void {
  if (!probes.has(event)) return
  const form = event.composedPath().find(isForm)
  if (form === event.currentTarget) {
    probes.set(event, form)
    event.stopPropagation()
  }
}

function associatedForm(from: Element): HTMLFormElement | null {
  if (from.matches("button, fieldset, input, object, output, select, textarea") && "form" in from) {
    if (isForm(from.form)) return from.form
    if (from.hasAttribute("form")) return null
  }

  let node: Node | null = from
  while (node && !isForm(node)) {
    if (node.nodeType === 1 && (node as Element).assignedSlot) {
      node = (node as Element).assignedSlot
    } else if (node.nodeType === 11 && "host" in node) {
      node = (node as ShadowRoot).host
    } else {
      node = node.parentNode
    }
  }

  const boundary = node as HTMLFormElement | null
  if (boundary === from) return boundary

  // A slot in a closed root can hide a nearer form from the DOM walk.
  // The composed path reaches that form. Stop at the nearest known form
  // even when it is native, so no outer action can claim this request.
  const event = new Event(probeType, { bubbles: true, composed: true })
  const stopAtBoundary = (incoming: Event) => {
    if (incoming === event) incoming.stopPropagation()
  }
  probes.set(event, null)
  boundary?.addEventListener(probeType, stopAtBoundary)
  try {
    from.dispatchEvent(event)
    return probes.get(event) ?? boundary
  } finally {
    boundary?.removeEventListener(probeType, stopAtBoundary)
    probes.delete(event)
  }
}

function entryFor(form: HTMLFormElement): FormStatusEntry {
  let entry = statusEntries.get(form)
  if (!entry) {
    entry = { sources: new Set(), associations: new Set() }
    statusEntries.set(form, entry)
  }
  return entry
}

export function registerFormStatus(form: HTMLFormElement, action: StatusSource): () => void {
  const entry = entryFor(form)
  const source = { pending: action.pending, subscribe: action.subscribe }
  if (entry.sources.size === 0) form.addEventListener(probeType, handleStatusProbe)
  entry.sources.add(source)
  for (const notify of Array.from(entry.associations)) notify()

  return () => {
    if (!entry.sources.delete(source)) return
    if (entry.sources.size === 0) form.removeEventListener(probeType, handleStatusProbe)
    for (const notify of Array.from(entry.associations)) notify()
  }
}

function readStatus(source: StatusSource | undefined): NaosFormStatus | null {
  if (!source) return null
  return source.pending() ? pendingStatus : idleStatus
}

/** Reads pending status for the associated enhanced form, or null if absent. */
export function getFormStatus(from: Element): NaosFormStatus | null {
  const form = associatedForm(from)
  return form ? readStatus(statusEntries.get(form)?.sources.values().next().value) : null
}

/**
 * Delivers the current status immediately and subscribes to updates on the
 * associated form. Clean up on disconnect and rebind when form ownership
 * changes, including after a move, slot reassignment, or form attribute change.
 */
export function bindFormStatus(
  from: Element,
  onChange: (status: NaosFormStatus | null) => void,
): () => void {
  const form = associatedForm(from)
  if (!form) {
    onChange(null)
    return () => {}
  }

  const entry = entryFor(form)
  let source: StatusSource | undefined
  let unsubscribe: (() => void) | undefined
  let status: NaosFormStatus | null | undefined
  const notify = () => {
    const next = readStatus(source)
    if (status === next) return
    status = next
    onChange(next)
  }
  const updateSource = () => {
    const next = entry.sources.values().next().value
    if (source !== next) {
      unsubscribe?.()
      source = next
      unsubscribe = source?.subscribe(notify)
    }
    notify()
  }
  entry.associations.add(updateSource)
  updateSource()
  return () => {
    entry.associations.delete(updateSource)
    unsubscribe?.()
    unsubscribe = undefined
  }
}
