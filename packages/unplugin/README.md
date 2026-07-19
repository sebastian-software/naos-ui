# `@naos-ui/unplugin`

Bundler-agnostic Naos component transform built on
[unplugin](https://github.com/unjs/unplugin). One factory produces plugins
for Vite, Rollup, esbuild, webpack, and Rspack:

```ts
import { naosPlugin } from "@naos-ui/unplugin"

// Rollup
export default { plugins: [naosPlugin.rollup()] }

// esbuild
await build({ plugins: [naosPlugin.esbuild()] })

// webpack / Rspack
config.plugins.push(naosPlugin.webpack())
```

The plugin compiles `*.wc.tsx` modules to native Custom Elements, reports
compiler diagnostics with code frames, and resolves `*.css?inline` imports
as inlined strings on bundlers without Vite's native `?inline` support.

## Supported bundlers

| Integration | Package |
| --- | --- |
| Vite (full-featured: DSD prerender, manifest, HMR) | `@naos-ui/vite` |
| Vite (transform only) | `naosPlugin.vite()` |
| Rollup | `naosPlugin.rollup()` |
| esbuild | `naosPlugin.esbuild()` |
| webpack | `naosPlugin.webpack()` |
| Rspack | `naosPlugin.rspack()` |

Vite users should prefer `@naos-ui/vite`, which layers Declarative Shadow
DOM prerendering, manifest emission, and HMR wiring on top of the same
compile step.

## The escape hatch

For toolchains not covered here, `transformComponent({ filename, source })`
and `renderDeclarativeShadowDom(...)` from `@naos-ui/compiler` are the
stable, supported integration points — pure functions this plugin itself is
built on.
