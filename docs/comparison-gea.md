# Naos and Gea

Naos and Gea are both compiler-first UI toolchains that describe themselves in
similar language: compile-time JSX, no virtual DOM, a small runtime, a Vite
plugin, and a headless UI package plus a router alongside the core. On a landing
page they can read almost the same.

Underneath the shared vocabulary they make a different core bet. This page
explains where the two overlap, where they genuinely diverge, and which one fits
which job.

> Positioning snapshot from July 2026. Naos is a v0.1 prerelease compiler
> toolchain; Gea is a further-developed application framework. This page is meant
> to explain where Naos fits, not to rank a broader framework against an MVP.
> Gea figures are that project's own published claims; see
> [Sources](#sources).

## At a glance

| | **Naos** | **Gea** |
| --- | --- | --- |
| One-line pitch | TSX compiler for native interface elements | Batteries-included reactive UI framework |
| Output target | **Native Custom Elements** — Shadow DOM, slots, `part`, Declarative Shadow DOM, Form-Associated | **Standard DOM** — components mount into a container and patch plain elements |
| Reactivity | Explicit signals: `state()`, `computed()`, `effect()` (read by calling) | Proxy-based deep reactivity: mutate directly (`this.count++`), getters for computed |
| Authoring unit | Exported PascalCase functions | Classes first (`Store` / `Component` with `template()`); functions compile to classes |
| Virtual DOM | None | None |
| JSX | Compile-time, narrow analyzable subset | Compile-time transform |
| Compiler | Rust / OXC core over an N-API boundary | JavaScript compiler in the Vite plugin |
| Update model | Generated direct DOM code per element | HTML string templates + deep proxy + surgical patching |
| Scope | Deliberately **not** an application framework; design-system and embed distribution | General application framework (UI, router, mobile, SSR) |
| Distribution contract | The native Custom Element itself, framework-neutral | The Gea app / component model |
| Maturity | v0.1 prerelease | More developed, benchmark-tuned |

## Where they read alike

Most of the surface overlap is the shared zeitgeist of the post–virtual-DOM
compiler wave (Solid signals, the Svelte compile-time ethos, the Web Components
and vanilla revival, the "just JavaScript" reaction to heavy runtimes):

- "Compiler-first" and "no virtual DOM" as the headline promise
- Compile-time JSX with no runtime reconciler
- PascalCase authoring, kebab-case naming downstream
- A small runtime and small bundles as a selling point
- A Vite plugin as the integration path
- A headless / accessible UI package plus a router beside the core
- AI agent skills shipped with the toolchain
- A "write ordinary typed code and it just works" framing

This combination has become the default template for a modern minimal
framework, which is why two independent projects can describe themselves in
nearly the same words.

## Where they diverge

The similarity is mostly on the tagline layer. The core decisions are different.

### Output target — the sharpest line

Naos compiles each component to a **native Custom Element**. The element is the
product: it carries Shadow DOM, slots, `part`-based styling hooks, Declarative
Shadow DOM prerender output, and an experimental Form-Associated path. You ship
a `<my-widget>` tag that any page — React, Vue, Angular, plain HTML, a CMS —
can consume without knowing Naos exists.

Gea, per its own documentation, renders into **standard DOM**: a root component
mounts into a container (`app.render(container)`) and its template produces plain
elements such as `<div>` and `<button>`, which Gea patches surgically as proxy
state changes. There is no custom-element registration, Shadow DOM, or slot/part
contract in that model. (Some third-party write-ups describe Gea as emitting
"native web components"; Gea's own docs show a plain-DOM mount-and-patch model,
which is what this page relies on.)

That single difference drives most of the rest: Naos is a **Web Components
distribution tool**, Gea is an **application framework**.

### Reactivity

- **Naos** uses explicit signal functions. You read a value by calling it —
  `count()` — and write with `count.set(...)`. Derived values are `computed()`,
  side effects are `effect()`. The graph is explicit and statically analyzable.
- **Gea** uses proxy-based deep reactivity. You mutate state directly
  (`this.count++`), and computed values are ordinary getters. The tracking is
  implicit and ergonomic; the mental model is "just mutate the object."

### Authoring unit

- **Naos** is function-first: an exported PascalCase function is the component,
  and the TypeScript name is the authoring contract that becomes the tag name.
- **Gea** is class-first: `Store` and `Component` subclasses, with a
  `template()` method. Function components are supported and compiled down to
  classes.

### Implementation

- **Naos** owns compiler semantics in **Rust / OXC**, exposed to Node through an
  N-API boundary. The TypeScript packages stay thin (types, authoring stubs,
  Vite glue).
- **Gea** implements its compile-time transform in the **JavaScript Vite
  plugin**.

## Side by side

A counter in each toolchain.

**Naos** — an exported function that becomes a Custom Element:

```tsx
import { computed, event, state } from "@naos-ui/core"

export function Counter({ label = "Count" }: { label?: string } = {}) {
  const count = state(0)
  const text = computed(() => `${label}: ${count()}`)
  const change = event<number>("change")

  return (
    <button
      part="button"
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

The generated module registers a Custom Element, synchronizes props and
attributes, dispatches native `CustomEvent`s, and can render into Shadow DOM
with styles and slots.

**Gea** — a class store plus a class component that mounts into the DOM:

```jsx
class CounterStore extends Store {
  count = 0
  increment() { this.count++ }
}

export default class App extends Component {
  template() {
    return (
      <div>
        <h1>{counterStore.count}</h1>
        <button click={counterStore.increment}>+</button>
      </div>
    )
  }
}
```

## Which one fits

Reach for **Naos** when:

- you are building a **design system** whose components must survive across
  frameworks, and the native Custom Element is the stable integration contract
- you ship **embedded widgets** that must not drag an app framework into the
  host page
- you want **Declarative Shadow DOM** prerender output, `part`-based theming, or
  a form-associated element
- you value a **Rust/OXC compiler core** with a deliberately narrow,
  statically analyzable authoring surface

Reach for **Gea** when:

- you are building a **full application** and want a batteries-included
  framework (router, UI, mobile, SSR) from one vendor
- you prefer **direct-mutation, proxy-based** reactivity over explicit signals
- you want **class-based** stores and components
- raw **js-framework-benchmark** performance for an app rendered into the page
  is a primary axis

The two are adjacent neighbors, not competitors for the same slot: one distributes
framework-neutral custom elements, the other builds applications that patch the
page directly.

## Honest caveats

- Naos is a **v0.1 prerelease**. Several primitives (notably form-associated
  ones) are explicitly unstable. Gea is further along.
- Bundle-size and benchmark figures cited for Gea are that project's own
  published numbers and were not independently reproduced here.
- Framework landscapes move quickly; treat this as a July 2026 snapshot and
  re-check both projects' current docs before relying on any single row.

## Sources

- Naos: this repository's [README](../README.md) and
  [documentation](README.md)
- Gea repository: <https://github.com/dashersw/gea>
- Gea docs — components:
  <https://github.com/dashersw/gea/blob/main/docs/core-concepts/components.md>
- Gea docs — getting started:
  <https://github.com/dashersw/gea/blob/main/docs/getting-started.md>
- Gea site: <https://geajs.com/>
- "Introducing Gea", Coyotiv:
  <https://www.coyotiv.com/blog/posts/introducing-gea-compile-time-reactive-ui-framework/>
