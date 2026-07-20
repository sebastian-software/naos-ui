# `@naos-ui/cli`

`@naos-ui/cli` is the minimal `naos` command line binary: `compile` a
`.wc.tsx` module, `prerender` static Declarative Shadow DOM HTML, and `info`
for native binding diagnostics.

**Stability: preview.** Pre-1.0; command surface is intentionally minimal and
may change between minor versions.

```sh
naos compile src/counter.wc.tsx -o dist/counter.js
naos prerender src/counter.wc.tsx --props '{"label":"Static"}' -o dist/counter.html
```

See the [CLI guide](https://github.com/sebastian-software/naos-ui/blob/main/docs/cli.md).
