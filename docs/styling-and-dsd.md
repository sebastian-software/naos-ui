# Styling And Declarative Shadow DOM

Naos keeps styling and static HTML explicit in v0.1. Vite owns CSS loading;
the compiler owns how accepted component CSS is injected into generated Custom
Elements and prerendered Declarative Shadow DOM.

## Component CSS

Use Vite `?inline` imports and list the imported CSS text in component options.

```tsx
import { type ComponentOptions } from "@naos-ui/core"
import css from "./counter.wc.css?inline"

export const options = {
  styles: [css],
} satisfies ComponentOptions
```

Naos treats CSS as flat text. There is no Naos CSS graph, CSS Modules
contract, Sass contract, or constructable stylesheet contract in v0.1.

## Theming Boundary

Use CSS custom properties for host-provided theming and `part`, `slot`,
`data-*`, and `aria-*` attributes for stable styling hooks.

```css
button {
  background: var(--naos-control-bg, white);
  border-color: var(--naos-control-border, currentColor);
}
```

## Declarative Shadow DOM

Declarative Shadow DOM is emitted by the explicit prerender path, not by a
component-level switch.

```sh
naos prerender src/counter.wc.tsx --props '{"label":"Static"}' -o dist/counter.html
```

The output contains host HTML with `<template shadowrootmode="open">`. The
generated client module reuses that declarative shadow root during custom
element upgrade before falling back to imperative Shadow DOM creation.

### The Prerender Boundary

Prerendering is static evaluation, not dynamic server rendering. The
prerenderer evaluates the component's initial markup from statically
analyzable expressions plus the JSON props passed on the command line or
plugin options. That draws a hard boundary:

* Prerenderable: the initial template, static text and attributes, default
  state values, and JSON-serializable props.
* Not prerenderable: anything that needs a browser or a request context —
  effects, event handlers, fetched data, subscriptions, and non-JSON prop
  values. These run on the client after the element upgrades and hydrates
  the declarative shadow root.

If a component's initial output cannot be computed statically, prerender it
with props that produce a meaningful fallback state, or skip prerendering for
that component and let it render client-side. "SSR support" in Naos always
means this static DSD path; there is no server runtime executing components
per request.

## Vite Manifest

The Vite plugin emits `naos-manifest.json` for normal builds, independently of
Declarative Shadow DOM. Its sorted entries map package-stable tags to component
modules and mark the entries that also use DSD.

```ts
naos({
  manifestFile: "naos-manifest.json",
  prerender: true,
})
```

Use `manifestFile: false` only when the build does not need the artifact.
`prerender: false` leaves the normal manifest enabled.

## Hydration Markers

Visible `data-naos-*` attributes in prerendered HTML are internal hydration
markers. Do not style or query them as public selectors. Development builds
throw clear mismatch diagnostics; production builds remount imperatively when a
stale prerendered structure cannot be hydrated.

For implementation details and deferred CSS/DSD decisions, see
[Declarative Shadow DOM plan](declarative-shadow-dom-plan.md) and
[Compiler limitations](compiler-limitations.md).
