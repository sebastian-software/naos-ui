import { describe, expect, it, vi } from "vitest"

import {
  NaosResourceCache,
  bindResource,
  fetchResource,
  normalizeResourceKey,
  subscriptionResource,
} from "./index.js"

describe("resource keys", () => {
  it("treats nullish and false keys as disabled", () => {
    expect(normalizeResourceKey(null)).toEqual({ argument: null, disabled: true, key: undefined })
    expect(normalizeResourceKey(undefined)).toEqual({ argument: undefined, disabled: true, key: undefined })
    expect(normalizeResourceKey(false)).toEqual({ argument: false, disabled: true, key: undefined })
  })

  it("normalizes object keys with stable property order", () => {
    expect(normalizeResourceKey({ b: 1, a: ["x", { c: true }] }).key).toBe(
      normalizeResourceKey({ a: ["x", { c: true }], b: 1 }).key
    )
  })
})

describe("fetchResource", () => {
  it("does not call the fetcher for disabled keys", async () => {
    const fetcher = vi.fn()
    const resource = fetchResource(null, fetcher)

    await Promise.resolve()

    expect(fetcher).not.toHaveBeenCalled()
    expect(resource.snapshot()).toEqual({ status: "pending" })
  })

  it("loads data and notifies subscribers", async () => {
    const cache = new NaosResourceCache()
    const listener = vi.fn()
    const resource = fetchResource("task-list", async () => ["a", "b"], { cache, lazy: false })
    resource.subscribe(listener)

    await waitForSnapshot(resource, { data: ["a", "b"], status: "success" })

    expect(resource.snapshot()).toEqual({ data: ["a", "b"], status: "success" })
    expect(listener).toHaveBeenCalled()
  })

  it("dedupes in-flight fetches by normalized key", async () => {
    const cache = new NaosResourceCache()
    const fetcher = vi.fn(async () => ({ name: "Ada" }))

    const left = fetchResource(["profile", 1], fetcher, { cache, lazy: false })
    const right = fetchResource(["profile", 1], fetcher, { cache, lazy: false })

    await waitForSnapshot(left, { data: { name: "Ada" }, status: "success" })

    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(left.snapshot()).toEqual({ data: { name: "Ada" }, status: "success" })
    expect(right.snapshot()).toEqual({ data: { name: "Ada" }, status: "success" })
  })

  it("aborts an in-flight fetch when the last resource is disposed", async () => {
    const cache = new NaosResourceCache()
    let signal: AbortSignal | undefined
    const resource = fetchResource(
      "slow",
      (_key, context) =>
        new Promise<string>(() => {
          signal = context.signal
        }),
      { cache, lazy: false }
    )

    await Promise.resolve()
    resource.dispose()

    expect(signal?.aborted).toBe(true)
  })

  it("keeps cached data as stale while refetching", async () => {
    const cache = new NaosResourceCache()
    const fetcher = vi.fn(async () => (fetcher.mock.calls.length === 1 ? "first" : "second"))

    const first = fetchResource("cache-key", fetcher, { cache, lazy: false })
    await waitForSnapshot(first, { data: "first", status: "success" })
    await Promise.resolve()
    expect(first.snapshot()).toEqual({ data: "first", status: "success" })

    const second = fetchResource("cache-key", fetcher, { cache, lazy: false })
    expect(second.snapshot()).toEqual({ data: "first", fetching: true, stale: true, status: "success" })

    await waitForSnapshot(second, { data: "second", status: "success" })
    expect(second.snapshot()).toEqual({ data: "second", status: "success" })
  })

  it("can reuse cached data without stale revalidation", async () => {
    const cache = new NaosResourceCache()
    const fetcher = vi.fn(async () => "cached")

    const first = fetchResource("cache-key", fetcher, { cache, lazy: false })
    await waitForSnapshot(first, { data: "cached", status: "success" })
    await Promise.resolve()

    const second = fetchResource("cache-key", fetcher, {
      cache,
      lazy: false,
      revalidateIfStale: false,
    })

    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(second.snapshot()).toEqual({ data: "cached", status: "success" })
  })

  it("still refetches explicitly when stale revalidation is disabled", async () => {
    const cache = new NaosResourceCache()
    const fetcher = vi.fn(async () => (fetcher.mock.calls.length === 1 ? "cached" : "fresh"))

    const resource = fetchResource("cache-key", fetcher, {
      cache,
      lazy: false,
      revalidateIfStale: false,
    })
    await waitForSnapshot(resource, { data: "cached", status: "success" })

    await resource.refetch?.()

    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(resource.snapshot()).toEqual({ data: "fresh", status: "success" })
  })

  it("supports optimistic mutation rollback", async () => {
    const cache = new NaosResourceCache()
    const resource = fetchResource("count", async () => 1, { cache, lazy: false })
    await waitForSnapshot(resource, { data: 1, status: "success" })

    await expect(
      resource.mutate?.(Promise.reject(new Error("nope")), {
        optimisticData: 2,
        rollbackOnError: true,
      })
    ).rejects.toThrow("nope")

    expect(resource.snapshot()).toEqual({ data: 1, status: "success" })
  })

  it("can revalidate after a cache mutation", async () => {
    const cache = new NaosResourceCache()
    const fetcher = vi.fn(async () => (fetcher.mock.calls.length === 1 ? 1 : 3))
    const resource = fetchResource("count", fetcher, { cache, lazy: false })
    await waitForSnapshot(resource, { data: 1, status: "success" })

    await resource.mutate?.(2, { revalidate: true })

    expect(resource.snapshot()).toEqual({ data: 3, status: "success" })
  })
})

describe("lazy start", () => {
  it("does not fetch until the first subscribe", async () => {
    const cache = new NaosResourceCache()
    const fetcher = vi.fn(async () => "value")

    const resource = fetchResource("lazy-key", fetcher, { cache })
    await Promise.resolve()
    expect(fetcher).not.toHaveBeenCalled()
    expect(resource.snapshot()).toEqual({ status: "pending" })

    resource.subscribe(() => {})
    await waitForSnapshot(resource, { data: "value", status: "success" })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it("starts only one fetch across multiple subscribers", async () => {
    const cache = new NaosResourceCache()
    const fetcher = vi.fn(async () => "value")

    const resource = fetchResource("lazy-multi", fetcher, { cache })
    resource.subscribe(() => {})
    resource.subscribe(() => {})

    await waitForSnapshot(resource, { data: "value", status: "success" })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it("refetch starts a lazy resource explicitly", async () => {
    const cache = new NaosResourceCache()
    const fetcher = vi.fn(async () => "forced")

    const resource = fetchResource("lazy-refetch", fetcher, { cache })
    await expect(resource.refetch?.()).resolves.toBe("forced")
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it("rejects refetch on a disposed resource without restarting work", async () => {
    const cache = new NaosResourceCache()
    const fetcher = vi.fn(async () => "value")

    const resource = fetchResource("refetch-disposed", fetcher, { cache })
    resource.dispose()

    await expect(resource.refetch?.()).rejects.toThrow("disposed resource")
    expect(fetcher).not.toHaveBeenCalled()
    expect(cache.snapshot("refetch-disposed")).toEqual({ status: "pending" })
  })

  it("does not fetch when a lazy resource is disposed before use", async () => {
    const cache = new NaosResourceCache()
    const fetcher = vi.fn(async () => "value")

    const resource = fetchResource("lazy-disposed", fetcher, { cache })
    resource.dispose()
    resource.subscribe(() => {})
    await Promise.resolve()

    expect(fetcher).not.toHaveBeenCalled()
  })
})

describe("fetching flag and retry", () => {
  it("marks the state as fetching while a request is in flight", async () => {
    const cache = new NaosResourceCache()
    let resolveFetch: (value: string) => void = () => {}
    const resource = fetchResource(
      "flagged",
      () =>
        new Promise<string>((resolve) => {
          resolveFetch = resolve
        }),
      { cache, lazy: false }
    )

    await Promise.resolve()
    expect(resource.snapshot()).toEqual({ fetching: true, status: "pending" })

    resolveFetch("done")
    await waitForSnapshot(resource, { data: "done", status: "success" })
    expect(resource.snapshot().fetching).toBeUndefined()
  })

  it("clears the fetching flag when an in-flight fetch is aborted", async () => {
    const cache = new NaosResourceCache()
    const resource = fetchResource(
      "aborted-flag",
      () => new Promise<string>(() => {}),
      { cache, lazy: false }
    )
    resource.subscribe(() => {})
    await Promise.resolve()
    expect(resource.snapshot()).toEqual({ fetching: true, status: "pending" })

    resource.dispose()

    expect(resource.snapshot()).toEqual({ status: "pending" })
  })

  it("retries failed fetches up to the configured attempts", async () => {
    const cache = new NaosResourceCache()
    const fetcher = vi.fn(async () => {
      if (fetcher.mock.calls.length < 3) {
        throw new Error("flaky")
      }
      return "recovered"
    })

    const resource = fetchResource("retried", fetcher, {
      cache,
      lazy: false,
      retry: { attempts: 2 },
    })

    await waitForSnapshot(resource, { data: "recovered", status: "success" })
    expect(fetcher).toHaveBeenCalledTimes(3)
  })

  it("reports the error after retries are exhausted", async () => {
    const cache = new NaosResourceCache()
    const error = new Error("still failing")
    const fetcher = vi.fn(async () => {
      throw error
    })

    const resource = fetchResource("exhausted", fetcher, {
      cache,
      lazy: false,
      retry: { attempts: 1 },
    })

    await waitForSnapshot(resource, { error, status: "error" })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it("waits the configured delay between retries", async () => {
    vi.useFakeTimers()
    try {
      const cache = new NaosResourceCache()
      const fetcher = vi.fn(async () => {
        if (fetcher.mock.calls.length === 1) {
          throw new Error("flaky")
        }
        return "recovered"
      })

      const resource = fetchResource("delayed-retry", fetcher, {
        cache,
        lazy: false,
        retry: { attempts: 1, delay: 40 },
      })

      await vi.advanceTimersByTimeAsync(39)
      expect(fetcher).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(1)
      await waitForSnapshot(resource, { data: "recovered", status: "success" })
      expect(fetcher).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe("bindResource", () => {
  it("delivers the current snapshot immediately and on every change", async () => {
    const cache = new NaosResourceCache()
    const resource = fetchResource("bound", async () => "loaded", { cache })
    const states: string[] = []

    bindResource(resource, (state) => {
      states.push(state.status)
    })

    expect(states[0]).toBe("pending")
    await waitForSnapshot(resource, { data: "loaded", status: "success" })
    expect(states.at(-1)).toBe("success")
  })

  it("starts a lazy resource through its subscription", async () => {
    const cache = new NaosResourceCache()
    const fetcher = vi.fn(async () => "value")
    const resource = fetchResource("bound-lazy", fetcher, { cache })

    bindResource(resource, () => {})
    await waitForSnapshot(resource, { data: "value", status: "success" })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it("stops delivering changes after the cleanup runs", async () => {
    const cache = new NaosResourceCache()
    const resource = fetchResource("bound-cleanup", async () => "loaded", { cache })
    const onChange = vi.fn()

    const cleanup = bindResource(resource, onChange)
    await waitForSnapshot(resource, { data: "loaded", status: "success" })
    const callsAfterLoad = onChange.mock.calls.length

    cleanup()
    cache.set("bound-cleanup", { data: "changed", status: "success" })

    expect(onChange.mock.calls.length).toBe(callsAfterLoad)
  })
})

describe("cache eviction", () => {
  it("evicts an idle entry immediately with keepAlive 0", async () => {
    const cache = new NaosResourceCache({ keepAlive: 0 })
    const fetcher = vi.fn(async () => "value")

    const resource = fetchResource("evict-now", fetcher, { cache, lazy: false })
    await waitForSnapshot(resource, { data: "value", status: "success" })
    resource.dispose()

    expect(cache.snapshot("evict-now")).toEqual({ status: "pending" })
  })

  it("does not grow unboundedly across many disposed keys", async () => {
    const cache = new NaosResourceCache({ keepAlive: 0 })

    for (let index = 0; index < 25; index += 1) {
      const resource = fetchResource(["item", index], async () => index, { cache, lazy: false })
      await waitForSnapshot(resource, { data: index, status: "success" })
      resource.dispose()
    }

    for (let index = 0; index < 25; index += 1) {
      expect(cache.snapshot(normalizeResourceKey(["item", index]).key)).toEqual({ status: "pending" })
    }
  })

  it("keeps an idle entry cached for the keepAlive window", async () => {
    vi.useFakeTimers()
    try {
      const cache = new NaosResourceCache({ keepAlive: 50 })
      const resource = fetchResource("keep-alive", async () => "kept", { cache, lazy: false })
      await waitForSnapshot(resource, { data: "kept", status: "success" })
      resource.dispose()

      expect(cache.snapshot("keep-alive")).toEqual({ data: "kept", status: "success" })

      vi.advanceTimersByTime(49)
      expect(cache.snapshot("keep-alive")).toEqual({ data: "kept", status: "success" })

      vi.advanceTimersByTime(1)
      expect(cache.snapshot("keep-alive")).toEqual({ status: "pending" })
    } finally {
      vi.useRealTimers()
    }
  })

  it("cancels a pending eviction when the key is used again", async () => {
    vi.useFakeTimers()
    try {
      const cache = new NaosResourceCache({ keepAlive: 50 })
      const first = fetchResource("revisited", async () => "kept", { cache, lazy: false })
      await waitForSnapshot(first, { data: "kept", status: "success" })
      first.dispose()

      vi.advanceTimersByTime(30)
      const unsubscribe = cache.subscribe("revisited", () => {})
      vi.advanceTimersByTime(100)

      expect(cache.snapshot("revisited")).toEqual({ data: "kept", status: "success" })
      unsubscribe()
      vi.advanceTimersByTime(50)
      expect(cache.snapshot("revisited")).toEqual({ status: "pending" })
    } finally {
      vi.useRealTimers()
    }
  })

  it("does not evict while listeners remain subscribed", async () => {
    const cache = new NaosResourceCache({ keepAlive: 0 })
    const resource = fetchResource("watched", async () => "kept", { cache, lazy: false })
    const unsubscribe = resource.subscribe(() => {})
    await waitForSnapshot(resource, { data: "kept", status: "success" })

    resource.dispose()
    expect(cache.snapshot("watched")).toEqual({ data: "kept", status: "success" })

    unsubscribe()
    expect(cache.snapshot("watched")).toEqual({ status: "pending" })
  })

  it("keeps a shared key alive until every resource is disposed", async () => {
    const cache = new NaosResourceCache({ keepAlive: 0 })
    const fetcher = vi.fn(async () => "shared")

    const left = fetchResource("shared-key", fetcher, { cache, lazy: false })
    const right = fetchResource("shared-key", fetcher, { cache, lazy: false })
    await waitForSnapshot(left, { data: "shared", status: "success" })
    await Promise.resolve()

    left.dispose()
    expect(right.snapshot()).toEqual({ data: "shared", status: "success" })

    right.dispose()
    expect(cache.snapshot("shared-key")).toEqual({ status: "pending" })
  })

  it("keeps cached data across refetch with keepAlive 0", async () => {
    const cache = new NaosResourceCache({ keepAlive: 0 })
    const fetcher = vi.fn(async () => (fetcher.mock.calls.length === 1 ? "first" : "second"))

    const resource = fetchResource("refetched", fetcher, { cache, lazy: false })
    await waitForSnapshot(resource, { data: "first", status: "success" })
    await Promise.resolve()

    await resource.refetch?.()

    expect(resource.snapshot()).toEqual({ data: "second", status: "success" })
  })

  it("treats a NaN keepAlive as the default window", async () => {
    vi.useFakeTimers()
    try {
      const cache = new NaosResourceCache({ keepAlive: Number.NaN })
      const resource = fetchResource("nan-window", async () => "kept", { cache, lazy: false })
      await waitForSnapshot(resource, { data: "kept", status: "success" })
      resource.dispose()

      expect(cache.snapshot("nan-window")).toEqual({ data: "kept", status: "success" })
      vi.advanceTimersByTime(300_000)
      expect(cache.snapshot("nan-window")).toEqual({ status: "pending" })
    } finally {
      vi.useRealTimers()
    }
  })

  it("deletes a key and aborts its in-flight fetch", async () => {
    const cache = new NaosResourceCache()
    let signal: AbortSignal | undefined
    fetchResource(
      "doomed",
      (_key, context) =>
        new Promise<string>(() => {
          signal = context.signal
        }),
      { cache, lazy: false }
    )
    await Promise.resolve()

    cache.delete("doomed")

    expect(signal?.aborted).toBe(true)
    expect(cache.snapshot("doomed")).toEqual({ status: "pending" })
  })

  it("resets a deleted key to pending and notifies remaining listeners", async () => {
    const cache = new NaosResourceCache()
    const listener = vi.fn()
    const resource = fetchResource("reset", async () => "cached", { cache, lazy: false })
    resource.subscribe(listener)
    await waitForSnapshot(resource, { data: "cached", status: "success" })
    listener.mockClear()

    cache.delete("reset")

    expect(listener).toHaveBeenCalledTimes(1)
    expect(resource.snapshot()).toEqual({ status: "pending" })
  })

  it("clears all entries and disposes active subscriptions", async () => {
    const cache = new NaosResourceCache()
    const dispose = vi.fn()
    const fetched = fetchResource("clear-fetch", async () => "cached", { cache, lazy: false })
    subscriptionResource("clear-feed", (_key, { next }) => {
      next(null, "live")
      return dispose
    }, { cache })
    await waitForSnapshot(fetched, { data: "cached", status: "success" })

    cache.clear()

    expect(dispose).toHaveBeenCalledTimes(1)
    expect(cache.snapshot("clear-fetch")).toEqual({ status: "pending" })
    expect(cache.snapshot("clear-feed")).toEqual({ status: "pending" })
  })
})

describe("subscriptionResource", () => {
  it("shares one subscription for equivalent keys", () => {
    const cache = new NaosResourceCache()
    const dispose = vi.fn()
    const subscribe = vi.fn(() => dispose)

    const left = subscriptionResource(["messages", "general"], subscribe, { cache })
    const right = subscriptionResource(["messages", "general"], subscribe, { cache })

    expect(subscribe).toHaveBeenCalledTimes(1)

    left.dispose()
    expect(dispose).not.toHaveBeenCalled()

    right.dispose()
    expect(dispose).toHaveBeenCalledTimes(1)
  })

  it("updates resource state from subscription events", () => {
    const cache = new NaosResourceCache()
    const resource = subscriptionResource<string, string>(
      "feed",
      (_key, { next }) => {
        next(null, "ready")
        next(null, (current) => `${current}:again`)
        return () => {}
      },
      { cache }
    )

    expect(resource.snapshot()).toEqual({ data: "ready:again", status: "success" })
  })

  it("retains stale data when a subscription reports an error", () => {
    const cache = new NaosResourceCache()
    const error = new Error("offline")
    const resource = subscriptionResource<string, string, Error>(
      "feed",
      (_key, { next }) => {
        next(null, "ready")
        next(error)
        return () => {}
      },
      { cache }
    )

    expect(resource.snapshot()).toEqual({ data: "ready", error, status: "error" })
  })
})

async function waitForSnapshot(resource: { snapshot(): unknown }, expected: unknown): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (JSON.stringify(resource.snapshot()) === JSON.stringify(expected)) {
      return
    }
    await Promise.resolve()
  }
  expect(resource.snapshot()).toEqual(expected)
}
