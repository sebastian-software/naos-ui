# `@naos-ui/vite`

`@naos-ui/vite` compiles `.wc.tsx` Naos component modules inside Vite. It
transforms matching modules through the native compiler, watches `?inline`
CSS dependencies, triggers full reloads for edited components in dev, emits
`naos-manifest.json`, and optionally prerenders Declarative Shadow DOM.

**Stability: preview.** Pre-1.0; plugin options may change between minor
versions.

```ts
import { defineConfig } from "vite"
import { naos } from "@naos-ui/vite"

export default defineConfig({
  plugins: [naos({ domBackend: "auto" })],
})
```

`domBackend` accepts `"imperative"` (the default), `"template"`, and
`"auto"`. See `@naos-ui/compiler` for template eligibility and Trusted Types
configuration.

See the [quickstart](https://github.com/sebastian-software/naos-ui/blob/main/docs/quickstart.md)
and [styling and DSD guide](https://github.com/sebastian-software/naos-ui/blob/main/docs/styling-and-dsd.md).
