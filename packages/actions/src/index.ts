export type NaosActionContext = {
  readonly signal: AbortSignal
}

export type NaosActionReducer<State, Payload> = (
  previousState: State,
  payload: Payload,
  context: NaosActionContext
) => State | Promise<State>

export type NaosActionOptions<State> = {
  /** Called after every settled submission with the resulting state or error. */
  onSettled?(result: { readonly error?: unknown; readonly state: State }): void
}

export type NaosActionSnapshot<State> = {
  readonly data: State
  readonly error: unknown
  readonly pending: boolean
  readonly state: State
}

export type NaosAction<State, Payload = void> = {
  /** Latest committed state (initial state until a submission succeeds). */
  state(): State
  /** Alias for `state()`; mirrors the resource `data` naming. */
  data(): State
  /** Whether a submission is currently running or queued. */
  pending(): boolean
  /** Error thrown by the most recent settled submission, or `undefined`. */
  error(): unknown
  /**
   * Runs the reducer with the payload. Submissions execute sequentially: a
   * submit during a running submission queues behind it and receives the
   * committed state of its predecessor. Rejections settle the returned
   * promise and are also reported through `error()`.
   */
  submit(payload: Payload): Promise<State>
  /** Aborts in-flight work, clears the queue, and restores the initial state. */
  reset(): void
  /** Subscribes to snapshot changes; returns the unsubscribe callback. */
  subscribe(listener: () => void): () => void
  /** Permanently aborts in-flight work and detaches all subscribers. */
  dispose(): void
}

export type NaosFormAction<State> = NaosAction<State, FormData> & {
  /**
   * Enhances a native form: submissions that pass native constraint
   * validation are prevented and routed through the action with
   * `new FormData(form, submitter)`. Returns the cleanup callback.
   */
  enhance(form: HTMLFormElement): () => void
}

const FORM_ACTION_BRAND = Symbol.for("naos.form.action")

class ActionRuntime<State, Payload> {
  #abortController: AbortController | null = null
  #data: State
  #disposed = false
  #error: unknown = undefined
  #initialState: State
  #listeners = new Set<() => void>()
  #options: NaosActionOptions<State>
  #pendingCount = 0
  #queue: Promise<unknown> = Promise.resolve()
  #reducer: NaosActionReducer<State, Payload>
  #resetGeneration = 0

  constructor(
    reducer: NaosActionReducer<State, Payload>,
    initialState: State,
    options: NaosActionOptions<State>
  ) {
    this.#reducer = reducer
    this.#initialState = initialState
    this.#data = initialState
    this.#options = options
  }

  state(): State {
    return this.#data
  }

  pending(): boolean {
    return this.#pendingCount > 0
  }

  error(): unknown {
    return this.#error
  }

  submit(payload: Payload): Promise<State> {
    if (this.#disposed) {
      return Promise.reject(new Error("Cannot submit to a disposed action."))
    }
    const generation = this.#resetGeneration
    this.#pendingCount += 1
    this.#notify()

    const run = this.#queue.then(async () => {
      if (this.#disposed || generation !== this.#resetGeneration) {
        throw new DOMException("The action submission was aborted.", "AbortError")
      }
      const controller = new AbortController()
      this.#abortController = controller
      try {
        const nextState = await this.#reducer(this.#data, payload, {
          signal: controller.signal,
        })
        if (controller.signal.aborted) {
          throw new DOMException("The action submission was aborted.", "AbortError")
        }
        this.#data = nextState
        this.#error = undefined
        this.#options.onSettled?.({ state: nextState })
        return nextState
      } catch (error) {
        if (!this.#disposed && generation === this.#resetGeneration) {
          this.#error = error
          this.#options.onSettled?.({ error, state: this.#data })
        }
        throw error
      } finally {
        if (this.#abortController === controller) {
          this.#abortController = null
        }
        this.#pendingCount -= 1
        this.#notify()
      }
    })
    // Sequential execution: the queue advances regardless of the outcome.
    this.#queue = run.catch(() => {})
    return run
  }

  reset(): void {
    this.#resetGeneration += 1
    this.#abortController?.abort()
    this.#abortController = null
    this.#queue = Promise.resolve()
    this.#data = this.#initialState
    this.#error = undefined
    this.#notify()
  }

  subscribe(listener: () => void): () => void {
    if (this.#disposed) return () => {}
    this.#listeners.add(listener)
    return () => {
      this.#listeners.delete(listener)
    }
  }

  dispose(): void {
    if (this.#disposed) return
    this.#disposed = true
    this.#abortController?.abort()
    this.#abortController = null
    this.#listeners.clear()
  }

  #notify(): void {
    for (const listener of this.#listeners) {
      listener()
    }
  }
}

export function action<State, Payload = void>(
  reducer: NaosActionReducer<State, Payload>,
  initialState: State,
  options: NaosActionOptions<State> = {}
): NaosAction<State, Payload> {
  const runtime = new ActionRuntime(reducer, initialState, options)
  return {
    data: () => runtime.state(),
    dispose: () => runtime.dispose(),
    error: () => runtime.error(),
    pending: () => runtime.pending(),
    reset: () => runtime.reset(),
    state: () => runtime.state(),
    submit: (payload) => runtime.submit(payload),
    subscribe: (listener) => runtime.subscribe(listener),
  }
}

export function formAction<State>(
  reducer: NaosActionReducer<State, FormData>,
  initialState: State,
  options: NaosActionOptions<State> = {}
): NaosFormAction<State> {
  const base = action<State, FormData>(reducer, initialState, options)
  const cleanups = new Set<() => void>()
  const enhanced: NaosFormAction<State> = {
    ...base,
    dispose: () => {
      for (const cleanup of cleanups) cleanup()
      base.dispose()
    },
    enhance: (form) => {
      const onSubmit = (event: Event) => {
        // Native constraint validation stays authoritative: invalid forms
        // fall through to the browser's reporting without reaching the
        // reducer.
        if (event.defaultPrevented || !form.checkValidity()) return
        event.preventDefault()
        const submitter =
          typeof SubmitEvent !== "undefined" &&
          event instanceof SubmitEvent &&
          event.submitter instanceof HTMLElement
            ? event.submitter
            : undefined
        let formData: FormData
        try {
          formData = submitter ? new FormData(form, submitter) : new FormData(form)
        } catch {
          formData = new FormData(form)
        }
        // Submission failures are reported through error(); the listener
        // must not produce unhandled rejections.
        void enhanced.submit(formData).catch(() => {})
      }
      form.addEventListener("submit", onSubmit)
      const cleanup = () => {
        form.removeEventListener("submit", onSubmit)
        cleanups.delete(cleanup)
      }
      cleanups.add(cleanup)
      return cleanup
    },
  }
  Object.defineProperty(enhanced, FORM_ACTION_BRAND, { value: true })
  return enhanced
}

/**
 * Whether a value is a Naos form action (brand-checked via
 * `Symbol.for("naos.form.action")`, so compiled components can detect
 * actions without importing this package).
 */
export function isNaosFormAction(value: unknown): value is NaosFormAction<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Record<PropertyKey, unknown>)[FORM_ACTION_BRAND] === true
  )
}

export type NaosActionBinding<State> = (snapshot: NaosActionSnapshot<State>) => void

/**
 * Subscribes to an action, delivers the current snapshot immediately, and
 * returns the unsubscribe cleanup. Inside a Naos `effect()` this follows the
 * element's connect/disconnect lifecycle automatically.
 */
export function bindAction<State, Payload>(
  actionObject: NaosAction<State, Payload>,
  onChange: NaosActionBinding<State>
): () => void {
  const notify = () =>
    onChange({
      data: actionObject.data(),
      error: actionObject.error(),
      pending: actionObject.pending(),
      state: actionObject.state(),
    })
  const unsubscribe = actionObject.subscribe(notify)
  notify()
  return () => unsubscribe()
}
