# Naos Authoring Guide

Naos is a Rust/OXC-powered TSX compiler for native Web Components. The
TypeScript packages provide authoring types, JSX runtime types, runtime helpers,
and Vite integration. Compiler semantics live in Rust and are exposed to Node
through the native `@naos-ui/compiler` wrapper.

This guide describes the v0.1 authoring model. The authoring functions are
compile-time APIs. They throw if a `.wc.tsx` source file is executed without the
compiler transform.

## Project Language

English is the project language. Public APIs, package names, docs, examples,
diagnostics, and generated user-facing messages should be written in English.

## Component Files

Component source files should use the `.wc.tsx` extension so the Vite plugin can
select them with its default include filter.

```tsx
import { computed, event, on, state } from "@naos-ui/core"

export type CounterProps = {
  label?: string
}

export function Counter({ label = "Count" }: CounterProps = {}) {
  const count = state(0)
  const text = computed(() => `${label}: ${count()}`)
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
      {text()}
    </button>
  )
}
```

The compiler emits a native `HTMLElement` subclass, registers it with
`customElements.define()` by default, and exports the generated class as the
function component name plus a default export.

## TypeScript Setup

Use the automatic JSX runtime and point `jsxImportSource` at `@naos-ui/core`.

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@naos-ui/core",
    "types": ["vite/client"]
  }
}
```

The package exposes:

* `@naos-ui/core`: authoring functions and JSX types.
* `@naos-ui/runtime`: runtime helpers.
* `@naos-ui/router`: optional Custom Element app-shell router.
* `@naos-ui/compiler`: native compiler wrapper.
* `@naos-ui/compiler-*`: platform-specific optional native packages.
* `@naos-ui/cli`: `naos compile`, `naos prerender`, and `naos info`.
* `@naos-ui/vite`: Vite transform plugin.

The runtime package is intentionally limited to small browser platform helpers;
it is not where component state, effects, control flow, or list rendering live.
See [Runtime boundary](runtime-boundary.md) for the current helper policy.

## Vite Setup

Installed packages resolve the matching optional native package automatically.
Build the local native binding before running Vite in this workspace:

```sh
pnpm -w build:native
```

Add the plugin before normal framework or app plugins.

```ts
import { defineConfig } from "vite"
import { naos } from "@naos-ui/vite"

export default defineConfig({
  plugins: [naos()],
})
```

The default filter transforms `.wc.tsx` files and excludes `node_modules`.

```ts
naos({
  include: /\.wc\.tsx$/,
  exclude: /node_modules/,
})
```

The Vite plugin emits `naos-manifest.json` for every normal build. The manifest
records the package identity, stable tag names, source paths, and whether a
component also received Declarative Shadow DOM output.

```ts
naos({
  manifestFile: "naos-manifest.json",
  prerender: true,
})
```

Set `manifestFile: false` to disable the artifact. `prerender: false` disables
only static HTML generation; normal component metadata remains available.

For direct prerendering, call the Node wrapper with source text and initial
props. If the source uses `?inline` CSS imports outside the Vite plugin, pass
resolved CSS text through `inlineStyles` keyed by local import name. Once a
component enters the prerender path, the Rust core serializes it as host HTML
with `<template shadowrootmode="open">`.

```ts
import { renderDeclarativeShadowDom } from "@naos-ui/compiler"

const rendered = renderDeclarativeShadowDom({
  filename: "counter.wc.tsx",
  inlineStyles: { css },
  props: { label: "Count" },
  source,
})

console.log(rendered.html)
```

The generated client module reuses an existing declarative shadow root before
falling back to `attachShadow()`. Hydration markers are emitted only in DSD
HTML and are internal generated markup, not semver-protected selectors.
Development builds throw clear mismatch diagnostics; production builds remount
imperatively if the prerendered structure is stale.

See [Generated output contract](generated-output-contract.md) for the first
batch of semver-facing generated behavior and the internal details that tests
may assert only to protect hydration behavior.

## Function Components

Exported PascalCase functions are the preferred component declaration form. The
compiler combines the function's kebab-case name with the nearest package's
normalized name.

* `Counter` in `@acme/widgets` becomes `acme-widgets-counter`.
* `CounterButton` in package `shop` becomes `shop-counter-button`.
* `URLBadge` in a package with `naos.tagPrefix: "demo"` becomes
  `demo-url-badge`.

`naos.tagPrefix` is the only override. It is package-wide, must use lowercase
hyphen-separated words, and cannot begin with `xml`. The package version is
included in metadata and diagnostics but never in the public tag. Loading two
versions on one page is unsupported; the first registration wins and later
conflicts warn.

Function props use normal TypeScript types and destructuring defaults. The
compiler turns those destructured names into observed properties and attributes.

Naos function components are instance setup declarations. The component body is
analyzed and lowered into a generated Custom Element class; it is not called
again as a React-style render function during updates. Use `state()`,
`computed()`, prop reads, `effect()`, and `host().update()` to participate in
generated updates. The mental model is closer to Solid's setup-once components
and Svelte's compiled component instances than to runtime rerendering. The
single JSX return declares the view for that instance.

That single return is a compiler boundary, not a one-state UI limitation.
Loading, error, empty, and ready variants should be represented as state or
derived values inside the returned view, using explicit control-flow primitives
such as `<Show>` for binary conditionals and `<Switch>/<Match>` for mutually
exclusive state views.

```tsx
export type TextFieldProps = {
  disabled?: boolean
  label?: string
  maxLength?: number
}

export function TextField({
  disabled = false,
  label = "Name",
  maxLength = 80,
}: TextFieldProps = {}) {
  return (
    <label>
      {label}
      <input disabled={disabled} data-max-length={maxLength} />
    </label>
  )
}
```

The generated JavaScript property names stay camelCase. Observed attributes use
kebab-case, so `maxLength` observes `max-length`.

## Component Options

Function components can export an `options` constant for component CSS.

```ts
import css from "./text-field.css?inline"

export const options = {
  styles: [css],
} satisfies ComponentOptions
```

* `styles`: string expressions injected into a generated `<style>` element at
  the start of the shadow root. Public v0.1 CSS should come from Vite
  `?inline` text imports, for example `import css from "./x.css?inline"`.
  Declarative Shadow DOM prerender serializes resolved inline CSS text into the
  declarative shadow template.

CSS stays flat in v0.1: no Naos CSS graph, CSS Modules contract, Sass
contract, or CSS helper. Use CSS custom properties for theming across component
boundaries.

## Props

Preferred props are declared through the function parameter type and destructured
defaults.

```tsx
export type CounterProps = {
  enabled?: boolean
  label?: string
  step?: number
}

export function Counter({
  enabled = true,
  label = "Count",
  step = 1,
}: CounterProps = {}) {
  return <button disabled={!enabled}>{label}: {step}</button>
}
```

The compiler infers the MVP conversion kind from the default value:

* string literal defaults become string props.
* `true` or `false` defaults become boolean props.
* numeric defaults become number props.
* props without defaults currently fall back to string conversion.

The compiler generates property getters/setters and observed attribute handling.
String and number props synchronize as string attributes. Boolean props
synchronize through attribute presence.

## State

State values are local to the generated element instance. `state()` is the
public writable local state primitive for v0.1.

```ts
const count = state(0)

count()
count.set(count() + 1)
count.update((current) => current + 1)
```

State writes use `Object.is` equality. Writing the current value is a no-op: it
does not invalidate computed values, schedule an update pass, mutate the DOM,
or rerun effects. Changed values trigger an update pass for generated text,
dynamic attributes, control-flow containers, and effects.

State can be initialized from props:

```ts
export function Checkbox({ checked = false }: CheckboxProps = {}) {
  const selected = state(checked)
}
```

This is an uncontrolled-first contract. The prop value initializes component
state once after initial attributes are processed and before mount or
hydration. Later prop or attribute changes do not bind `selected` back to
`checked`; the component owns the state after initialization.

## Form Controls

`formControl()` is an experimental authoring helper for custom controls that
need to participate in a real `<form>`.

```ts
export function Toggle({ disabled = false, pressed = false, value = "on" }) {
  const active = state(pressed)

  const form = formControl({
    value: () => (active() ? value : null),
    reset: () => {
      active.set(pressed)
    },
    disabled,
  })
  void form
}
```

The helper is compiler-recognized static metadata, not a runtime hook. Generated
output sets `static formAssociated = true`, calls `attachInternals()`, writes
submission values with `setFormValue()`, and emits reset/disabled lifecycle
callbacks when the source provides enough static information.

## Computed Values

Computed values are read-only derived accessors.

```ts
const count = state(0)
const doubled = computed(() => count() * 2)

doubled()
```

The current compiler milestone supports pure expression-body callbacks. The
generated accessor caches its value within an update pass and invalidates the
cache when state or prop writes mark a source dirty. Computed values can be used
in text bindings, dynamic attributes, `<Show when={...}>`, keyed `.map()` list
expressions, events, and effects.

## Effects And Host Lifecycle

Effects are scoped to a host connection. They run after the element first
mounts, clean up when it disconnects, and run again after every reconnect. A
reconnect performs a full generated update so event bindings and every effect
are re-established, but it does not mount again or reset component state.
Between connections, generated state writes do not restart effects.

After setup, generated code reruns an effect only when its detected state,
prop, or computed dependencies change. Unknown helper reads conservatively
fall back to the previous broad rerun behavior. Cleanup functions run before
the next effect pass and on disconnect.

```ts
effect(() => {
  const { element, signal } = host()
  element.dataset.ready = "true"

  signal.addEventListener("abort", () => {
    element.dataset.aborted = "true"
  })

  return () => {
    delete element.dataset.ready
  }
})
```

`host()` returns a typed lifecycle handle:

* `id`: a stable instance id derived from a host `id` attribute or the
  element's root-local order on first connection.
* `element`: the generated custom element instance.
* `root`: the render root, either the shadow root or the host element.
* `props`: the current generated prop values.
* `signal`: an `AbortSignal` aborted during `disconnectedCallback()`.
* `update()`: schedules the generated update pass and resolves to an
  update-scoped `AbortSignal` after that pass completes. The signal aborts on
  the next generated update or disconnect.
* `queueTask()`: schedules a task to run after the next generated update pass.
* `flushSync()`: an explicit request to run pending generated updates
  immediately.

Moving a live host with DOM APIs or a keyed-list reconciliation may produce a
disconnect/reconnect pair. The same connection-scoped rules apply: cleanup
runs before the move completes and setup runs after reconnection. Moving a host
between documents also preserves its state; Naos does not currently expose an
authoring-level `adoptedCallback`, and connection setup resumes when the host is
inserted into its destination document.

## Events

Events are typed at authoring time.

```ts
const change = event<number>("change")

change.emit(count())
```

The generated emitter dispatches a `CustomEvent` with `bubbles: true`,
`composed: true`, and `cancelable: false` in the current MVP.

The JSX attribute owns the DOM event name: `onClick` compiles to `click`,
`onKeyDown` to `keydown`, and `onDataReady` to the custom event name
`data-ready`. Use a bare callback for ordinary handlers. Use
`on(handler, options?)` when the handler needs an invocation-scoped
`AbortSignal` or native `addEventListener()` options such as `capture`,
`passive`, or `once`. The signal aborts when the same listener runs again or
the host disconnects.

```tsx
<button
  onClick={on(async (event, signal) => {
    event.preventDefault()
    await save(signal)
    if (signal.aborted) return
    count.update((value) => value + 1)
  }, { capture: true })}
>
  {count()}
</button>
```

## JSX Surface

The MVP supports native element tags, text interpolation, static attributes,
dynamic attributes, event handlers, PascalCase child components, explicit
`<Show>` conditionals, keyed `.map()` lists, and slots.

```tsx
return (
  <button part="button" disabled={disabled} onClick={() => count.update((n) => n + 1)}>
    <slot name="icon" />
    {label}: {count()}
  </button>
)
```

Supported typed attributes include common DOM attributes, `aria-*`, `data-*`,
`part`, `slot`, `class`, `value`, `ref`, and common event handlers such as
`onClick`, `onInput`, `onFocus`, and `onBlur`. Additional intrinsic element
names are accepted through the JSX index signature.

Use `ref` when component logic needs a direct element handle without querying
the shadow root. Identifier refs are assigned once when the generated element is
mounted or hydrated. Inline arrow callback refs are invoked once with the
element, but callback variables and cleanup return values are outside the v0.1
compiler boundary. DOM-connected work still belongs in `onConnected()`.

```tsx
let button: HTMLButtonElement | null = null

onConnected(() => {
  button?.focus()
})

return (
  <button ref={button} onClick={() => button?.setAttribute("data-clicked", "true")}>
    Save
  </button>
)
```

PascalCase child components are rewritten to inferred Custom Element tags.
Direct `.wc` imports are preserved as side-effect imports so the generated child
element module still runs.

```tsx
import { Counter } from "./counter.wc.tsx"

export function Dashboard() {
  return <Counter label="Nested" />
}
```

`<Show>`, `<Switch>/<Match>`, `<For>`, and `<Index>` are compiler primitives,
not runtime components. `<Switch>` chooses the first matching `<Match
when={...}>` arm and supports one trailing `<Match>` without `when` as an
explicit default. `<For>` is item-keyed and preserves row nodes by the returned
element's `key`. It can opt into FLIP move animation with `motion="flip"`;
the compiler measures preserved row positions around its keyed reorder and
uses `@naos-ui/motion` to play a transform-only Web Animations API transition.
Reduced-motion users get the same DOM update without animation. `<Index>` is
position-keyed and passes each item as an accessor so row nodes can stay mounted
while their values rebind. The narrow typed `.map()` form remains supported as
item-keyed list shorthand, without list-motion options.

Shared spring timing can be emitted as deterministic motion-token classes.
The same preset/configuration produces the same class name and CSS custom
properties, so generated Shadow DOM styles can carry motion variables without
runtime `style` string assembly or global CSS injection.

```tsx
<Show when={count() > 0} fallback={<span>Empty</span>}>
  <span>{count()}</span>
</Show>

<Switch>
  <Match when={status() === "loading"}>
    <p part="status">Loading</p>
  </Match>
  <Match when={status() === "error"}>
    <p part="status error">Error</p>
  </Match>
  <Match when={items().length === 0}>
    <p part="status empty">Empty</p>
  </Match>
  <Match>
    <ul>
      <For each={items()}>
        {(item) => <li key={item.id}>{item.label}</li>}
      </For>
    </ul>
  </Match>
</Switch>

<For each={items()} motion="flip">
  {(item, index) => (
    <span key={item.id} part="indicator" data-index={index}>
      {item.label}
    </span>
  )}
</For>

<Index each={names()}>
  {(name, index) => <input data-index={index} value={name()} />}
</Index>

{items().map((item, index) => (
  <span key={item.id} part="indicator" data-index={index}>
    {item.label}
  </span>
))}
```

`<Switch>` children must be static `<Match>` elements. Dynamic Match lists,
multiple defaults, and defaults before later conditional arms fail during
compiler analysis. Use `<Show>` when a visible subtree is independent, and
`<Switch>/<Match>` when only one view state should be visible at a time.

The accepted `<For>` and `.map()` forms must return a JSX element expression
body and put `key` on the returned root element. `<Index>` does not use a
`key`; choose it for position-stable controls such as editable inputs. Block
bodies, missing item keys, non-JSX map returns, and arbitrary list expressions
fail during compiler analysis.

Item-keyed lists can use a narrow local selector helper when a state value marks
one active key at a time:

```tsx
const selected = state("a")
const isSelected = (id: string) => selected() === id

<For each={items()}>
  {(item) => (
    <button
      key={item.id}
      aria-selected={isSelected(item.id)}
      data-state={isSelected(item.id) ? "selected" : "idle"}
      onClick={() => selected.set(item.id)}
    >
      {item.label}
    </button>
  )}
</For>
```

The compiler lowers row bindings that call `isSelected(item.id)` into keyed
dirty bindings. When `selected` changes, only bindings for the previous key and
the next key rerun; the list container itself still reconciles only when the
list expression changes. The lowering is generic and does not hard-code
`aria-selected`, `data-state`, class names, or text bindings. Unsupported
selector shapes fall back to the normal conservative dependency behavior.

## Primitive Contracts

Primitive Web Component fixtures should use platform-readable contracts rather
than framework-specific class conventions:

* `part="root|label|control|indicator"` for styling from outside Shadow DOM.
* `slot` for caller-provided content.
* `data-state` for state such as `on`, `off`, `open`, or `closed`.
* `data-disabled` when disabled state needs styling hooks.
* `data-orientation` for horizontal or vertical primitives.
* `aria-*` for accessibility state. Dynamic `aria-*` values preserve `false`
  as the string `"false"` instead of removing the attribute.

```tsx
<button
  part="root control"
  data-state={pressed() ? "on" : "off"}
  data-disabled={disabled || undefined}
  aria-pressed={pressed()}
  disabled={disabled}
>
  <span part="label">{label}</span>
  <slot />
</button>
```

## Verification Commands

From the workspace root:

```sh
pnpm install
pnpm build:native
pnpm check-types
pnpm test
pnpm --filter @naos-ui/example-counter type-check
pnpm --filter @naos-ui/example-counter build
pnpm --filter @naos-ui/example-counter test
cargo fmt --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test --workspace
```
