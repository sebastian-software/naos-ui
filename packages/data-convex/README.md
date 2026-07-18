# `@naos-ui/data-convex`

`@naos-ui/data-convex` is the optional Convex adapter for `@naos-ui/data`.
It wraps Convex's browser client in the shared `NaosResourceState` contract:
`convexResource()` for live queries, `convexMutation()` / `convexAction()`
wrappers, and a connection-state resource. `convex` is a peer dependency, so
fetch-only apps never install it.

**Stability: experimental.** Pre-1.0 and under active design; APIs may change
in any release.

```ts
import { ConvexClient } from "convex/browser"
import { convexMutation, convexResource } from "@naos-ui/data-convex"
import { api } from "../convex/_generated/api"

const convex = new ConvexClient(import.meta.env.VITE_CONVEX_URL)
const tasks = convexResource(convex, api.tasks.list, { projectId })
const createTask = convexMutation(convex, api.tasks.create)
```

See the [data guide](https://github.com/sebastian-software/naos-ui/blob/main/docs/data.md).
