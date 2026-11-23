# App rendering and hydration

`renderApp` renders one flat, tagged route per GET request. It creates a new cache using the supplied constructor and passes it to the route factory and renderer. Use the existing compiler's `renderDeclarativeShadowDom` in the renderer to produce the route host and its declarative shadow root. The renderer supplies the surrounding document and places that host directly inside the router outlet. Nested routes, streaming, redirects and error routes are not supported by this initial server API.

```ts
import { NaosResourceCache, fetchResource } from "@naos-ui/data"
import { renderApp } from "@naos-ui/router"

const routes = (cache: NaosResourceCache) => [{
  path: "/profiles/:id",
  tag: "profile-page",
  async loader({ params }: { params: Readonly<Record<string, string>> }) {
    const resource = fetchResource(["profile", params.id], () => loadProfile(params.id!), { cache })
    try { return await resource.refetch!() } finally { resource.dispose() }
  },
}]

const result = await renderApp({
  request,
  Cache: NaosResourceCache,
  routes,
  expiresAt: Date.now() + 60_000,
  // Return the compiler's DSD host HTML using match.data as component props.
  render: (match) => renderProfileHost(match.data),
})
// Insert result.html in the router outlet and result.serializedSnapshot as
// the text of <script type="application/json" id="naos-snapshot">.
```

The renderer is application code: escape any values interpolated into HTML and use the compiler to serialize component props. `serializedSnapshot` escapes `<` for safe embedding in a script element. It contains JSON only: `{ version: 1, url, route, expiresAt, data, actionData, resources }`. Resource entries are `[normalizedKey, data]` pairs for settled, successful and non-stale cache entries. Route data and optional `actionData` describe the result already rendered; pending work, errors, functions, dates and cyclic values are not serialized. A non-JSON snapshot fails the server render rather than silently changing values.

On the client, pass the text from the script and the cache used by the route factory to the ordinary router before starting it:

```ts
const cache = new NaosResourceCache()
const router = createRouter({
  outlet: document.querySelector("[data-outlet]")!,
  routes: routes(cache),
  snapshot: document.querySelector("#naos-snapshot")?.textContent,
  snapshotCache: cache,
  onSnapshotMismatch: (reason) => console.warn("Snapshot ignored:", reason),
})
router.start()
```

The router checks the version, JSON shape, expiry, exact URL, route path, outlet host and cache availability before restoring. A rejected snapshot calls `onSnapshotMismatch` with `invalid`, `stale`, `url`, `route`, `shell` or `cache` and takes the normal loader and mount path. Accepted snapshots reuse the host and its declarative shadow root, restore route and action data, and seed resources before loading the route module. Restored resources do not fetch on subscription; `refetch()` or `revalidateIfStale: true` fetches explicitly. Unused restored entries expire after the cache's `keepAlive` window; `keepAlive: 0` evicts them immediately. Define route modules through `load` so they register elements after restoration, and avoid eagerly creating resources before router startup.

For **static rendering**, run the same render at build time for each known URL, choose an expiry matching the deployment's freshness policy and serve the resulting document as a static asset. Expired assets fall back to client loading. For **dynamic rendering**, call `renderApp` for each incoming request and create routes from its fresh cache. Do not share the cache across requests. Apply appropriate HTTP caching and privacy controls to the complete response: snapshots contain the same data as the rendered page. Neither path requires a framework runtime or a streaming transport.
