# `@naos-ui/compiler`

`@naos-ui/compiler` is the thin Node.js boundary around the native Naos
compiler core. It resolves the matching platform-native binding, exposes
`transformComponent()` and `renderDeclarativeShadowDom()`, and reports
structured diagnostics.

**Stability: preview.** Pre-1.0; `transformComponent()` is the stable
integration point for custom toolchains, but result shapes may grow fields
between minor versions.

```ts
import { transformComponent } from "@naos-ui/compiler"

const result = transformComponent({ filename: "counter.wc.tsx", source })
result.code // compiled Custom Element module
```

See the [API reference](https://github.com/sebastian-software/naos-ui/blob/main/docs/api-reference.md)
and [native distribution notes](https://github.com/sebastian-software/naos-ui/blob/main/docs/native-distribution.md).
