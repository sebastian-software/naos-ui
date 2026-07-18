import { scheduleNaosUpdate } from "@naos-ui/runtime"

export type NaosMountOptions = {
  /** Initial attribute values applied before the element upgrades. */
  attrs?: Record<string, string>
  /** Host container the element is appended to. Defaults to a fresh `<div>` in `document.body`. */
  container?: Element
  /** Initial property values assigned before the element is connected. */
  props?: Record<string, unknown>
}

export type NaosEventCapture<Detail = unknown> = {
  /** Captured events in dispatch order. */
  readonly events: readonly CustomEvent<Detail>[]
  /** Captured event details in dispatch order. */
  readonly details: readonly Detail[]
  /** Number of captured events. */
  readonly count: number
  /** Most recently captured event, when any. */
  readonly last: CustomEvent<Detail> | undefined
  /** Forgets captured events without removing the listener. */
  clear(): void
  /** Removes the listener. Called automatically on unmount. */
  dispose(): void
}

export type NaosMountedComponent<Host extends HTMLElement = HTMLElement> = {
  /** The mounted element. */
  readonly element: Host
  /** The container the element was appended to. */
  readonly container: Element
  /** The element's shadow root. Throws for light-DOM components. */
  shadow(): ShadowRoot
  /** Queries the shadow root when present, the element subtree otherwise. */
  query<Result extends Element = Element>(selector: string): Result | null
  /** Queries all matches in the shadow root when present, the element subtree otherwise. */
  queryAll<Result extends Element = Element>(selector: string): Result[]
  /** Finds the first element exposing the named part, piercing nested shadow roots. */
  queryPart<Result extends Element = Element>(name: string): Result | null
  /** Captures typed CustomEvents dispatched by the element. */
  capture<Detail = unknown>(name: string): NaosEventCapture<Detail>
  /** Assigns properties and awaits the runtime flush. */
  setProps(props: Record<string, unknown>): Promise<void>
  /** Sets (or removes with `null`) attributes and awaits the runtime flush. */
  setAttrs(attrs: Record<string, string | null>): Promise<void>
  /** Removes the element, disposes captures, and removes an owned container. */
  unmount(): void
}

/**
 * Waits for exactly one turn of the Naos runtime scheduler, the same
 * microtask channel `scheduleNaosUpdate` uses for component updates.
 */
export function nextTick(): Promise<void> {
  return new Promise((resolve) => {
    scheduleNaosUpdate(resolve)
  })
}

const DEFAULT_FLUSH_TURNS = 10

/**
 * Drains pending Naos updates by awaiting several scheduler turns, so
 * cascaded updates (state writes scheduled from effects) settle too.
 */
export async function flush(turns = DEFAULT_FLUSH_TURNS): Promise<void> {
  for (let turn = 0; turn < turns; turn += 1) {
    await nextTick()
  }
}

export async function mount<TagName extends keyof HTMLElementTagNameMap>(
  tag: TagName,
  options?: NaosMountOptions
): Promise<NaosMountedComponent<HTMLElementTagNameMap[TagName]>>
export async function mount<Host extends HTMLElement>(
  element: Host,
  options?: NaosMountOptions
): Promise<NaosMountedComponent<Host>>
export async function mount(
  tagOrElement: string | HTMLElement,
  options?: NaosMountOptions
): Promise<NaosMountedComponent>
export async function mount(
  tagOrElement: string | HTMLElement,
  options: NaosMountOptions = {}
): Promise<NaosMountedComponent> {
  const element =
    typeof tagOrElement === "string"
      ? document.createElement(tagOrElement)
      : tagOrElement
  const ownsContainer = options.container === undefined
  const container = options.container ?? document.createElement("div")
  if (ownsContainer) {
    document.body.append(container)
  }

  for (const [name, value] of Object.entries(options.attrs ?? {})) {
    element.setAttribute(name, value)
  }
  assignProps(element, options.props ?? {})

  container.append(element)
  await flush()

  const captures = new Set<NaosEventCapture<unknown>>()

  return {
    container,
    element,
    capture<Detail>(name: string) {
      const capture = captureEvents<Detail>(element, name)
      captures.add(capture as NaosEventCapture<unknown>)
      return capture
    },
    query(selector) {
      return queryRoot(element).querySelector(selector)
    },
    queryAll(selector) {
      return [...queryRoot(element).querySelectorAll(selector)] as never
    },
    queryPart(name) {
      return queryPart(element, name)
    },
    async setAttrs(attrs) {
      for (const [name, value] of Object.entries(attrs)) {
        if (value === null) {
          element.removeAttribute(name)
        } else {
          element.setAttribute(name, value)
        }
      }
      await flush()
    },
    async setProps(props) {
      assignProps(element, props)
      await flush()
    },
    shadow() {
      if (!element.shadowRoot) {
        throw new Error(
          `Element <${element.tagName.toLowerCase()}> has no shadow root.`
        )
      }
      return element.shadowRoot
    },
    unmount() {
      for (const capture of captures) {
        capture.dispose()
      }
      captures.clear()
      element.remove()
      if (ownsContainer) {
        container.remove()
      }
    },
  }
}

/**
 * Captures typed CustomEvents dispatched by any target. Prefer the mounted
 * component's `capture()` helper, which disposes automatically on unmount.
 */
export function captureEvents<Detail = unknown>(
  target: EventTarget,
  name: string
): NaosEventCapture<Detail> {
  const events: CustomEvent<Detail>[] = []
  const listener = (event: Event) => {
    events.push(event as CustomEvent<Detail>)
  }
  target.addEventListener(name, listener)

  return {
    get count() {
      return events.length
    },
    get details() {
      return events.map((event) => event.detail)
    },
    get events() {
      return [...events]
    },
    get last() {
      return events.at(-1)
    },
    clear() {
      events.length = 0
    },
    dispose() {
      target.removeEventListener(name, listener)
    },
  }
}

function assignProps(element: HTMLElement, props: Record<string, unknown>): void {
  for (const [name, value] of Object.entries(props)) {
    ;(element as unknown as Record<string, unknown>)[name] = value
  }
}

function queryRoot(element: HTMLElement): ShadowRoot | HTMLElement {
  return element.shadowRoot ?? element
}

function queryPart<Result extends Element = Element>(
  element: Element,
  name: string
): Result | null {
  const root = element.shadowRoot ?? element
  const direct = root.querySelector(`[part~="${name}"]`)
  if (direct) {
    return direct as Result
  }

  for (const child of root.querySelectorAll("*")) {
    if (child.shadowRoot) {
      const nested = queryPart<Result>(child, name)
      if (nested) {
        return nested
      }
    }
  }
  return null
}
