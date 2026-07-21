# Generated Output Contract

Naos's public product surface is the native Custom Element output produced
from `.wc.tsx` modules. These contracts are intentionally platform-native so
host pages can use generated elements without a framework adapter.

## Public Contract

The following generated behavior is user-facing for v0.1:

- exported PascalCase components infer stable custom-element tag names;
- destructured props become JavaScript properties, with prop kinds derived
  from the TypeScript annotation first (`boolean`, `number`, `string`, and
  literal unions of one primitive) and from the default literal when no
  annotation resolves;
- string, boolean, and number props observe and reflect attributes: boolean
  props reflect as present or absent attributes (including annotation-typed
  booleans without a default literal), and string/number props reflect their
  stringified value;
- props with any other type (arrays, objects, mixed unions, references the
  compiler cannot resolve to a primitive) are rich props: property-only,
  never observed, never reflected, and set uncoerced so complex data
  round-trips through the property without stringification;
- a prop whose annotation and default literal disagree fails compilation
  with `NAOS_PROP_TYPE_MISMATCH`;
- generated elements render into open Shadow DOM by default;
- `styles` entries become one shared constructable stylesheet adopted by
  every client-mounted instance, with inline `<style>` text as the
  Declarative Shadow DOM fallback;
- `part`, `slot`, `data-*`, `aria-*`, and common DOM attributes are emitted as
  platform attributes;
- dynamic `aria-*` values preserve `false` as `"false"`;
- `event()` dispatches native `CustomEvent` instances with Naos's v0.1
  defaults: bubbling, composed, and not cancelable;
- explicit Declarative Shadow DOM prerendering emits host HTML with
  `<template shadowrootmode="open">`;
- generated client classes reuse an existing declarative shadow root before
  falling back to imperative `attachShadow()`;
- the optional template DOM backend serializes only compiler-known static HTML,
  clones a detached `HTMLTemplateElement` per component instance, and retains
  direct handles only for dynamic element and text holes; the default backend
  remains imperative while rollout measurements are collected;
- applications enforcing Trusted Types must configure an application-owned
  policy through `configureTemplateHtmlPolicy()` before connecting a template
  backend component; Naos never creates a policy itself;
- compiled components carry their prop and event metadata in the transform
  result, and `renderNaosElementDeclaration()` turns it into a standalone
  `.d.ts` module: the element class with typed properties (rich props surface
  as `unknown`), typed `addEventListener`/`removeEventListener` overloads for
  `event()` declarations, and a global `HTMLElementTagNameMap` entry so
  `document.createElement`/`querySelector` return the typed element.
  `@naos-ui/primitives` ships these generated typings for every primitive.

## Internal Details

Generated implementation details are not semver-protected selectors:

- private class fields and method names;
- DOM construction order inside generated JavaScript;
- `data-naos-*` hydration and control markers;
- text marker names such as `text0`;
- node marker names such as `node0`;
- the exact wrapper elements used for control-flow containers.
- the exact template HTML string and clone-hole paths used by the optional
  template DOM backend.

Tests may assert internal markers only to protect hydration behavior. User
docs, demos, and consumer examples must not ask application code to select or
style those markers.

## Local Contract Tests

`crates/naos-core` contains generated-output contract tests for a
representative primitive component. Those tests protect the first batch of
public surfaces: attributes and properties, `CustomEvent` dispatch, parts,
slots, `data-state`, dynamic ARIA, Shadow DOM style injection, Declarative
Shadow DOM output, and DSD-only internal hydration markers.
