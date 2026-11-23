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

Array and object keys are normalized with sorted object properties. Nested
`Date` values use their ISO timestamp and remain distinct from ISO strings;
invalid dates throw a `TypeError`. Fetchers receive the original key.

Optimistic mutations roll back on failure by default. A newer cache write or
subscription result takes precedence over an older mutation's eventual
rollback. Concurrent failed optimistic mutations unwind in settlement order.

See the [data guide](https://github.com/sebastian-software/naos-ui/blob/main/docs/data.md).
