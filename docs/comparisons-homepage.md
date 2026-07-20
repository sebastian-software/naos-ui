# Where Naos Fits

*Homepage short version — condensed copy for the landing page. The full pages
live in the Ardo site under the **Comparisons** section
(`sites/docs/app/routes/comparisons/`), starting at `comparisons/overview`.*

Naos compiles typed TSX into **native Custom Elements** — no virtual DOM, no
framework runtime, signals for reactivity, and an optional batteries layer
(accessible primitives, router, data, motion) around a small Rust/OXC compiler
core.

Here is how that lands next to the tools you already know.

## What makes Naos, Naos

- **Native Custom Elements** as the output — Shadow DOM, slots, `part`,
  Declarative Shadow DOM, form-associated. Ship one tag; use it anywhere.
- **No virtual DOM, no runtime** handed to consumers.
- **Signals**, not hooks or reactive properties: read by calling, update only
  what changed.
- **Rust/OXC compiler** behind a thin TypeScript surface.
- **Narrow core, optional batteries** — and CI keeps them separate.

## Naos vs. …

| | In one line |
| --- | --- |
| **[Stencil](../sites/docs/app/routes/comparisons/stencil.mdx)** | The closest neighbor — but Naos drops the virtual DOM entirely and authors with functions and signals instead of classes and decorators. |
| **[Lit](../sites/docs/app/routes/comparisons/lit.mdx)** | Same native-element output, without the template runtime: a compiler with JSX and signals instead of tagged templates and reactive properties. |
| **[Solid](../sites/docs/app/routes/comparisons/solid.mdx)** | The same signals you'd reach for in Solid — except the Custom Element is the primary output, not an app rendered into a page. |
| **[Gea](../sites/docs/app/routes/comparisons/gea.mdx)** | Nearly the same pitch, opposite core: Gea patches plain DOM as an app framework; Naos compiles to real Custom Elements. |
| **[React](../sites/docs/app/routes/comparisons/react.mdx)** | Not a rival — a complement. Build components in Naos, consume them in React (and everything else), with no runtime shipped along. |

On the rendered site these link to `comparisons/stencil`, `comparisons/lit`,
`comparisons/solid`, `comparisons/gea`, and `comparisons/react`.

## The one-sentence version

If a component should outlive the framework that renders it, author it once in
Naos and ship it as a native element — instead of rebuilding it for React, Vue,
and Angular in turn.

---

<sub>Positioning snapshot, July 2026. Naos is a v0.1 prerelease; the tools above
are mature, production projects. Claims about them come from their own docs. The
detailed, sourced versions are the `comparisons/*` pages in the Ardo site.</sub>
