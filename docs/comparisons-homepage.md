# Where Naos Fits

*Homepage short version. The long form lives in [Naos in Context](comparisons.md).*

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
| **[Stencil](comparison-stencil.md)** | The closest neighbor — but Naos drops the virtual DOM entirely and authors with functions and signals instead of classes and decorators. |
| **[Lit](comparison-lit.md)** | Same native-element output, without the template runtime: a compiler with JSX and signals instead of tagged templates and reactive properties. |
| **[Solid](comparison-solid.md)** | The same signals you'd reach for in Solid — except the Custom Element is the primary output, not an app rendered into a page. |
| **[Gea](comparison-gea.md)** | Nearly the same pitch, opposite core: Gea patches plain DOM as an app framework; Naos compiles to real Custom Elements. |
| **[React](comparison-react.md)** | Not a rival — a complement. Build components in Naos, consume them in React (and everything else), with no runtime shipped along. |

## The one-sentence version

If a component should outlive the framework that renders it, author it once in
Naos and ship it as a native element — instead of rebuilding it for React, Vue,
and Angular in turn.

---

<sub>Positioning snapshot, July 2026. Naos is a v0.1 prerelease; the tools above
are mature, production projects. Claims about them come from their own docs. See
the [full comparisons](comparisons.md) for the detailed, sourced versions.</sub>
