# Data Resources

`@naos-ui/data` is an optional package for loading remote data in Naos and
plain Custom Element applications. It keeps data fetching outside
`@naos-ui/runtime`, `@naos-ui/primitives`, and the compiler while giving components
a normalized state shape for pending, success, and error states.

The base package supports two source types:

* `fetchResource()` for pull-based HTTP or service-client requests.
* `subscriptionResource()` for push-based sources such as WebSockets, database
  subscriptions, including provider adapters such as `@naos-ui/data-convex`.

The package is inspired by SWR's key, cache, revalidation, and mutate model,
but it does not depend on SWR or React.

## Public API Naming

Public data and provider-adapter types use the `Naos` prefix, including
`NaosResource`, `NaosResourceState`, `NaosResourceCache`, and
`NaosConvexQueryClient`. Package-scoped functions remain concise verbs such as
`fetchResource()` and `convexResource()`. The shared cache value is named
`defaultNaosResourceCache`.

## Adapter Modularity

`@naos-ui/data` must stay backend-neutral. It should not depend on Convex,
Firebase, Supabase, SWR, React, or any other data provider package. Apps that
only need `fetchResource()` should not install backend clients or pay their
bundle cost.

Provider integrations live in separate optional packages, such as
`@naos-ui/data-convex`, or in app code built on top of `subscriptionResource()`.
Those adapters can depend on their provider SDKs while keeping the generic
resource package small and usable for fetch-only applications.

## NaosResource State

Every resource exposes the same shape:

```ts
type NaosResourceState<Data, Error = unknown> =
  | { status: "pending"; data?: Data; stale?: boolean; fetching?: boolean }
  | { status: "success"; data: Data; stale?: boolean; fetching?: boolean }
  | { status: "error"; data?: Data; error: Error; stale?: boolean; fetching?: boolean }
```

`fetching` is `true` while a request for the key is in flight — including
background revalidation of stale data — so spinner-on-refetch UI does not have
to infer it from `stale` alone.

Use `snapshot()` to read the current state and `subscribe()` to receive change
notifications. Naos component integration should subscribe for the element
instance lifetime and schedule host updates from the subscription callback.

Calling a resource's idempotent `dispose()` permanently releases the resource
handle. The callback returned by `subscribe()` releases only that subscription.
Fetchers receive a caller-owned `AbortSignal` for asynchronous cancellation;
they do not dispose the resource itself.

## Fetch

Use `fetchResource()` for ordinary HTTP data, static JSON, asset metadata,
third-party APIs, or app service clients.

```ts
import { fetchResource } from "@naos-ui/data"

const profile = fetchResource(["profile", userId], async ([, id], { signal }) => {
  const response = await fetch(`/api/profile/${id}`, { signal })
  if (!response.ok) {
    throw new Error(`Profile request failed: ${response.status}`)
  }
  return response.json() as Promise<Profile>
})
```

Fetch resources:

* accept string, tuple, or object keys;
* treat `null`, `undefined`, and `false` keys as disabled;
* are **lazy by default**: the first fetch starts on the first `subscribe()`
  (or an explicit `refetch()`), so constructing a resource that is never used
  issues no request — pass `lazy: false` to fetch eagerly at creation;
* pass an `AbortSignal` to the fetcher;
* abort when the final resource instance is disposed;
* dedupe equivalent in-flight keys;
* keep cached data as `stale` while revalidating and expose `fetching`;
* retry failed fetches when configured (`retry: { attempts, delay }`, where
  `delay` is milliseconds or a function of the 1-based attempt);
* expose `refetch()`;
* expose `mutate()` for cache updates and optimistic rollback.

## Component Lifecycle Binding

`bindResource(resource, onChange)` subscribes, delivers the current snapshot
immediately, and returns the unsubscribe cleanup. Inside a Naos `effect()`
this follows the element's connect/disconnect lifecycle automatically, and the
subscription starts a lazy resource's first fetch:

```ts
import { bindResource } from "@naos-ui/data"
import { EMPTY_TASKS, tasksResource } from "./resources.ts"

effect(() =>
  bindResource(tasksResource, ({ status, data }) => {
    loadState.set(status)
    tasks.set(data ?? EMPTY_TASKS)
  })
)
```

Hand `onChange` values with stable identity to state — the snapshot's `data`
reference plus module-level fallback constants — so the runtime's `Object.is`
bail-out can skip redundant flushes. A fresh array or object on every call
would re-trigger the flush loop instead.

## Subscriptions

Use `subscriptionResource()` when data arrives from a push source.

```ts
import { subscriptionResource } from "@naos-ui/data"

const messages = subscriptionResource(["messages", channel], ([, name], { next, signal }) => {
  const socket = new WebSocket(`/api/messages?channel=${name}`)

  socket.addEventListener("message", (event) => {
    next(null, JSON.parse(event.data) as Message[])
  })

  signal.addEventListener("abort", () => socket.close(), { once: true })

  return () => socket.close()
})
```

Equivalent subscription keys are ref-counted. Multiple resources with the same
key share one upstream subscription, and the upstream disposer runs after the
last consumer is disposed.

## Cache Lifetime and Eviction

Cache entries are ref-counted. An entry counts as idle once it has no
subscribed listeners, no in-flight fetch, and no active upstream subscription.
Idle entries are evicted after a configurable keep-alive window so that quick
back-navigation still hits the cache while long-lived apps do not accumulate
one entry per visited key forever.

```ts
import { NaosResourceCache } from "@naos-ui/data"

const cache = new NaosResourceCache({ keepAlive: 60_000 })
```

* `keepAlive` is the idle time in milliseconds before eviction. The default is
  five minutes, `0` evicts immediately, and `Number.POSITIVE_INFINITY` disables
  eviction entirely. The shared `defaultNaosResourceCache` uses the default
  window.
* Using a key again within the window — subscribing, fetching, or writing —
  cancels the pending eviction.
* Every resource handle retains its entry for the handle's lifetime:
  `fetchResource()` and `subscriptionResource()` call `cache.retain(key)` on
  creation and release it in `dispose()`, so sharing a key across resources
  never evicts data while another handle is still alive. Direct cache users can
  call `retain()` themselves; it returns an idempotent release function.
* `cache.delete(key)` drops the cached state for one normalized key and aborts
  its in-flight fetch and upstream subscription. If listeners are still
  subscribed, the key resets to `pending` and they are notified; the entry is
  evicted once the last listener unsubscribes.
* `cache.clear()` applies the same semantics to every key.

## Convex Adapter

Convex support lives in `@naos-ui/data-convex`, not inside `@naos-ui/data` itself.
It is a thin adapter over Convex's existing JavaScript browser client APIs, not
a fork. The package declares `convex` as a peer dependency so fetch-only apps do
not install or bundle Convex.

```ts
import { ConvexClient } from "convex/browser"
import { convexMutation, convexResource } from "@naos-ui/data-convex"
import { api } from "../convex/_generated/api"

const convex = new ConvexClient(import.meta.env.VITE_CONVEX_URL)

const tasks = convexResource(convex, api.tasks.list, { projectId })
const createTask = convexMutation(convex, api.tasks.create)
```

The adapter uses the same `NaosResourceState` contract as `fetchResource()` and
`subscriptionResource()`, while leaving Convex client creation and auth
configuration to the app.

## One Mutation Model

Optimistic updates work the same way for fetch and Convex resources: both
route through `cache.mutate()`. For Convex, pass an `optimistic` config to
`convexMutation` — the optimistic value is visible immediately, rolled back
when the mutation rejects, and reconciled by the live query subscription when
the authoritative result arrives (`populateCache` stays off because the
subscription owns the query payload):

```ts
const createTask = convexMutation(convex, api.tasks.create, {
  optimistic: {
    key: ["convex", "tasks:list", { projectId }],
    optimisticData: (current, args) => [...(current ?? []), args.draft],
  },
})
```

Without `optimistic`, `convexMutation` stays a plain passthrough to
`client.mutation(...)`.

## DSD and Hydration

The first slice is client-side dynamic data. Static Declarative Shadow DOM
output should render the component's pending or fallback UI unless the app
provides initial data. Full async DSD, streaming, and Suspense-like behavior are
separate compiler/runtime design work.
