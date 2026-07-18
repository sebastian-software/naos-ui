# `@naos-ui/core`

`@naos-ui/core` provides the public authoring surface for Naos components:
the JSX types, `state()` / `computed()` / `effect()` accessors, component
options, and control-flow component types (`Show`, `Switch`, `For`, `Index`)
consumed by `.wc.tsx` modules before they are compiled to native Custom
Elements.

**Stability: preview.** Pre-1.0; the authoring API follows the compiler
milestones and may change between minor versions.

```tsx
import { state } from "@naos-ui/core"

export function Counter() {
  const count = state(0)
  return <button onClick={() => count.set(count() + 1)}>{count()}</button>
}
```

See the [authoring guide](https://github.com/sebastian-software/naos-ui/blob/main/docs/authoring.md)
and [quickstart](https://github.com/sebastian-software/naos-ui/blob/main/docs/quickstart.md).
