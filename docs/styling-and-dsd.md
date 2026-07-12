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
