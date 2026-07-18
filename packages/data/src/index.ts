export type NaosDisabledResourceKey = null | undefined | false

export type NaosEnabledResourceKey = string | readonly unknown[] | Record<string, unknown>

export type NaosResourceKey = NaosEnabledResourceKey | NaosDisabledResourceKey

export type NaosNormalizedResourceKey<Key extends NaosResourceKey = NaosResourceKey> =
  | {
      readonly disabled: true
      readonly argument: Key
      readonly key: undefined
    }
  | {
      readonly disabled: false
      readonly argument: Exclude<Key, NaosDisabledResourceKey>
      readonly key: string
    }

export type NaosResourceState<Data, Error = unknown> =
  | {
      readonly status: "pending"
      readonly data?: Data
      readonly error?: undefined
      readonly stale?: boolean
      readonly fetching?: boolean
    }
  | {
      readonly status: "success"
      readonly data: Data
      readonly error?: undefined
      readonly stale?: boolean
      readonly fetching?: boolean
    }
  | {
      readonly status: "error"
      readonly data?: Data
      readonly error: Error
      readonly stale?: boolean
      readonly fetching?: boolean
    }

export type NaosResourceMutateOptions<Data, MutationData = Data> = {
  optimisticData?: Data | ((current: Data | undefined) => Data)
  populateCache?: boolean | ((result: MutationData, current: Data | undefined) => Data)
  revalidate?: boolean
  rollbackOnError?: boolean | ((error: unknown) => boolean)
}

export type NaosResource<Data, Error = unknown> = {
  readonly key: string | undefined
  snapshot(): NaosResourceState<Data, Error>
  subscribe(callback: () => void): () => void
  refetch?(): Promise<Data>
  mutate?<MutationData = Data>(
    next:
      | MutationData
      | Promise<MutationData>
      | ((current: Data | undefined) => MutationData | Promise<MutationData>),
    options?: NaosResourceMutateOptions<Data, MutationData>
  ): Promise<MutationData | undefined>
  dispose(): void
}

export type NaosResourceFetchContext = {
  readonly signal: AbortSignal
}

export type NaosResourceRetryOptions = {
  /** Number of retries after the initial failed attempt. Defaults to 0. */
  attempts?: number
  /** Delay before each retry in milliseconds, or a function of the 1-based attempt. */
  delay?: number | ((attempt: number) => number)
}

export type NaosResourceFetchOptions<Data> = {
  initialData?: Data
  revalidateIfStale?: boolean
  retry?: NaosResourceRetryOptions
}

export type NaosFetchResourceOptions<Data> = NaosResourceFetchOptions<Data> & {
  cache?: NaosResourceCache
  /**
   * Lazy resources start their first fetch on first `subscribe()` (or an
   * explicit `refetch()`). Pass `false` to fetch eagerly at creation.
   * Defaults to `true`.
   */
  lazy?: boolean
}

export type NaosResourceFetcher<Data, Key extends NaosEnabledResourceKey> = (
  key: Key,
  context: NaosResourceFetchContext
) => Data | Promise<Data>

export type NaosResourceSubscriptionNext<Data, Error = unknown> = (
  error: Error | null | undefined,
  data?: Data | ((current: Data | undefined) => Data)
) => void

export type NaosResourceSubscriptionContext<Data, Error = unknown> = {
  readonly next: NaosResourceSubscriptionNext<Data, Error>
  readonly signal: AbortSignal
}

export type NaosResourceSubscriber<Data, Key extends NaosEnabledResourceKey, Error = unknown> = (
  key: Key,
  context: NaosResourceSubscriptionContext<Data, Error>
) => () => void

export type NaosResourceCacheOptions = {
  /**
   * How long (in milliseconds) an idle cache entry — one with no listeners, no
   * in-flight fetch, and no active subscription — stays cached before it is
   * evicted. `0` evicts immediately, `Number.POSITIVE_INFINITY` never evicts.
   * Defaults to five minutes.
   */
  keepAlive?: number
}

const defaultKeepAlive = 300_000

type CacheEntry<Data, Error> = {
  state: NaosResourceState<Data, Error>
  listeners: Set<() => void>
  retains: number
  evictionTimer?: ReturnType<typeof setTimeout>
}

type InflightFetch<Data> = {
  controller: AbortController
  promise: Promise<Data>
  references: number
}

type ActiveSubscription = {
  controller: AbortController
  dispose: () => void
  references: number
}

export class NaosResourceCache {
  readonly #entries = new Map<string, CacheEntry<unknown, unknown>>()
  readonly #fetches = new Map<string, InflightFetch<unknown>>()
  readonly #subscriptions = new Map<string, ActiveSubscription>()
  readonly #keepAlive: number

  constructor(options: NaosResourceCacheOptions = {}) {
    const keepAlive = options.keepAlive ?? defaultKeepAlive
    this.#keepAlive = Number.isNaN(keepAlive) ? defaultKeepAlive : Math.max(0, keepAlive)
  }

  snapshot<Data, Error = unknown>(key: string | undefined): NaosResourceState<Data, Error> {
    if (key === undefined) {
      return { status: "pending" }
    }

    return (this.#entries.get(key)?.state as NaosResourceState<Data, Error> | undefined) ?? { status: "pending" }
  }

  set<Data, Error = unknown>(key: string, state: NaosResourceState<Data, Error>): void {
    const entry = this.#entry<Data, Error>(key)
    entry.state = state
    for (const listener of entry.listeners) {
      listener()
    }
  }

  subscribe(key: string | undefined, callback: () => void): () => void {
    if (key === undefined) {
      return () => {}
    }

    const entry = this.#entry(key)
    entry.listeners.add(callback)
    return () => {
      entry.listeners.delete(callback)
      if (entry.listeners.size === 0) {
        this.#scheduleEviction(key)
      }
    }
  }

  retain(key: string | undefined): () => void {
    if (key === undefined) {
      return () => {}
    }

    const entry = this.#entry(key)
    entry.retains += 1
    let released = false
    return () => {
      if (released) {
        return
      }
      released = true
      entry.retains -= 1
      this.#scheduleEviction(key)
    }
  }

  delete(key: string): void {
    this.#abortFetch(key)
    this.#abortSubscription(key)

    const entry = this.#entries.get(key)
    if (!entry) {
      return
    }

    this.#cancelEviction(entry)
    if (entry.listeners.size === 0 && entry.retains === 0) {
      this.#entries.delete(key)
      return
    }

    entry.state = { status: "pending" }
    for (const listener of entry.listeners) {
      listener()
    }
  }

  clear(): void {
    const keys = new Set([...this.#entries.keys(), ...this.#fetches.keys(), ...this.#subscriptions.keys()])
    for (const key of keys) {
      this.delete(key)
    }
  }

  mutate<Data, MutationData = Data>(
    key: string,
    next:
      | MutationData
      | Promise<MutationData>
      | ((current: Data | undefined) => MutationData | Promise<MutationData>),
    options: NaosResourceMutateOptions<Data, MutationData> = {}
  ): Promise<MutationData | undefined> {
    const previous = this.snapshot<Data>(key)
    const current = stateData(previous)
    const rollbackOnError = options.rollbackOnError ?? true

    if (options.optimisticData !== undefined) {
      const optimistic =
        typeof options.optimisticData === "function"
          ? (options.optimisticData as (current: Data | undefined) => Data)(current)
          : options.optimisticData
      this.set(key, { data: optimistic, status: "success" })
    }

    return Promise.resolve(typeof next === "function" ? (next as (current: Data | undefined) => MutationData)(current) : next)
      .then((result) => {
        if (options.populateCache !== false) {
          const latest = stateData(this.snapshot<Data>(key))
          const data =
            typeof options.populateCache === "function"
              ? options.populateCache(result, latest)
              : (result as unknown as Data)
          this.set(key, { data, status: "success" })
        }
        return result
      })
      .catch((error: unknown) => {
        const shouldRollback =
          typeof rollbackOnError === "function" ? rollbackOnError(error) : rollbackOnError
        if (shouldRollback) {
          this.set(key, previous)
        }
        throw error
      })
  }

  startFetch<Data, Error, Key extends NaosEnabledResourceKey>(
    key: string,
    argument: Key,
    fetcher: NaosResourceFetcher<Data, Key>,
    options: NaosResourceFetchOptions<Data> = {}
  ): { promise: Promise<Data>; release: () => void } {
    const previous = this.snapshot<Data, Error>(key)
    if (previous.status === "success" && options.revalidateIfStale === false) {
      return {
        promise: Promise.resolve(previous.data),
        release: () => this.#scheduleEviction(key),
      }
    }

    const existing = this.#fetches.get(key) as InflightFetch<Data> | undefined
    if (existing) {
      existing.references += 1
      return {
        promise: existing.promise,
        release: () => this.#releaseFetch(key),
      }
    }

    const previousData = stateData(previous)
    const initialData = previousData ?? options.initialData
    if (initialData !== undefined) {
      this.set<Data, Error>(key, { data: initialData, fetching: true, stale: true, status: "success" })
    } else {
      this.set<Data, Error>(key, { fetching: true, status: "pending" })
    }

    const controller = new AbortController()
    const promise = runFetchWithRetry(fetcher, argument, controller.signal, options.retry)
      .then((data) => {
        if (!controller.signal.aborted) {
          this.set<Data, Error>(key, { data, status: "success" })
        }
        return data
      })
      .catch((error: Error) => {
        if (!controller.signal.aborted) {
          const data = stateData(this.snapshot<Data, Error>(key))
          this.set<Data, Error>(key, data === undefined ? { error, status: "error" } : { data, error, status: "error" })
        }
        throw error
      })
      .finally(() => {
        this.#fetches.delete(key)
      })

    promise.catch(() => {})
    this.#fetches.set(key, { controller, promise, references: 1 })
    return {
      promise,
      release: () => this.#releaseFetch(key),
    }
  }

  attachSubscription<Data, Error, Key extends NaosEnabledResourceKey>(
    key: string,
    argument: Key,
    subscriber: NaosResourceSubscriber<Data, Key, Error>
  ): () => void {
    const existing = this.#subscriptions.get(key)
    if (existing) {
      existing.references += 1
      return () => this.#releaseSubscription(key)
    }

    const controller = new AbortController()
    const next: NaosResourceSubscriptionNext<Data, Error> = (error, data) => {
      if (controller.signal.aborted) {
        return
      }

      if (error !== null && error !== undefined) {
        const previousData = stateData(this.snapshot<Data, Error>(key))
        this.set<Data, Error>(
          key,
          previousData === undefined ? { error, status: "error" } : { data: previousData, error, status: "error" }
        )
        return
      }

      if (typeof data === "function") {
        const previousData = stateData(this.snapshot<Data, Error>(key))
        this.set<Data, Error>(key, {
          data: (data as (current: Data | undefined) => Data)(previousData),
          status: "success",
        })
        return
      }

      if (data !== undefined) {
        this.set<Data, Error>(key, { data, status: "success" })
      }
    }

    const dispose = subscriber(argument, { next, signal: controller.signal })
    this.#subscriptions.set(key, { controller, dispose, references: 1 })
    return () => this.#releaseSubscription(key)
  }

  #entry<Data, Error = unknown>(key: string): CacheEntry<Data, Error> {
    let entry = this.#entries.get(key)
    if (!entry) {
      entry = { listeners: new Set(), retains: 0, state: { status: "pending" } }
      this.#entries.set(key, entry)
    }
    this.#cancelEviction(entry)
    return entry as CacheEntry<Data, Error>
  }

  #releaseFetch(key: string): void {
    const fetch = this.#fetches.get(key)
    if (fetch) {
      fetch.references -= 1
      if (fetch.references > 0) {
        return
      }
      this.#abortFetch(key)
    }
    this.#scheduleEviction(key)
  }

  #releaseSubscription(key: string): void {
    const subscription = this.#subscriptions.get(key)
    if (subscription) {
      subscription.references -= 1
      if (subscription.references > 0) {
        return
      }
      this.#abortSubscription(key)
    }
    this.#scheduleEviction(key)
  }

  #abortFetch(key: string): void {
    const fetch = this.#fetches.get(key)
    if (!fetch) {
      return
    }
    this.#fetches.delete(key)
    fetch.controller.abort()

    // The aborted fetch will never write a settled state, so drop the
    // in-flight marker for listeners that outlive the fetch handle.
    const entry = this.#entries.get(key)
    if (entry?.state.fetching) {
      const { fetching: _fetching, ...rest } = entry.state
      this.set(key, rest as NaosResourceState<unknown, unknown>)
    }
  }

  #abortSubscription(key: string): void {
    const subscription = this.#subscriptions.get(key)
    if (!subscription) {
      return
    }
    this.#subscriptions.delete(key)
    subscription.controller.abort()
    subscription.dispose()
  }

  #scheduleEviction(key: string): void {
    const entry = this.#entries.get(key)
    if (
      !entry ||
      entry.listeners.size > 0 ||
      entry.retains > 0 ||
      this.#fetches.has(key) ||
      this.#subscriptions.has(key)
    ) {
      return
    }

    if (this.#keepAlive === 0) {
      this.#entries.delete(key)
      return
    }

    if (!Number.isFinite(this.#keepAlive) || entry.evictionTimer !== undefined) {
      return
    }

    const timer = setTimeout(() => {
      entry.evictionTimer = undefined
      if (
        entry.listeners.size === 0 &&
        entry.retains === 0 &&
        !this.#fetches.has(key) &&
        !this.#subscriptions.has(key) &&
        this.#entries.get(key) === entry
      ) {
        this.#entries.delete(key)
      }
    }, this.#keepAlive)
    unrefTimer(timer)
    entry.evictionTimer = timer
  }

  #cancelEviction(entry: CacheEntry<unknown, unknown>): void {
    if (entry.evictionTimer !== undefined) {
      clearTimeout(entry.evictionTimer)
      entry.evictionTimer = undefined
    }
  }
}

export const defaultNaosResourceCache = new NaosResourceCache()

export function normalizeResourceKey<Key extends NaosResourceKey>(key: Key): NaosNormalizedResourceKey<Key> {
  if (key === null || key === undefined || key === false) {
    return { argument: key, disabled: true, key: undefined }
  }

  if (typeof key === "string") {
    return { argument: key as Exclude<Key, NaosDisabledResourceKey>, disabled: false, key }
  }

  return {
    argument: key as Exclude<Key, NaosDisabledResourceKey>,
    disabled: false,
    key: stableStringify(key),
  }
}

export function fetchResource<Data, Key extends NaosResourceKey>(
  key: Key,
  fetcher: NaosResourceFetcher<Data, Exclude<Key, NaosDisabledResourceKey> & NaosEnabledResourceKey>,
  options: NaosFetchResourceOptions<Data> = {}
): NaosResource<Data> {
  const cache = options.cache ?? defaultNaosResourceCache
  const normalized = normalizeResourceKey(key)
  if (normalized.disabled) {
    return disabledResource<Data>()
  }

  const resourceKey = normalized.key
  const resourceArgument = normalized.argument as Exclude<Key, NaosDisabledResourceKey> & NaosEnabledResourceKey
  const releaseEntry = cache.retain(resourceKey)
  let releaseFetch: () => void = () => {}
  let started = false
  let disposed = false

  function startFetch(force: boolean): { promise: Promise<Data>; release: () => void } {
    return cache.startFetch(
      resourceKey,
      resourceArgument,
      fetcher,
      force ? { ...options, revalidateIfStale: true } : options
    )
  }

  function ensureStarted(): void {
    if (started || disposed) {
      return
    }
    started = true
    releaseFetch = startFetch(false).release
  }

  function refetch(): Promise<Data> {
    if (disposed) {
      return Promise.reject(new Error("Cannot refetch a disposed resource."))
    }
    releaseFetch()
    started = true
    const fetch = startFetch(true)
    releaseFetch = fetch.release
    return fetch.promise
  }

  if (options.lazy === false) {
    ensureStarted()
  }

  return {
    key: resourceKey,
    dispose() {
      if (disposed) {
        return
      }
      disposed = true
      releaseFetch()
      releaseEntry()
    },
    mutate(next, mutateOptions) {
      return cache.mutate(resourceKey, next, mutateOptions).then(async (result) => {
        if (mutateOptions?.revalidate) {
          await refetch()
        }
        return result
      })
    },
    refetch,
    snapshot() {
      return cache.snapshot<Data>(resourceKey)
    },
    subscribe(callback) {
      ensureStarted()
      return cache.subscribe(resourceKey, callback)
    },
  }
}

/**
 * Binds a resource to a component lifecycle scope: subscribes, delivers the
 * current snapshot immediately, and returns the unsubscribe cleanup. Inside
 * a Naos `effect()` this follows connect/disconnect automatically:
 *
 * ```ts
 * effect(() => bindResource(tasksResource, ({ status, data }) => {
 *   loadState.set(status)
 *   tasks.set(data ?? EMPTY_TASKS)
 * }))
 * ```
 *
 * Hand `onChange` values with stable identity to state (for example the
 * snapshot's `data` reference, with a module-level constant as fallback) so
 * the runtime's equality bail-out can skip redundant flushes.
 */
export function bindResource<Data, Error = unknown>(
  resource: NaosResource<Data, Error>,
  onChange: (state: NaosResourceState<Data, Error>) => void
): () => void {
  const notify = () => onChange(resource.snapshot())
  const unsubscribe = resource.subscribe(notify)
  notify()
  return () => unsubscribe()
}

export function subscriptionResource<Data, Key extends NaosResourceKey, Error = unknown>(
  key: Key,
  subscriber: NaosResourceSubscriber<Data, Exclude<Key, NaosDisabledResourceKey> & NaosEnabledResourceKey, Error>,
  options: { cache?: NaosResourceCache; initialData?: Data } = {}
): NaosResource<Data, Error> {
  const cache = options.cache ?? defaultNaosResourceCache
  const normalized = normalizeResourceKey(key)
  if (normalized.disabled) {
    return disabledResource<Data, Error>()
  }

  if (options.initialData !== undefined) {
    cache.set<Data, Error>(normalized.key, { data: options.initialData, status: "success" })
  }

  const releaseEntry = cache.retain(normalized.key)
  const releaseSubscription = cache.attachSubscription(
    normalized.key,
    normalized.argument as Exclude<Key, NaosDisabledResourceKey> & NaosEnabledResourceKey,
    subscriber
  )
  let disposed = false

  return {
    key: normalized.key,
    dispose() {
      if (disposed) {
        return
      }
      disposed = true
      releaseSubscription()
      releaseEntry()
    },
    mutate(next, mutateOptions) {
      return cache.mutate(normalized.key, next, mutateOptions)
    },
    snapshot() {
      return cache.snapshot<Data, Error>(normalized.key)
    },
    subscribe(callback) {
      return cache.subscribe(normalized.key, callback)
    },
  }
}

function disabledResource<Data, Error = unknown>(): NaosResource<Data, Error> {
  return {
    key: undefined,
    dispose() {},
    snapshot() {
      return { status: "pending" }
    },
    subscribe() {
      return () => {}
    },
  }
}

function stateData<Data>(state: NaosResourceState<Data>): Data | undefined {
  return state.data
}

async function runFetchWithRetry<Data, Key extends NaosEnabledResourceKey>(
  fetcher: NaosResourceFetcher<Data, Key>,
  argument: Key,
  signal: AbortSignal,
  retry: NaosResourceRetryOptions | undefined
): Promise<Data> {
  const attempts = Math.max(0, retry?.attempts ?? 0)
  let attempt = 0
  for (;;) {
    try {
      return await fetcher(argument, { signal })
    } catch (error) {
      if (signal.aborted || attempt >= attempts) {
        throw error
      }
      attempt += 1
      await retryDelay(retryDelayMs(retry?.delay, attempt), signal)
      if (signal.aborted) {
        throw new DOMException("The fetch was aborted during a retry delay.", "AbortError")
      }
    }
  }
}

function retryDelayMs(
  delay: NaosResourceRetryOptions["delay"],
  attempt: number
): number {
  if (typeof delay === "function") {
    return Math.max(0, delay(attempt))
  }
  return Math.max(0, delay ?? 0)
}

function retryDelay(ms: number, signal: AbortSignal): Promise<void> {
  if (ms === 0) {
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      resolve()
    }
    signal.addEventListener("abort", onAbort, { once: true })
  })
}

function unrefTimer(timer: ReturnType<typeof setTimeout>): void {
  const candidate = timer as unknown as { unref?: () => void }
  if (typeof candidate.unref === "function") {
    candidate.unref()
  }
}

function stableStringify(value: unknown): string {
  if (typeof value === "bigint" || typeof value === "function" || typeof value === "symbol") {
    throw new TypeError("NaosResource keys must be JSON-serializable values.")
  }

  if (value === undefined) {
    return "undefined"
  }

  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? String(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`
  }

  const record = value as Record<string, unknown>
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`
}
