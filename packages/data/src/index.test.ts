import { describe, expect, it, vi } from "vitest"

import {
  NaosResourceCache,
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
    const resource = fetchResource("task-list", async () => ["a", "b"], { cache })
    resource.subscribe(listener)

    await waitForSnapshot(resource, { data: ["a", "b"], status: "success" })

    expect(resource.snapshot()).toEqual({ data: ["a", "b"], status: "success" })
    expect(listener).toHaveBeenCalled()
  })

  it("dedupes in-flight fetches by normalized key", async () => {
    const cache = new NaosResourceCache()
    const fetcher = vi.fn(async () => ({ name: "Ada" }))

    const left = fetchResource(["profile", 1], fetcher, { cache })
    const right = fetchResource(["profile", 1], fetcher, { cache })

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
      { cache }
    )

    await Promise.resolve()
    resource.dispose()

    expect(signal?.aborted).toBe(true)
  })

  it("keeps cached data as stale while refetching", async () => {
    const cache = new NaosResourceCache()
    const fetcher = vi.fn(async () => (fetcher.mock.calls.length === 1 ? "first" : "second"))

    const first = fetchResource("cache-key", fetcher, { cache })
    await waitForSnapshot(first, { data: "first", status: "success" })
    await Promise.resolve()
    expect(first.snapshot()).toEqual({ data: "first", status: "success" })

    const second = fetchResource("cache-key", fetcher, { cache })
    expect(second.snapshot()).toEqual({ data: "first", stale: true, status: "success" })

    await waitForSnapshot(second, { data: "second", status: "success" })
    expect(second.snapshot()).toEqual({ data: "second", status: "success" })
  })

  it("can reuse cached data without stale revalidation", async () => {
    const cache = new NaosResourceCache()
    const fetcher = vi.fn(async () => "cached")

    const first = fetchResource("cache-key", fetcher, { cache })
    await waitForSnapshot(first, { data: "cached", status: "success" })
    await Promise.resolve()

    const second = fetchResource("cache-key", fetcher, {
      cache,
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
      revalidateIfStale: false,
    })
    await waitForSnapshot(resource, { data: "cached", status: "success" })

    await resource.refetch?.()

    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(resource.snapshot()).toEqual({ data: "fresh", status: "success" })
  })

  it("supports optimistic mutation rollback", async () => {
    const cache = new NaosResourceCache()
    const resource = fetchResource("count", async () => 1, { cache })
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
    const resource = fetchResource("count", fetcher, { cache })
    await waitForSnapshot(resource, { data: 1, status: "success" })

    await resource.mutate?.(2, { revalidate: true })

    expect(resource.snapshot()).toEqual({ data: 3, status: "success" })
  })
})

describe("cache eviction", () => {
  it("evicts an idle entry immediately with keepAlive 0", async () => {
    const cache = new NaosResourceCache({ keepAlive: 0 })
    const fetcher = vi.fn(async () => "value")

    const resource = fetchResource("evict-now", fetcher, { cache })
    await waitForSnapshot(resource, { data: "value", status: "success" })
    resource.dispose()

    expect(cache.snapshot("evict-now")).toEqual({ status: "pending" })
  })

  it("does not grow unboundedly across many disposed keys", async () => {
    const cache = new NaosResourceCache({ keepAlive: 0 })

    for (let index = 0; index < 25; index += 1) {
      const resource = fetchResource(["item", index], async () => index, { cache })
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
      const resource = fetchResource("keep-alive", async () => "kept", { cache })
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
      const first = fetchResource("revisited", async () => "kept", { cache })
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
    const resource = fetchResource("watched", async () => "kept", { cache })
    const unsubscribe = resource.subscribe(() => {})
    await waitForSnapshot(resource, { data: "kept", status: "success" })

    resource.dispose()
    expect(cache.snapshot("watched")).toEqual({ data: "kept", status: "success" })

    unsubscribe()
    expect(cache.snapshot("watched")).toEqual({ status: "pending" })
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
      { cache }
    )
    await Promise.resolve()

    cache.delete("doomed")

    expect(signal?.aborted).toBe(true)
    expect(cache.snapshot("doomed")).toEqual({ status: "pending" })
  })

  it("resets a deleted key to pending and notifies remaining listeners", async () => {
    const cache = new NaosResourceCache()
    const listener = vi.fn()
    const resource = fetchResource("reset", async () => "cached", { cache })
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
    const fetched = fetchResource("clear-fetch", async () => "cached", { cache })
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
