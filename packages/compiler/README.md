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

const result = transformComponent({
  domBackend: "auto", // "imperative" is the default; "template" is strict.
  filename: "counter.wc.tsx",
  source,
})
result.code // compiled Custom Element module
```

`domBackend: "template"` serializes an eligible complete component into a
lazy per-module `HTMLTemplateElement`, clones it for each instance, and keeps
handles only for dynamic holes. `"auto"` chooses that output only if its raw
generated module is at least 5% smaller; parser-sensitive shapes and
control-flow/list components remain wholly imperative for now. The default is
`"imperative"` while the backend is rolled out.

When an application enforces Trusted Types, configure its own policy before
connecting any template-backend component:

```ts
import { configureTemplateHtmlPolicy } from "@naos-ui/runtime"

configureTemplateHtmlPolicy(trustedTypes.createPolicy("app-naos", { createHTML: (html) => html }))
```

Naos never creates a Trusted Types policy itself.

See the [API reference](https://github.com/sebastian-software/naos-ui/blob/main/docs/api-reference.md)
and [native distribution notes](https://github.com/sebastian-software/naos-ui/blob/main/docs/native-distribution.md).
