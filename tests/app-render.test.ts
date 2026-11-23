import { describe, expect, it, vi } from "vitest"
import { fetchResource, NaosResourceCache } from "../packages/data/src/index.js"
import { createRouter, renderApp } from "../packages/router/src/index.js"

describe("app rendering snapshots", () => {
  it("isolates concurrent requests and restores route, action and resource state", async () => {
    const fetcher = vi.fn(async (key: string) => ({ name: key }))
    const routes = (cache: NaosResourceCache) => [
      {
        path: "/profile/:id",
        tag: "app-profile",
        async loader({ params }: { params: Readonly<Record<string, string>> }) {
          const resource = fetchResource("profile", () => fetcher(params.id!), { cache })
          const result = await resource.refetch!()
          resource.dispose()
          return result
        },
      },
    ]
    const render = ({ data }: { data?: unknown }) =>
      `<app-profile><template shadowrootmode="open"><p>${JSON.stringify(data)}</p></template></app-profile>`
    const run = (id: string) =>
      renderApp({
        request: new Request(`${window.location.origin}/profile/${id}`),
        Cache: NaosResourceCache,
        routes,
        render,
        expiresAt: Date.now() + 60_000,
        actionData: { saved: id },
      })
    const [first, second] = await Promise.all([run("ada"), run("bea")])
    expect(first.snapshot.resources).toEqual([["profile", { name: "ada" }]])
    expect(second.snapshot.resources).toEqual([["profile", { name: "bea" }]])
    expect(first.html).toContain('shadowrootmode="open"')
    window.history.replaceState(null, "", "/profile/ada")
    document.body.innerHTML = `<main>${first.html}</main>`
    const outlet = document.querySelector("main")!
    const host = outlet.firstElementChild
    const cache = new NaosResourceCache()
    const router = createRouter({
      outlet,
      routes: routes(cache),
      snapshot: JSON.parse(first.serializedSnapshot),
      snapshotCache: cache,
    })
    const committed = new Promise<void>((resolve) =>
      router.addEventListener("naos:routechange", () => resolve(), { once: true }),
    )
    router.start()
    await committed
    expect(outlet.firstElementChild).toBe(host)
    expect(router.currentMatch?.data).toEqual({ name: "ada" })
    expect(router.currentMatch?.actionData).toEqual({ saved: "ada" })
    const resource = fetchResource("profile", () => fetcher("client"), { cache })
    const unsubscribe = resource.subscribe(() => {})
    await Promise.resolve()
    expect(resource.snapshot()).toEqual({ status: "success", data: { name: "ada" } })
    expect(fetcher).toHaveBeenCalledTimes(2)
    unsubscribe()
    resource.dispose()
    router.stop()
  })

  it.each(["invalid", "stale", "url", "route", "shell"])(
    "falls back for %s snapshots",
    async (reason) => {
      window.history.replaceState(null, "", "/profile/ada")
      document.body.innerHTML = `<main>${reason === "shell" ? "<wrong-host></wrong-host>" : "<app-profile></app-profile>"}</main>`
      const outlet = document.querySelector("main")!
      const loader = vi.fn(() => "fresh")
      const mismatch = vi.fn()
      const snapshot: Record<string, unknown> = {
        version: 1,
        url: window.location.href,
        route: "/profile/:id",
        expiresAt: Date.now() + 60_000,
        data: "old",
        actionData: null,
        resources: [],
      }
      if (reason === "invalid") snapshot.version = 2
      if (reason === "stale") snapshot.expiresAt = 0
      if (reason === "url") snapshot.url = "https://other.test/profile/ada"
      if (reason === "route") snapshot.route = "/other"
      const router = createRouter({
        outlet,
        routes: [{ path: "/profile/:id", tag: "app-profile", loader }],
        snapshot,
        onSnapshotMismatch: mismatch,
      })
      const committed = new Promise<void>((resolve) =>
        router.addEventListener("naos:routechange", () => resolve(), { once: true }),
      )
      router.start()
      await committed
      expect(mismatch).toHaveBeenCalledWith(reason)
      expect(loader).toHaveBeenCalledOnce()
      expect(router.currentMatch?.data).toBe("fresh")
      router.stop()
    },
  )

  it("rejects non-JSON values and escapes script terminators", async () => {
    const options = {
      request: new Request("https://naos.test/"),
      Cache: NaosResourceCache,
      routes: () => [{ path: "/", tag: "app-home", loader: () => "</script>" }],
      render: () => "<app-home></app-home>",
      expiresAt: Date.now() + 60_000,
    }
    const result = await renderApp(options)
    expect(result.serializedSnapshot).not.toContain("</script>")
    expect(JSON.parse(result.serializedSnapshot).data).toBe("</script>")
    await expect(renderApp({ ...options, actionData: new Date() })).rejects.toThrow("non-JSON")
  })
})
