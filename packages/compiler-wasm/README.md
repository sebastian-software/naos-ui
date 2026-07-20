# @naos-ui/compiler-wasm

WebAssembly fallback binding for `@naos-ui/compiler` on platforms without a
prebuilt native package (ADR 0025).

The `@naos-ui/compiler` loader picks this package up automatically as its
last-resort tier once it is installed:

```sh
npm install @naos-ui/compiler-wasm
```

It mirrors the full native binding surface (`transformComponent`,
`renderDeclarativeShadowDom`, `getNativeInfo`) on top of a
`wasm32-unknown-unknown` build of the Rust compiler core, produces
byte-identical transform output, and reports failures with the same
structured diagnostics payload. Transforms run roughly 1.6x slower than the
native binding, which is why this package is an explicit install for
unsupported platforms rather than a default dependency.
