# `@iktia/router`

`@iktia/router` is a tiny platform router for Custom Element applications.

It maps URLs to native elements, lazy-loads route modules, runs abortable route
loaders and FormData actions, exposes route params and search params, intercepts
ordinary same-origin anchors and explicit action forms, updates active link
state, and cancels stale async navigations.

```ts
import { createRouter, defineRoutes, redirect } from "@iktia/router"

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
  },
])

createRouter({
  outlet: document.querySelector("[data-app-outlet]")!,
  routes,
}).start()
```

Route elements receive `element.iktiaRoute`, including `params`, `search`,
`data`, `actionData`, the current `URL`, and the navigation `AbortSignal`.
Native forms opt into action handling with `data-iktia-action`.

The package is optional. It is not a dependency of generated Iktia components,
`@iktia/runtime`, or `@iktia/primitives`.
