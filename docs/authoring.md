# lean-wc Authoring Guide

`lean-wc` is a Rust/OXC-powered TSX compiler for native Web Components. The
TypeScript package provides the authoring types, JSX surface, and Vite plugin;
the compiler semantics live in Rust and are exposed to Node through the native
`@lean-wc/core-node` wrapper.

This guide describes the current MVP authoring model. The authoring functions
are compile-time APIs. They throw if a `.wc.tsx` source file is executed without
the compiler transform.

## Project Language

English is the project language. Public APIs, package names, docs, examples,
diagnostics, and generated user-facing messages should be written in English.

## Component Files

Component source files should use the `.wc.tsx` extension so the Vite plugin can
select them with its default include filter.

```tsx
import { component, event, prop, state } from "lean-wc"

export default component("x-counter", { shadow: true }, () => {
  const label = prop.string("label", "Count")
  const count = state(0)
  const change = event<number>("change")

  return (
    <button
      part="button"
      data-count={count()}
      onClick={() => {
        count.set(count() + 1)
        change.emit(count())
      }}
    >
      {label()}: {count()}
    </button>
  )
})
```

The compiler emits a native `HTMLElement` subclass, registers it with
`customElements.define()` by default, and exports the generated class as both a
named and default export.

## TypeScript Setup

Use the automatic JSX runtime and point `jsxImportSource` at `lean-wc`.

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "lean-wc",
    "types": ["vite/client"]
  }
}
```

The package exposes:

* `lean-wc`: authoring functions and shared runtime helpers.
* `lean-wc/jsx-runtime`: intrinsic JSX element and attribute types.
* `lean-wc/jsx-dev-runtime`: development JSX runtime surface.
* `lean-wc/vite`: Vite transform plugin.

## Vite Setup

Build the local native binding before running Vite in this workspace:

```sh
pnpm -w build:native
```

Add the plugin before normal framework or app plugins.

```ts
import { defineConfig } from "vite"
import leanWebComponents from "lean-wc/vite"

export default defineConfig({
  plugins: [leanWebComponents()],
})
```

The default filter transforms `.wc.tsx` files and excludes `node_modules`.

```ts
leanWebComponents({
  include: /\.wc\.tsx$/,
  exclude: /node_modules/,
})
```

## Component Options

`component(tagName, render)` uses the defaults shown below.

```ts
component("x-name", {
  shadow: true,
  define: true,
  styles: [":host { display: block; }"],
}, () => {
  return <slot />
})
```

* `shadow`: when `true`, the generated element attaches an open shadow root.
  When `false`, it renders into the element itself.
* `define`: when `true`, the generated module registers the element. When
  `false`, the module exports a generated `defineXName()` function instead.
* `styles`: string expressions injected into a generated `<style>` element at
  the start of the shadow root. The MVP supports simple inline expressions.

## Props

Props are declared inside the component callback.

```ts
const label = prop.string("label", "Count")
const disabled = prop.boolean("disabled", false)
const value = prop.number("value", 0)
```

Each prop is available as a typed accessor:

```ts
label()
label.set("Next")
label.update((current) => `${current}!`)
```

The compiler generates property getters/setters and observed attribute handling.
String and number props synchronize as string attributes. Boolean props
synchronize through attribute presence.

## State

State is local to the generated element instance.

```ts
const count = state(0)

count()
count.set(count() + 1)
count.update((current) => current + 1)
```

State writes trigger an update pass for generated text and dynamic attributes.

## Events

Events are typed at authoring time.

```ts
const change = event<number>("change")

change.emit(count())
```

The generated emitter dispatches a `CustomEvent` with `bubbles: true`,
`composed: true`, and `cancelable: false` in the current MVP.

## JSX Surface

The MVP supports native element tags, text interpolation, static attributes,
dynamic attributes, event handlers, and slots.

```tsx
return (
  <button part="button" disabled={disabled()} onClick={() => count.update((n) => n + 1)}>
    <slot name="icon" />
    {label()}: {count()}
  </button>
)
```

Supported typed attributes include common DOM attributes, `aria-*`, `data-*`,
`part`, `slot`, `class`, `value`, and common event handlers such as `onClick`,
`onInput`, `onFocus`, and `onBlur`. Additional intrinsic element names are
accepted through the JSX index signature.

## Verification Commands

From the workspace root:

```sh
pnpm install
pnpm build:native
pnpm check-types
pnpm test
pnpm --filter @lean-wc/example-counter type-check
pnpm --filter @lean-wc/example-counter build
pnpm --filter @lean-wc/example-counter test
cargo fmt --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test --workspace
```

