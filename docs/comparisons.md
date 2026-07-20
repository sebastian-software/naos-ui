# Naos in Context

Naos compiles typed TSX into native Custom Elements: no virtual DOM, no
framework runtime, signals for reactivity, and an optional batteries layer
(accessible primitives, router, data resources, motion) around a narrow
Rust/OXC compiler core.

These pages compare Naos with adjacent tools. Each one is a July 2026 positioning
snapshot written to explain where Naos fits — not to rank a v0.1 prerelease
against mature, production projects. Claims about other tools are drawn from
their own docs.

## The comparisons

| Compared with | Category | The sharpest line |
| --- | --- | --- |
| [Stencil](comparison-stencil.md) | Compile-to-Web-Components | Closest neighbor; Stencil uses a lightweight VDOM and generates framework wrappers, Naos has no VDOM and relies on native interop |
| [Lit](comparison-lit.md) | Web Components library | Lit is a runtime library (no build step) with tagged templates; Naos is a compiler (no template runtime) with JSX + signals |
| [Solid](comparison-solid.md) | Reactive UI library | Shared signal DNA; Solid renders an app into a root, Naos makes the Custom Element the primary output |
| [Gea](comparison-gea.md) | Compiler-first UI framework | Nearly identical vocabulary; Gea patches standard DOM as an app framework, Naos emits native Custom Elements |
| [React](comparison-react.md) | App runtime library | A different corner: React is a VDOM app runtime; Naos is complementary — build components in Naos, consume them in React |

## How to read them

- **Same output target** (Stencil, Lit): the honest question is *how* the element
  is produced and updated.
- **Same reactivity** (Solid, and by extension Gea): the honest question is
  *what gets shipped* and *what the default output is*.
- **Different corner** (React): the honest question is *composition* — Naos and
  React work together more naturally than they compete.

## Recurring themes

Across every comparison, the Naos-specific lines are consistent:

- **Native Custom Elements** as the primary output — Shadow DOM, slots, `part`,
  Declarative Shadow DOM prerender, and a form-associated MVP.
- **No virtual DOM and no framework runtime** in the generated output.
- **Signals** (`state()`, `computed()`, `effect()`) instead of hooks, reactive
  properties, or proxy mutation.
- A **Rust/OXC compiler core** behind a thin TypeScript surface.
- A **narrow core plus optional batteries** boundary that CI enforces —
  foundations never import product layers.
- A candid **v0.1 prerelease** status.
