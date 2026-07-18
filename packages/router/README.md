# `@naos-ui/router`

`@naos-ui/router` is a tiny platform router for Custom Element applications.

It maps URLs to native elements, lazy-loads route modules, runs abortable route
loaders and FormData actions, exposes route params and search params, intercepts
ordinary same-origin anchors and explicit action forms, updates active link
state, restores scroll and focus after route commits, emits route events, and
cancels stale async navigations.

**Stability: preview.** Pre-1.0; the route contract may change between minor
versions.

```ts
import { createRouter, defineRoutes, redirect } from "@naos-ui/router"

const routes = defineRoutes([
  {
    path: "/",
    tag: "app-home",
    load: () => import("./routes/app-home.js"),
  },
  {
    path: "/products/:id",
    tag: "app-product",
    load: () => import("./routes/app-product.js"),
    loader: ({ params }) => fetch(`/api/products/${params.id}`).then((response) => response.json()),
    action: async ({ formData, params }) => {
      await fetch(`/api/products/${params.id}`, {
        body: formData,
        method: "POST",
      })
      return redirect(`/products/${params.id}`, { replace: true })
    },
    props({ params }) {
      return { productId: params.id }
    },
    focusTarget: "h1,[autofocus]",
  },
])

createRouter({
  focusRestoration: true,
  outlet: document.querySelector("[data-app-outlet]")!,
  routes,
  scrollRestoration: {
    getKey: ({ url }) => `${url.pathname}${url.search}`,
  },
}).start()
```

Routes defined through `defineRoutes()` derive typed path params from their
path template: in the `/products/:id` loader above, `params` is
`Readonly<{ id: string }>`, so `params.id` is a `string` and a misspelled name
like `params.slug` is a compile error. Optional (`:name?`) and wildcard
(`:name*`) segments type as `string | undefined`. The same typing applies to
`action`, `props`, `attrs`, `canEnter`, `createElement`, and every
`NaosRouteMatch` the router returns.

Route elements receive `element.naosRoute`, including `params`, `search`,
`data`, `actionData`, the current `URL`, and the navigation `AbortSignal`.
Native forms opt into action handling with `data-naos-action`.

The router defaults to browser-native app navigation behavior: new route commits
scroll to the top or hash target, back/forward restores the previous scroll
position, and focus moves to the route `focusTarget`, then `[autofocus]`, `main`,
the first heading, or the outlet. Apps that own this behavior can pass
`scrollRestoration: false`, `focusRestoration: false`, or per-navigation
`{ scroll: false, focus: false }`. Same-page hash links still fall through to
native fragment navigation.

Route events are dispatched from the router and the outlet:
`naos:navigationstart`, `naos:navigationcommit`, `naos:navigationabort`,
`naos:navigationerror`, `naos:routechange`, `naos:actionstart`,
`naos:actioncommit`, `naos:actionerror`, `naos:viewtransitionstart`, and
`naos:viewtransitionend`.

## Prefetch

`router.prefetch(to)` warms both the route module (`load`) and the loader
data. Loader results are cached per URL for `prefetchTtl` milliseconds
(default 30 seconds; `0` restricts prefetch to module warming) and the next
navigation to that URL consumes the cached result instead of re-running the
loader. Prefetching never commits UI, an in-flight prefetch is aborted through
its loader `AbortSignal` when a navigation to a different URL supersedes it,
and a failed prefetch is dropped so the real navigation retries cleanly.

Anchors opt into declarative prefetch with `data-naos-prefetch`:

```html
<a href="/products/42" data-naos-prefetch="hover">Product</a>
<a href="/settings" data-naos-prefetch="focus">Settings</a>
<a href="/reports" data-naos-prefetch="viewport">Reports</a>
```

`hover` prefetches on pointer hover, `focus` on keyboard focus, and
`viewport` when the link scrolls into view (via `IntersectionObserver`;
environments without the API skip viewport prefetch).

## View Transitions

`router.navigate(to, { viewTransition: true })` — or an anchor with
`data-naos-view-transition` — wraps the route commit in
`document.startViewTransition()`. While a transition runs,
`router.activeViewTransition` exposes `{ navigation, url }` and the router
dispatches `naos:viewtransitionstart` / `naos:viewtransitionend`. Browsers
without the View Transition API and users preferring reduced motion
(`prefers-reduced-motion: reduce`) navigate normally without animation.

## Error Views and URLs

When a loader or action throws and an `error` fallback route is configured,
the URL advances with the same push/replace rules as a successful navigation
before the error view commits. The address bar always reflects the URL whose
load failed, so reloading reproduces the error state and back/forward stays
consistent with what is on screen.

The package is optional. It is not a dependency of generated Naos components,
`@naos-ui/runtime`, or `@naos-ui/primitives`, and it does not depend on React,
Next.js, TanStack Router, Angular, Lit, or a virtual DOM runtime.
