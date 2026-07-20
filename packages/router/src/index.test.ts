import { describe, expect, it, vi } from "vitest"

import { createRouter, defineRoutes, redirect, type NaosRouteMatch } from "./index.js"

type TestPlatform = {
  readonly history: History
  readonly location: Location
  readonly routerPlatform: unknown
  readonly scrollToCalls: Array<{ x: number; y: number }>
  dispatchPopState(): void
  setScroll(position: { x: number; y: number }): void
}

function setupRouter() {
  document.body.innerHTML = `
    <nav>
      <a href="/" data-home data-naos-active-match="exact">Home</a>
      <a href="/products/42?tab=details" data-product data-naos-active-match="prefix">Product</a>
    </nav>
    <main data-outlet></main>
  `

  class AppHome extends HTMLElement {}
  class AppProduct extends HTMLElement {
    productId = ""
  }
  class AppNotFound extends HTMLElement {}

  if (!customElements.get("app-home")) customElements.define("app-home", AppHome)
  if (!customElements.get("app-product")) customElements.define("app-product", AppProduct)
  if (!customElements.get("app-not-found")) customElements.define("app-not-found", AppNotFound)

  const routes = defineRoutes([
    {
      path: "/",
      tag: "app-home",
      title: "Home",
    },
    {
      path: "/products/:id",
      tag: "app-product",
      props({ params }) {
        return { productId: params.id }
      },
      attrs({ params }) {
        return { "data-product-id": params.id ?? "" }
      },
      title({ params }) {
        return `Product ${params.id}`
      },
    },
  ] as const)

  const outlet = document.querySelector("[data-outlet]")
  if (!outlet) throw new Error("Missing test outlet.")

  const router = createRouter({
    outlet,
    routes,
    notFound: {
      tag: "app-not-found",
      title: "Missing",
    },
  })

  return { outlet, router }
}

function setupPlatform(initialUrl = "https://naos.test/"): TestPlatform {
  let currentScroll = { x: 0, y: 0 }
  const listeners = new Set<EventListener>()
  const scrollToCalls: Array<{ x: number; y: number }> = []
  const entries: Array<{ href: string; state: unknown }> = [{ href: initialUrl, state: null }]
  let index = 0
  const currentHref = () => entries[index]?.href ?? initialUrl

  const dispatchPopState = () => {
    const event = new PopStateEvent("popstate", { state: entries[index]?.state })
    for (const listener of listeners) listener(event)
  }

  const history = {
    scrollRestoration: "auto",
    get state() {
      return entries[index]?.state ?? null
    },
    back() {
      if (index === 0) return
      index -= 1
      dispatchPopState()
    },
    forward() {
      if (index >= entries.length - 1) return
      index += 1
      dispatchPopState()
    },
    pushState(data: unknown, _unused: string, url?: string | URL | null) {
      const href = url ? new URL(String(url), currentHref()).href : currentHref()
      entries.splice(index + 1)
      entries.push({ href, state: data })
      index = entries.length - 1
    },
    replaceState(data: unknown, _unused: string, url?: string | URL | null) {
      const href = url ? new URL(String(url), currentHref()).href : currentHref()
      entries[index] = { href, state: data }
    },
  } as History

  const location = {
    get href() {
      return currentHref()
    },
  } as Location

  const platform = {
    document,
    history,
    location,
    addEventListener: (_name: "popstate", listener: EventListener) => {
      listeners.add(listener)
    },
    getScrollPosition: () => currentScroll,
    removeEventListener: (_name: "popstate", listener: EventListener) => {
      listeners.delete(listener)
    },
    scrollTo: (position: { x: number; y: number }) => {
      currentScroll = position
      scrollToCalls.push(position)
    },
  }

  return {
    dispatchPopState,
    history,
    location,
    routerPlatform: platform,
    scrollToCalls,
    setScroll(position) {
      currentScroll = position
    },
  }
}

async function waitForRouterWork(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

describe("NaosRouter", () => {
  it("matches route params and builds typed hrefs", () => {
    const { router } = setupRouter()

    expect(
      router.href(
        "/products/:id",
        { id: "abc 123" },
        {
          search: { tab: "details" },
        },
      ),
    ).toBe("/products/abc%20123?tab=details")

    const match = router.match("/products/42?tab=details")
    expect(match?.params).toEqual({ id: "42" })
    expect(match?.search.get("tab")).toBe("details")
  })

  it("matches optional and wildcard params with the fallback matcher", () => {
    document.body.innerHTML = `<main data-outlet></main>`
    class AppDocs extends HTMLElement {}
    class AppFiles extends HTMLElement {}
    if (!customElements.get("app-docs")) customElements.define("app-docs", AppDocs)
    if (!customElements.get("app-files")) customElements.define("app-files", AppFiles)

    const outlet = document.querySelector("[data-outlet]")
    if (!outlet) throw new Error("Missing test outlet.")
    const router = createRouter({
      outlet,
      routes: defineRoutes([
        { path: "/docs/:section?", tag: "app-docs" },
        { path: "/files/:path*", tag: "app-files" },
      ] as const),
    })

    expect(router.match("/docs")?.params).toEqual({})
    expect(router.match("/docs/api")?.params).toEqual({ section: "api" })
    expect(router.match("/files/guides/router")?.params).toEqual({ path: "guides/router" })
  })

  it("mounts custom element route views and updates active anchors", async () => {
    const { outlet, router } = setupRouter()
    const commits: NaosRouteMatch[] = []
    router.addEventListener("naos:navigationcommit", (event) => {
      commits.push((event as CustomEvent<{ match: NaosRouteMatch }>).detail.match)
    })

    await router.navigate("/products/42?tab=details")

    const element = outlet.firstElementChild as HTMLElement & {
      naosRoute?: NaosRouteMatch
      productId?: string
    }
    expect(element.tagName.toLowerCase()).toBe("app-product")
    expect(element.productId).toBe("42")
    expect(element.getAttribute("data-product-id")).toBe("42")
    expect(element.naosRoute?.params).toEqual({ id: "42" })
    expect(document.title).toBe("Product 42")
    expect(document.querySelector("[data-product]")?.hasAttribute("data-active")).toBe(true)
    expect(commits).toHaveLength(1)
  })

  it("runs route loaders before mounting and exposes loader data", async () => {
    document.body.innerHTML = `<main data-outlet></main>`

    class AppLoaded extends HTMLElement {
      routeData: unknown
    }
    if (!customElements.get("app-loaded")) customElements.define("app-loaded", AppLoaded)

    const outlet = document.querySelector("[data-outlet]")
    if (!outlet) throw new Error("Missing test outlet.")

    const router = createRouter({
      outlet,
      routes: defineRoutes([
        {
          path: "/loaded/:id",
          tag: "app-loaded",
          loader({ params, request, search }) {
            expect(request.method).toBe("GET")
            return {
              id: params.id,
              tab: search.get("tab"),
            }
          },
          props({ data }) {
            return { routeData: data }
          },
          title({ data }) {
            const loaded = data as { id: string }
            return `Loaded ${loaded.id}`
          },
        },
      ] as const),
    })

    const match = await router.navigate("/loaded/42?tab=details")
    const element = outlet.firstElementChild as AppLoaded & { naosRoute?: NaosRouteMatch }

    expect(match?.data).toEqual({ id: "42", tab: "details" })
    expect(element.routeData).toEqual({ id: "42", tab: "details" })
    expect(element.naosRoute?.data).toEqual({ id: "42", tab: "details" })
    expect(document.title).toBe("Loaded 42")
  })

  it("runs route actions and revalidates loader data", async () => {
    document.body.innerHTML = `<main data-outlet></main>`

    class AppAction extends HTMLElement {}
    if (!customElements.get("app-action")) customElements.define("app-action", AppAction)

    const outlet = document.querySelector("[data-outlet]")
    if (!outlet) throw new Error("Missing test outlet.")

    let loaderRuns = 0
    const actionCommits: NaosRouteMatch[] = []
    const router = createRouter({
      outlet,
      routes: defineRoutes([
        {
          path: "/actions/:id",
          tag: "app-action",
          loader({ params }) {
            loaderRuns += 1
            return { id: params.id, loaderRuns }
          },
          action({ formData, params, request }) {
            expect(request.method).toBe("POST")
            return {
              id: params.id,
              note: String(formData.get("note") ?? ""),
            }
          },
        },
      ] as const),
    })
    router.addEventListener("naos:actioncommit", (event) => {
      actionCommits.push((event as CustomEvent<{ match: NaosRouteMatch }>).detail.match)
    })

    const match = await router.submit("/actions/42", {
      formData: { note: "ship faster" },
      method: "post",
    })

    const element = outlet.firstElementChild as HTMLElement & { naosRoute?: NaosRouteMatch }
    expect(match?.actionData).toEqual({ id: "42", note: "ship faster" })
    expect(match?.data).toEqual({ id: "42", loaderRuns: 1 })
    expect(element.naosRoute?.actionData).toEqual({ id: "42", note: "ship faster" })
    expect(actionCommits).toHaveLength(1)
    expect(actionCommits[0]?.actionData).toEqual({ id: "42", note: "ship faster" })
  })

  it("follows action redirects through the router", async () => {
    document.body.innerHTML = `<main data-outlet></main>`

    class AppHome extends HTMLElement {}
    class AppSave extends HTMLElement {}
    if (!customElements.get("app-redirect-home"))
      customElements.define("app-redirect-home", AppHome)
    if (!customElements.get("app-save")) customElements.define("app-save", AppSave)

    const outlet = document.querySelector("[data-outlet]")
    if (!outlet) throw new Error("Missing test outlet.")

    const router = createRouter({
      outlet,
      routes: defineRoutes([
        { path: "/", tag: "app-redirect-home" },
        {
          path: "/save",
          tag: "app-save",
          action() {
            return redirect("/", { replace: true })
          },
        },
      ] as const),
    })

    const match = await router.submit("/save", { formData: {}, method: "post" })

    expect(match?.url.pathname).toBe("/")
    expect(outlet.firstElementChild?.tagName.toLowerCase()).toBe("app-redirect-home")
  })

  it("intercepts explicit data action forms", async () => {
    document.body.innerHTML = `
      <section data-root>
        <form data-naos-action action="/forms/42" method="post">
          <input name="note" value="from form">
          <button>Save</button>
        </form>
        <main data-outlet></main>
      </section>
    `

    class AppForm extends HTMLElement {}
    if (!customElements.get("app-form")) customElements.define("app-form", AppForm)

    const outlet = document.querySelector("[data-outlet]")
    const linkRoot = document.querySelector("[data-root]")
    const form = document.querySelector("form")
    if (!outlet || !linkRoot || !form) throw new Error("Missing test form setup.")

    const router = createRouter({
      linkRoot,
      outlet,
      routes: defineRoutes([
        {
          path: "/forms/:id",
          tag: "app-form",
          action({ formData, params }) {
            return {
              id: params.id,
              note: String(formData.get("note") ?? ""),
            }
          },
        },
      ] as const),
    })

    const actionCommit = new Promise<NaosRouteMatch>((resolve) => {
      router.addEventListener(
        "naos:actioncommit",
        (event) => {
          resolve((event as CustomEvent<{ match: NaosRouteMatch }>).detail.match)
        },
        { once: true },
      )
    })
    router.start()
    form.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }))

    await expect(actionCommit).resolves.toMatchObject({
      actionData: { id: "42", note: "from form" },
    })
    expect(outlet.firstElementChild?.tagName.toLowerCase()).toBe("app-form")
  })

  it("lets same-page hash links use native fragment navigation", () => {
    document.body.innerHTML = `
      <section data-root>
        <a href="#details" data-fragment>Details</a>
        <main data-outlet></main>
      </section>
    `

    class AppHome extends HTMLElement {}
    if (!customElements.get("app-hash-home")) customElements.define("app-hash-home", AppHome)

    const outlet = document.querySelector("[data-outlet]")
    const linkRoot = document.querySelector("[data-root]")
    const anchor = document.querySelector("[data-fragment]")
    if (!outlet || !linkRoot || !anchor) throw new Error("Missing test hash-link setup.")

    const router = createRouter({
      linkRoot,
      outlet,
      routes: defineRoutes([{ path: "/", tag: "app-hash-home" }] as const),
    })

    router.start()
    const event = new MouseEvent("click", { bubbles: true, cancelable: true })
    anchor.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(false)
    router.stop()
  })

  it("restores scroll positions when traversing history entries", async () => {
    document.body.innerHTML = `<main data-outlet></main>`

    class AppScrollA extends HTMLElement {}
    class AppScrollB extends HTMLElement {}
    if (!customElements.get("app-scroll-a")) customElements.define("app-scroll-a", AppScrollA)
    if (!customElements.get("app-scroll-b")) customElements.define("app-scroll-b", AppScrollB)

    const outlet = document.querySelector("[data-outlet]")
    if (!outlet) throw new Error("Missing test outlet.")

    const platform = setupPlatform("https://naos.test/a")
    const router = createRouter({
      outlet,
      routes: defineRoutes([
        { path: "/a", tag: "app-scroll-a" },
        { path: "/b", tag: "app-scroll-b" },
      ] as const),
      ...({ platform: platform.routerPlatform } as { platform: unknown }),
    })

    router.start()
    await waitForRouterWork()
    platform.setScroll({ x: 0, y: 128 })

    await router.navigate("/b")
    expect(platform.scrollToCalls.at(-1)).toEqual({ x: 0, y: 0 })

    platform.setScroll({ x: 0, y: 512 })
    platform.history.back()
    await waitForRouterWork()

    expect(outlet.firstElementChild?.tagName.toLowerCase()).toBe("app-scroll-a")
    expect(platform.scrollToCalls.at(-1)).toEqual({ x: 0, y: 128 })
    expect(platform.history.scrollRestoration).toBe("manual")

    router.stop()
    expect(platform.history.scrollRestoration).toBe("auto")
  })

  it("uses a configured scroll restoration key strategy", async () => {
    document.body.innerHTML = `<main data-outlet></main>`

    class AppKeyedA extends HTMLElement {}
    class AppKeyedB extends HTMLElement {}
    if (!customElements.get("app-keyed-a")) customElements.define("app-keyed-a", AppKeyedA)
    if (!customElements.get("app-keyed-b")) customElements.define("app-keyed-b", AppKeyedB)

    const outlet = document.querySelector("[data-outlet]")
    if (!outlet) throw new Error("Missing test outlet.")

    const getKey = vi.fn(({ url }: { url: URL }) => `${url.pathname}${url.search}`)
    const platform = setupPlatform("https://naos.test/a?tab=one")
    const router = createRouter({
      outlet,
      routes: defineRoutes([
        { path: "/a", tag: "app-keyed-a" },
        { path: "/b", tag: "app-keyed-b" },
      ] as const),
      scrollRestoration: { getKey },
      ...({ platform: platform.routerPlatform } as { platform: unknown }),
    })

    router.start()
    await waitForRouterWork()
    platform.setScroll({ x: 4, y: 240 })

    await router.navigate("/b?tab=two")
    platform.history.back()
    await waitForRouterWork()

    expect(getKey).toHaveBeenCalled()
    expect(platform.scrollToCalls.at(-1)).toEqual({ x: 4, y: 240 })

    router.stop()
  })

  it("scrolls new navigations to hash targets and can skip scroll restoration per navigation", async () => {
    document.body.innerHTML = `<main data-outlet></main>`
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView

    class AppHashTarget extends HTMLElement {
      connectedCallback() {
        this.innerHTML = `<article><h1 id="details">Details</h1></article>`
      }
    }
    class AppManualScroll extends HTMLElement {}
    if (!customElements.get("app-hash-target"))
      customElements.define("app-hash-target", AppHashTarget)
    if (!customElements.get("app-manual-scroll"))
      customElements.define("app-manual-scroll", AppManualScroll)

    const outlet = document.querySelector("[data-outlet]")
    if (!outlet) throw new Error("Missing test outlet.")

    const platform = setupPlatform()
    const router = createRouter({
      outlet,
      routes: defineRoutes([
        { path: "/details", tag: "app-hash-target" },
        { path: "/manual", tag: "app-manual-scroll" },
      ] as const),
      ...({ platform: platform.routerPlatform } as { platform: unknown }),
    })

    await router.navigate("/details#details")
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    expect(platform.scrollToCalls).toHaveLength(0)

    await router.navigate("/manual", { scroll: false })
    expect(platform.scrollToCalls).toHaveLength(0)
  })

  it("moves focus to route targets and falls back to headings", async () => {
    document.body.innerHTML = `<main data-outlet></main>`

    class AppFocused extends HTMLElement {
      connectedCallback() {
        this.innerHTML = `<article><button data-focus-target>Save</button></article>`
      }
    }
    class AppFallbackFocus extends HTMLElement {
      connectedCallback() {
        this.innerHTML = `<article><h1>Fallback heading</h1></article>`
      }
    }
    if (!customElements.get("app-focused")) customElements.define("app-focused", AppFocused)
    if (!customElements.get("app-fallback-focus"))
      customElements.define("app-fallback-focus", AppFallbackFocus)

    const outlet = document.querySelector("[data-outlet]")
    if (!outlet) throw new Error("Missing test outlet.")

    const platform = setupPlatform()
    const router = createRouter({
      outlet,
      routes: defineRoutes([
        { path: "/focused", tag: "app-focused", focusTarget: "[data-focus-target]" },
        { path: "/fallback", tag: "app-fallback-focus", focusTarget: "[data-missing]" },
      ] as const),
      ...({ platform: platform.routerPlatform } as { platform: unknown }),
    })

    await router.navigate("/focused")
    expect(document.activeElement?.getAttribute("data-focus-target")).toBe("")

    await router.navigate("/fallback")
    expect(document.activeElement?.tagName.toLowerCase()).toBe("h1")
  })

  it("can disable scroll and focus restoration for manually controlled apps", async () => {
    document.body.innerHTML = `<button data-before>Before</button><main data-outlet></main>`

    class AppDisabledRestoration extends HTMLElement {
      connectedCallback() {
        this.innerHTML = `<article><h1>Manual</h1></article>`
      }
    }
    if (!customElements.get("app-disabled-restoration")) {
      customElements.define("app-disabled-restoration", AppDisabledRestoration)
    }

    const outlet = document.querySelector("[data-outlet]")
    const before = document.querySelector<HTMLElement>("[data-before]")
    if (!outlet || !before) throw new Error("Missing test outlet.")
    before.focus()

    const platform = setupPlatform()
    const router = createRouter({
      focusRestoration: false,
      outlet,
      routes: defineRoutes([{ path: "/manual", tag: "app-disabled-restoration" }] as const),
      scrollRestoration: false,
      ...({ platform: platform.routerPlatform } as { platform: unknown }),
    })

    await router.navigate("/manual")

    expect(platform.scrollToCalls).toHaveLength(0)
    expect(document.activeElement).toBe(before)
  })

  it("replaces an action URL query string for GET submissions", async () => {
    document.body.innerHTML = `<main data-outlet></main>`

    class AppSearch extends HTMLElement {}
    if (!customElements.get("app-search")) customElements.define("app-search", AppSearch)

    const outlet = document.querySelector("[data-outlet]")
    if (!outlet) throw new Error("Missing test outlet.")

    const router = createRouter({
      outlet,
      routes: defineRoutes([{ path: "/search", tag: "app-search" }] as const),
    })

    const match = await router.submit("/search?q=old&page=1", {
      formData: { q: "new" },
      method: "get",
    })

    expect(match?.url.search).toBe("?q=new")
  })

  it("commits the error route for cyclic guard redirects", async () => {
    document.body.innerHTML = `<main data-outlet></main>`

    class AppPage extends HTMLElement {}
    class AppError extends HTMLElement {}
    if (!customElements.get("app-loop-page")) customElements.define("app-loop-page", AppPage)
    if (!customElements.get("app-loop-error")) customElements.define("app-loop-error", AppError)

    const outlet = document.querySelector("[data-outlet]")
    if (!outlet) throw new Error("Missing test outlet.")

    const router = createRouter({
      outlet,
      routes: defineRoutes([
        { path: "/a", tag: "app-loop-page", canEnter: () => "/b" },
        { path: "/b", tag: "app-loop-page", canEnter: () => "/a" },
      ] as const),
      error: {
        tag: "app-loop-error",
      },
    })

    const match = await router.navigate("/a")

    expect(match?.route.tag).toBe("app-loop-error")
    expect(outlet.firstElementChild?.tagName.toLowerCase()).toBe("app-loop-error")
  })

  it("does not abort a committed navigation when navigating again", async () => {
    const { router } = setupRouter()
    const aborts: number[] = []
    router.addEventListener("naos:navigationabort", (event) => {
      const navigation = (event as CustomEvent<{ navigation: NaosRouteMatch["navigation"] }>).detail
        .navigation
      aborts.push(navigation.id)
    })

    await router.navigate("/products/42")
    await router.navigate("/")

    expect(aborts).toHaveLength(0)
  })

  it("mounts not-found views for unmatched app URLs", async () => {
    const { outlet, router } = setupRouter()

    await router.navigate("/missing")

    expect(outlet.firstElementChild?.tagName.toLowerCase()).toBe("app-not-found")
    expect(document.title).toBe("Missing")
  })

  it("prevents stale async route loads from committing", async () => {
    document.body.innerHTML = `<main data-outlet></main>`

    class AppSlow extends HTMLElement {}
    class AppFast extends HTMLElement {}
    if (!customElements.get("app-slow")) customElements.define("app-slow", AppSlow)
    if (!customElements.get("app-fast")) customElements.define("app-fast", AppFast)

    let resolveSlow: () => void = () => {
      throw new Error("Slow route resolver was not assigned.")
    }
    const routes = defineRoutes([
      {
        path: "/slow",
        tag: "app-slow",
        load() {
          return new Promise<void>((resolve) => {
            resolveSlow = resolve
          })
        },
      },
      {
        path: "/fast",
        tag: "app-fast",
      },
    ] as const)

    const outlet = document.querySelector("[data-outlet]")
    if (!outlet) throw new Error("Missing test outlet.")
    const router = createRouter({ outlet, routes })
    const slowNavigation = router.navigate("/slow")
    await router.navigate("/fast")

    resolveSlow()
    await slowNavigation

    expect(outlet.firstElementChild?.tagName.toLowerCase()).toBe("app-fast")
  })
})

describe("prefetch", () => {
  function setupLoaderRoute(prefetchTtl?: number) {
    document.body.innerHTML = `<main data-outlet></main>`
    class AppPrefetched extends HTMLElement {}
    if (!customElements.get("app-prefetched"))
      customElements.define("app-prefetched", AppPrefetched)

    const outlet = document.querySelector("[data-outlet]")
    if (!outlet) throw new Error("Missing test outlet.")

    const loader = vi.fn(({ params }: { params: { id?: string } }) => ({ id: params.id }))
    const router = createRouter({
      outlet,
      prefetchTtl,
      routes: defineRoutes([
        { path: "/items/:id", tag: "app-prefetched", loader },
        { path: "/", tag: "app-prefetched" },
      ] as const),
    })
    return { loader, outlet, router }
  }

  it("reuses prefetched loader data on the next navigation without re-running the loader", async () => {
    const { loader, outlet, router } = setupLoaderRoute()

    await router.prefetch("/items/7")
    expect(loader).toHaveBeenCalledTimes(1)
    expect(outlet.firstElementChild).toBeNull()

    const match = await router.navigate("/items/7")
    expect(loader).toHaveBeenCalledTimes(1)
    expect(match?.data).toEqual({ id: "7" })

    await router.navigate("/")
    await router.navigate("/items/7")
    expect(loader).toHaveBeenCalledTimes(2)
  })

  it("expires prefetched loader data after the configured window", async () => {
    vi.useFakeTimers()
    try {
      const { loader, router } = setupLoaderRoute(50)

      await router.prefetch("/items/7")
      vi.advanceTimersByTime(51)
      await router.navigate("/items/7")

      expect(loader).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it("only warms modules when loader-data caching is disabled", async () => {
    const { loader, router } = setupLoaderRoute(0)

    await router.prefetch("/items/7")
    expect(loader).not.toHaveBeenCalled()

    await router.navigate("/items/7")
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it("aborts an in-flight prefetch when a navigation supersedes it", async () => {
    document.body.innerHTML = `<main data-outlet></main>`
    class AppSuperseded extends HTMLElement {}
    if (!customElements.get("app-superseded"))
      customElements.define("app-superseded", AppSuperseded)

    const outlet = document.querySelector("[data-outlet]")
    if (!outlet) throw new Error("Missing test outlet.")

    let loaderSignal: AbortSignal | null = null
    const router = createRouter({
      outlet,
      routes: defineRoutes([
        {
          path: "/pending",
          tag: "app-superseded",
          loader({ navigation }) {
            loaderSignal = navigation.signal
            return new Promise((_resolve, reject) => {
              navigation.signal.addEventListener(
                "abort",
                () => reject(new Error("Prefetch aborted.")),
                { once: true },
              )
            })
          },
        },
        { path: "/", tag: "app-superseded" },
      ] as const),
    })

    const prefetching = router.prefetch("/pending").catch(() => {})
    await waitForRouterWork()
    expect(loaderSignal).not.toBeNull()
    expect(loaderSignal!.aborted).toBe(false)

    await router.navigate("/")
    expect(loaderSignal!.aborted).toBe(true)
    await prefetching
  })

  it("runs the loader once for concurrent prefetches of the same URL", async () => {
    const { loader, router } = setupLoaderRoute()

    await Promise.all([
      router.prefetch("/items/7"),
      router.prefetch("/items/7"),
      router.prefetch("/items/7"),
    ])

    expect(loader).toHaveBeenCalledTimes(1)
  })

  it("aborts a consumed in-flight prefetch when a later navigation supersedes it", async () => {
    document.body.innerHTML = `<main data-outlet></main>`
    class AppConsumed extends HTMLElement {}
    if (!customElements.get("app-consumed")) customElements.define("app-consumed", AppConsumed)

    const outlet = document.querySelector("[data-outlet]")
    if (!outlet) throw new Error("Missing test outlet.")

    let loaderSignal: AbortSignal | null = null
    const router = createRouter({
      outlet,
      routes: defineRoutes([
        {
          path: "/slow-data",
          tag: "app-consumed",
          loader({ navigation }) {
            loaderSignal = navigation.signal
            return new Promise((_resolve, reject) => {
              navigation.signal.addEventListener(
                "abort",
                () => reject(new Error("Prefetch aborted.")),
                { once: true },
              )
            })
          },
        },
        { path: "/", tag: "app-consumed" },
      ] as const),
    })

    const prefetching = router.prefetch("/slow-data").catch(() => {})
    await waitForRouterWork()
    expect(loaderSignal).not.toBeNull()

    // Consume the in-flight prefetch, then navigate away before it settles.
    const consuming = router.navigate("/slow-data")
    await waitForRouterWork()
    expect(loaderSignal!.aborted).toBe(false)

    await router.navigate("/")
    expect(loaderSignal!.aborted).toBe(true)
    await expect(consuming).resolves.toBeNull()
    await prefetching
  })

  it("starts prefetch from hover and focus triggers without committing UI", async () => {
    document.body.innerHTML = `
      <section data-root>
        <a href="/items/1" data-naos-prefetch="hover" data-hover>Hover</a>
        <a href="/items/2" data-naos-prefetch="focus" data-focus>Focus</a>
        <main data-outlet></main>
      </section>
    `
    class AppTriggered extends HTMLElement {}
    if (!customElements.get("app-triggered")) customElements.define("app-triggered", AppTriggered)

    const outlet = document.querySelector("[data-outlet]")
    const linkRoot = document.querySelector("[data-root]")
    const hoverAnchor = document.querySelector("[data-hover]")
    const focusAnchor = document.querySelector("[data-focus]")
    if (!outlet || !linkRoot || !hoverAnchor || !focusAnchor)
      throw new Error("Missing prefetch setup.")

    const loader = vi.fn(({ params }: { params: { id?: string } }) => ({ id: params.id }))
    const router = createRouter({
      linkRoot,
      outlet,
      routes: defineRoutes([{ path: "/items/:id", tag: "app-triggered", loader }] as const),
    })
    router.start()
    await waitForRouterWork()
    const mountedBefore = outlet.firstElementChild

    hoverAnchor.dispatchEvent(new Event("pointerover", { bubbles: true }))
    await waitForRouterWork()
    focusAnchor.dispatchEvent(new Event("focusin", { bubbles: true }))
    await waitForRouterWork()

    expect(loader).toHaveBeenCalledTimes(2)
    expect(
      loader.mock.calls.map(([args]) => (args as { params: { id?: string } }).params.id),
    ).toEqual(["1", "2"])
    expect(outlet.firstElementChild).toBe(mountedBefore)

    router.stop()
  })

  it("starts prefetch when viewport-mode links become visible", async () => {
    const observed: Element[] = []
    let intersect: (targets: Element[]) => void = () => {}
    class FakeIntersectionObserver {
      #callback: IntersectionObserverCallback
      constructor(callback: IntersectionObserverCallback) {
        this.#callback = callback
        intersect = (targets) => {
          this.#callback(
            targets.map(
              (target) => ({ isIntersecting: true, target }) as IntersectionObserverEntry,
            ),
            this as unknown as IntersectionObserver,
          )
        }
      }
      observe(target: Element) {
        observed.push(target)
      }
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver)

    try {
      document.body.innerHTML = `
        <section data-root>
          <a href="/items/9" data-naos-prefetch="viewport" data-viewport>Viewport</a>
          <main data-outlet></main>
        </section>
      `
      class AppViewport extends HTMLElement {}
      if (!customElements.get("app-viewport")) customElements.define("app-viewport", AppViewport)

      const outlet = document.querySelector("[data-outlet]")
      const linkRoot = document.querySelector("[data-root]")
      const anchor = document.querySelector("[data-viewport]")
      if (!outlet || !linkRoot || !anchor) throw new Error("Missing viewport setup.")

      const loader = vi.fn(() => ({ ready: true }))
      const router = createRouter({
        linkRoot,
        outlet,
        routes: defineRoutes([{ path: "/items/:id", tag: "app-viewport", loader }] as const),
      })
      router.start()
      await waitForRouterWork()

      expect(observed).toContain(anchor)
      intersect([anchor])
      await waitForRouterWork()

      expect(loader).toHaveBeenCalledTimes(1)
      router.stop()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe("error-view URL semantics", () => {
  function setupErrorRouter(initialUrl = "https://naos.test/") {
    document.body.innerHTML = `<main data-outlet></main>`
    class AppErrorPage extends HTMLElement {}
    class AppErrorView extends HTMLElement {}
    if (!customElements.get("app-error-page")) customElements.define("app-error-page", AppErrorPage)
    if (!customElements.get("app-error-view")) customElements.define("app-error-view", AppErrorView)

    const outlet = document.querySelector("[data-outlet]")
    if (!outlet) throw new Error("Missing test outlet.")

    const platform = setupPlatform(initialUrl)
    const router = createRouter({
      error: { tag: "app-error-view" },
      outlet,
      routes: defineRoutes([
        { path: "/", tag: "app-error-page" },
        {
          path: "/broken",
          tag: "app-error-page",
          loader() {
            throw new Error("loader failed")
          },
          action() {
            throw new Error("action failed")
          },
        },
      ] as const),
      ...({ platform: platform.routerPlatform } as { platform: unknown }),
    })
    return { outlet, platform, router }
  }

  it("advances the URL when a loader failure commits the error view", async () => {
    const { outlet, platform, router } = setupErrorRouter()

    const match = await router.navigate("/broken")

    expect(outlet.firstElementChild?.tagName.toLowerCase()).toBe("app-error-view")
    expect(match?.url.pathname).toBe("/broken")
    expect(new URL(platform.location.href).pathname).toBe("/broken")

    platform.history.back()
    await waitForRouterWork()
    expect(new URL(platform.location.href).pathname).toBe("/")
  })

  it("advances the URL when a failed action commits the error view", async () => {
    const { outlet, platform, router } = setupErrorRouter()

    await router.submit("/broken", { formData: {}, method: "post" })

    expect(outlet.firstElementChild?.tagName.toLowerCase()).toBe("app-error-view")
    expect(new URL(platform.location.href).pathname).toBe("/broken")
  })

  it("yields to a navigation started by a navigationerror listener", async () => {
    const { outlet, platform, router } = setupErrorRouter()
    let recovery: Promise<unknown> = Promise.resolve()
    router.addEventListener(
      "naos:navigationerror",
      () => {
        recovery = router.navigate("/")
      },
      { once: true },
    )

    const errored = await router.navigate("/broken")
    await recovery

    expect(errored).toBeNull()
    expect(outlet.firstElementChild?.tagName.toLowerCase()).toBe("app-error-page")
    expect(new URL(platform.location.href).pathname).toBe("/")
  })
})

describe("view transitions", () => {
  type TransitionDocument = Omit<Document, "startViewTransition"> & {
    startViewTransition?: (callback: () => void) => { finished?: Promise<unknown> }
  }

  function setupTransitionRouter() {
    document.body.innerHTML = `<main data-outlet></main>`
    class AppTransition extends HTMLElement {}
    if (!customElements.get("app-transition"))
      customElements.define("app-transition", AppTransition)

    const outlet = document.querySelector("[data-outlet]")
    if (!outlet) throw new Error("Missing test outlet.")

    const router = createRouter({
      outlet,
      routes: defineRoutes([
        { path: "/", tag: "app-transition" },
        { path: "/next", tag: "app-transition" },
      ] as const),
    })
    return { outlet, router }
  }

  it("navigates normally when the View Transition API is unavailable", async () => {
    const { outlet, router } = setupTransitionRouter()
    const transitionEvents: string[] = []
    router.addEventListener("naos:viewtransitionstart", () => transitionEvents.push("start"))
    router.addEventListener("naos:viewtransitionend", () => transitionEvents.push("end"))

    const match = await router.navigate("/next", { viewTransition: true })

    expect(match?.url.pathname).toBe("/next")
    expect(outlet.firstElementChild?.tagName.toLowerCase()).toBe("app-transition")
    expect(transitionEvents).toEqual([])
    expect(router.activeViewTransition).toBeNull()
  })

  it("exposes transition state and events while a view transition runs", async () => {
    const { router } = setupTransitionRouter()
    const transitionDocument = document as unknown as TransitionDocument
    const startViewTransition = vi.fn((callback: () => void) => {
      callback()
      return { finished: Promise.resolve() }
    })
    transitionDocument.startViewTransition = startViewTransition

    try {
      const observedUrls: Array<string | null> = []
      router.addEventListener("naos:viewtransitionstart", () => {
        observedUrls.push(router.activeViewTransition?.url.pathname ?? null)
      })
      const ends: string[] = []
      router.addEventListener("naos:viewtransitionend", (event) => {
        ends.push((event as CustomEvent<{ url: URL }>).detail.url.pathname)
      })

      await router.navigate("/next", { viewTransition: true })

      expect(startViewTransition).toHaveBeenCalledTimes(1)
      expect(observedUrls).toEqual(["/next"])
      expect(ends).toEqual(["/next"])
      expect(router.activeViewTransition).toBeNull()
    } finally {
      delete transitionDocument.startViewTransition
    }
  })

  it("skips the view transition when reduced motion is preferred", async () => {
    const { outlet, router } = setupTransitionRouter()
    const transitionDocument = document as unknown as TransitionDocument
    const startViewTransition = vi.fn((callback: () => void) => {
      callback()
      return { finished: Promise.resolve() }
    })
    transitionDocument.startViewTransition = startViewTransition
    const matchMedia = vi
      .spyOn(window, "matchMedia")
      .mockReturnValue({ matches: true } as MediaQueryList)

    try {
      await router.navigate("/next", { viewTransition: true })

      expect(startViewTransition).not.toHaveBeenCalled()
      expect(outlet.firstElementChild?.tagName.toLowerCase()).toBe("app-transition")
    } finally {
      matchMedia.mockRestore()
      delete transitionDocument.startViewTransition
    }
  })
})

describe("nested routes and metadata", () => {
  function setupNestedRouter() {
    document.body.innerHTML = `<main data-outlet></main>`

    class AppShellLayout extends HTMLElement {
      connectedCallback() {
        if (!this.querySelector("[data-naos-router-outlet]")) {
          this.innerHTML = `<h2>Shell</h2><section data-naos-router-outlet></section>`
        }
      }
    }
    class AppOverview extends HTMLElement {}
    class AppProfile extends HTMLElement {}
    class AppNestedError extends HTMLElement {}
    if (!customElements.get("app-shell-layout"))
      customElements.define("app-shell-layout", AppShellLayout)
    if (!customElements.get("app-overview")) customElements.define("app-overview", AppOverview)
    if (!customElements.get("app-profile")) customElements.define("app-profile", AppProfile)
    if (!customElements.get("app-nested-error"))
      customElements.define("app-nested-error", AppNestedError)

    const outlet = document.querySelector("[data-outlet]")
    if (!outlet) throw new Error("Missing test outlet.")

    const router = createRouter({
      error: { tag: "app-nested-error" },
      outlet,
      routes: [
        {
          path: "/settings",
          tag: "app-shell-layout",
          meta: { description: "Settings area", title: "Settings" },
          children: [
            { path: "/", tag: "app-overview" },
            {
              path: "/profile/:user",
              tag: "app-profile",
              meta: ({ params }) => ({
                canonical: `https://naos.test/settings/profile/${String(params.user)}`,
                tags: [{ content: "profile", name: "section" }],
                title: `Profile ${String(params.user)}`,
              }),
            },
          ],
        },
        { path: "/", tag: "app-overview" },
      ],
    })
    return { outlet, router }
  }

  it("matches nested children with joined paths and merged params", () => {
    const { router } = setupNestedRouter()

    expect(router.match("/settings/profile/ada")?.params).toEqual({ user: "ada" })
    expect(router.match("/settings")?.route.tag).toBe("app-overview")
    expect(router.match("/settings/profile/ada")?.route.tag).toBe("app-profile")
  })

  it("mounts children into the parent outlet and keeps the layout mounted", async () => {
    const { outlet, router } = setupNestedRouter()

    await router.navigate("/settings")
    const layout = outlet.firstElementChild
    expect(layout?.tagName.toLowerCase()).toBe("app-shell-layout")
    const nestedOutlet = layout?.querySelector("[data-naos-router-outlet]")
    expect(nestedOutlet?.firstElementChild?.tagName.toLowerCase()).toBe("app-overview")

    await router.navigate("/settings/profile/ada")
    expect(outlet.firstElementChild).toBe(layout)
    expect(nestedOutlet?.firstElementChild?.tagName.toLowerCase()).toBe("app-profile")

    await router.navigate("/settings/profile/grace")
    expect(outlet.firstElementChild).toBe(layout)
    expect(
      (nestedOutlet?.firstElementChild as HTMLElement & { naosRoute?: { params: unknown } })
        ?.naosRoute?.params,
    ).toEqual({ user: "grace" })

    await router.navigate("/settings")
    expect(outlet.firstElementChild).toBe(layout)
    expect(nestedOutlet?.firstElementChild?.tagName.toLowerCase()).toBe("app-overview")
  })

  it("supports an explicit outlet() resolver on the parent route", async () => {
    document.body.innerHTML = `<main data-outlet></main>`
    class AppExplicitLayout extends HTMLElement {
      connectedCallback() {
        if (!this.querySelector("[data-slot]")) {
          this.innerHTML = `<div data-slot></div>`
        }
      }
    }
    class AppExplicitChild extends HTMLElement {}
    if (!customElements.get("app-explicit-layout"))
      customElements.define("app-explicit-layout", AppExplicitLayout)
    if (!customElements.get("app-explicit-child"))
      customElements.define("app-explicit-child", AppExplicitChild)

    const outlet = document.querySelector("[data-outlet]")
    if (!outlet) throw new Error("Missing test outlet.")

    const router = createRouter({
      outlet,
      routes: [
        {
          path: "/area",
          tag: "app-explicit-layout",
          outlet: (element) => element.querySelector("[data-slot]"),
          children: [{ path: "child", tag: "app-explicit-child" }],
        },
      ],
    })

    await router.navigate("/area/child")
    expect(outlet.querySelector("[data-slot]")?.firstElementChild?.tagName.toLowerCase()).toBe(
      "app-explicit-child",
    )
  })

  it("commits the error route when a parent exposes no child outlet", async () => {
    document.body.innerHTML = `<main data-outlet></main>`
    class AppNoOutletLayout extends HTMLElement {}
    class AppMissingChild extends HTMLElement {}
    class AppOutletError extends HTMLElement {}
    if (!customElements.get("app-no-outlet-layout"))
      customElements.define("app-no-outlet-layout", AppNoOutletLayout)
    if (!customElements.get("app-missing-child"))
      customElements.define("app-missing-child", AppMissingChild)
    if (!customElements.get("app-outlet-error"))
      customElements.define("app-outlet-error", AppOutletError)

    const outlet = document.querySelector("[data-outlet]")
    if (!outlet) throw new Error("Missing test outlet.")

    const errors: unknown[] = []
    const router = createRouter({
      error: { tag: "app-outlet-error" },
      outlet,
      routes: [
        {
          path: "/bare",
          tag: "app-no-outlet-layout",
          children: [{ path: "child", tag: "app-missing-child" }],
        },
      ],
    })
    router.addEventListener("naos:navigationerror", (event) => {
      errors.push((event as CustomEvent<{ error: unknown }>).detail.error)
    })

    await router.navigate("/bare/child")

    expect(outlet.firstElementChild?.tagName.toLowerCase()).toBe("app-outlet-error")
    expect(String(errors[0])).toContain("no child outlet")
  })

  it("applies merged route metadata and replaces managed head tags", async () => {
    const { router } = setupNestedRouter()

    await router.navigate("/settings/profile/ada")

    expect(document.title).toBe("Profile ada")
    expect(document.head.querySelector("meta[name='description']")?.getAttribute("content")).toBe(
      "Settings area",
    )
    expect(document.head.querySelector("link[rel='canonical']")?.getAttribute("href")).toBe(
      "https://naos.test/settings/profile/ada",
    )
    expect(document.head.querySelector("meta[name='section']")?.getAttribute("content")).toBe(
      "profile",
    )

    await router.navigate("/settings")
    expect(document.title).toBe("Settings")
    expect(document.head.querySelector("link[rel='canonical']")).toBeNull()
    expect(document.head.querySelector("meta[name='section']")).toBeNull()
    expect(document.head.querySelector("meta[name='description']")?.getAttribute("content")).toBe(
      "Settings area",
    )

    await router.navigate("/")
    expect(document.head.querySelectorAll("[data-naos-router-meta]")).toHaveLength(0)
  })

  it("scopes wildcard children to their parent prefix", async () => {
    document.body.innerHTML = `<main data-outlet></main>`
    class AppFilesLayout extends HTMLElement {
      connectedCallback() {
        if (!this.querySelector("[data-naos-router-outlet]")) {
          this.innerHTML = `<div data-naos-router-outlet></div>`
        }
      }
    }
    class AppFilesFallback extends HTMLElement {}
    class AppOther extends HTMLElement {}
    if (!customElements.get("app-files-layout"))
      customElements.define("app-files-layout", AppFilesLayout)
    if (!customElements.get("app-files-fallback"))
      customElements.define("app-files-fallback", AppFilesFallback)
    if (!customElements.get("app-other")) customElements.define("app-other", AppOther)

    const outlet = document.querySelector("[data-outlet]")
    if (!outlet) throw new Error("Missing test outlet.")

    const router = createRouter({
      outlet,
      routes: [
        {
          path: "/files",
          tag: "app-files-layout",
          children: [{ path: "*", tag: "app-files-fallback" }],
        },
        { path: "/other", tag: "app-other" },
      ],
    })

    expect(router.match("/other")?.route.tag).toBe("app-other")
    expect(router.match("/files/deep/nested")?.route.tag).toBe("app-files-fallback")

    await router.navigate("/files/deep/nested")
    expect(
      outlet.querySelector("[data-naos-router-outlet]")?.firstElementChild?.tagName.toLowerCase(),
    ).toBe("app-files-fallback")
  })

  it("restores the pre-router title when a route has no title source", async () => {
    document.body.innerHTML = `<main data-outlet></main>`
    class AppMetaTitled extends HTMLElement {}
    class AppUntitled extends HTMLElement {}
    if (!customElements.get("app-meta-titled"))
      customElements.define("app-meta-titled", AppMetaTitled)
    if (!customElements.get("app-untitled")) customElements.define("app-untitled", AppUntitled)

    const outlet = document.querySelector("[data-outlet]")
    if (!outlet) throw new Error("Missing test outlet.")

    document.title = "Base title"
    const router = createRouter({
      outlet,
      routes: [
        { path: "/titled", tag: "app-meta-titled", meta: { title: "Meta title" } },
        { path: "/plain", tag: "app-untitled" },
      ],
    })

    await router.navigate("/titled")
    expect(document.title).toBe("Meta title")

    await router.navigate("/plain")
    expect(document.title).toBe("Base title")
  })

  it("keeps the leaf title field authoritative over meta titles", async () => {
    document.body.innerHTML = `<main data-outlet></main>`
    class AppTitled extends HTMLElement {}
    if (!customElements.get("app-titled")) customElements.define("app-titled", AppTitled)

    const outlet = document.querySelector("[data-outlet]")
    if (!outlet) throw new Error("Missing test outlet.")

    const router = createRouter({
      outlet,
      routes: [
        {
          path: "/titled",
          tag: "app-titled",
          meta: { title: "From meta" },
          title: "From title",
        },
      ],
    })

    await router.navigate("/titled")
    expect(document.title).toBe("From title")
  })
})

describe("typed route params", () => {
  it("threads typed path params through loaders, actions, and matches", () => {
    const routes = defineRoutes([
      {
        path: "/products/:id",
        tag: "app-product",
        loader({ params }) {
          const id: string = params.id
          // @ts-expect-error - "slug" is not a param of "/products/:id"
          void params.slug
          return id
        },
        action({ params }) {
          const id: string = params.id
          return id
        },
        props({ params }) {
          return { productId: params.id }
        },
      },
      {
        path: "/files/:section/:name?",
        tag: "app-files",
        loader({ params }) {
          const section: string = params.section
          const name: string | undefined = params.name
          return [section, name]
        },
      },
      {
        path: "/docs/:rest*",
        tag: "app-docs",
        loader({ params }) {
          const rest: string | undefined = params.rest
          return rest
        },
      },
    ])

    expect(routes[0].path).toBe("/products/:id")
    expect(routes[1].path).toBe("/files/:section/:name?")
    expect(routes[2].path).toBe("/docs/:rest*")
  })

  it("omits an absent wildcard param at runtime", () => {
    const platform = setupPlatform("https://naos.test/docs")
    const outlet = document.createElement("div")
    const router = createRouter({
      outlet,
      routes: defineRoutes([{ path: "/docs/:rest*", tag: "app-docs" }]),
      ...({ platform: platform.routerPlatform } as { platform: unknown }),
    })

    const match = router.match("/docs")
    expect(match?.params).toEqual({})
  })
})
