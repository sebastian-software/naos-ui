# `@naos-ui/data`

`@naos-ui/data` loads remote data for Naos and plain Custom Element
applications: `fetchResource()` for lazy pull-based requests and
`subscriptionResource()` for push-based sources, with a shared ref-counted
cache, request dedup, stale-while-revalidate with a `fetching` flag,
configurable retry, optimistic `mutate()`, configurable idle eviction, and
`bindResource()` as the component lifecycle glue. Inspired by SWR's model
without depending on SWR or React.

**Stability: experimental.** Pre-1.0 and under active design; APIs may change
in any release.

```ts
import { fetchResource } from "@naos-ui/data"

const profile = fetchResource(["profile", userId], async ([, id], { signal }) => {
  const response = await fetch(`/api/profile/${id}`, { signal })
  if (!response.ok) throw new Error(`Profile request failed: ${response.status}`)
  return response.json()
})
```

See the [data guide](https://github.com/sebastian-software/naos-ui/blob/main/docs/data.md).
