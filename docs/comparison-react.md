# Naos and React

React is a different corner of the map, and this page says so up front. React is
the incumbent **application** library — a virtual-DOM component runtime shipped
to every app. Naos is a **compiler** that emits framework-neutral Custom
Elements. They are not competing for the same slot, and Naos does not try to be
a React replacement or a React-compatibility layer.

The comparison is still worth having, because most people evaluating Naos are
coming *from* React — and the most useful framing is **complementary**, not
either/or.

> Positioning snapshot from July 2026. Naos is a v0.1 prerelease; React is the
> most deployed UI library in the world. This page explains where Naos fits
> relative to React, not a ranking.

## At a glance

| | **Naos** | **React** |
| --- | --- | --- |
| Kind | Compiler → native Custom Elements | Runtime library → app rendered into a root |
| Output ships to consumers | Generated element code; **no framework runtime** | The **React runtime** (react + react-dom) |
| Virtual DOM | None | Yes |
| Reactivity | Signals: `state()`, `computed()`, `effect()` | Hooks + re-render (`useState`, `useMemo`, `useEffect`) |
| Update model | Direct DOM updates on changed bindings | Re-run component, diff virtual DOM, commit |
| Authoring | PascalCase functions → custom elements | Function components + hooks |
| JSX | Yes (compiled to DOM code) | Yes (compiled to `createElement` / runtime) |
| Distribution contract | The Custom Element tag, framework-neutral | A React component (used inside React) |
| Interop | Consumed by **any** framework, incl. React 19 | Consumes custom elements well as of React 19 |
| Batteries | Optional layer: primitives, router, data, motion | Vast ecosystem (Router, Query, Next.js, etc.) |
| Maturity | v0.1 prerelease | Industry standard |

## The honest framing: complementary, not rival

A React developer does not have to *choose* Naos over React. The natural pattern:

- **Build** your design system or embeddable widgets in **Naos**, compiled to
  native Custom Elements.
- **Consume** them in your **React** app (and Vue, Angular, plain HTML, a CMS).
  React 19 materially improved hosting Custom Elements — passing props,
  attributes, and events works cleanly now, which was the long-standing blocker.

So Naos is not "instead of React"; it is a way to ship UI that outlives any one
framework, including the React app that uses it. Naos's own docs put it plainly:
it is **"not a React compatibility layer"**, and its React review states **"the
goal is not React compatibility."**

## What feels familiar coming from React

- **JSX/TSX** and **function components** — the surface is recognizable.
- Componentized, typed authoring.
- Naos even borrows React 19's **Actions / forms** ideas — HTML-first forms,
  async mutation state, pending status, optimistic updates — but reshapes them as
  **signal-shaped** primitives (a planned `formAction()` exposing `state()`,
  `pending()`, `data()`, `error()`), **not** hook-shaped ones, and with no
  rules-of-hooks and no React Server Components dependency.

## Where they fundamentally differ

### Runtime vs. no runtime

React ships **react + react-dom** to every app; components are functions the
runtime re-invokes, producing a virtual DOM that is diffed and committed. Naos
compiles components ahead of time to **direct custom-element code** — there is no
virtual DOM and no framework runtime handed to the consumer.

### Reactivity: hooks vs. signals

- **React**: state changes trigger a **re-render** of the component; you manage
  dependency arrays (`useMemo`, `useEffect`) and the rules of hooks.
- **Naos**: **signals** update only the exact text nodes and attributes that
  depend on them — no re-render, no dependency arrays, no hook ordering rules.

### The unit you distribute

- **React**: a React component, meaningful **inside React**.
- **Naos**: a **standards-based Custom Element** — a `<my-el>` tag that any
  environment can use without knowing Naos or React exists.

### Scope

React is a library; applications are assembled from a vast third-party ecosystem
(Router, Query, Next.js). Naos ships its own smaller optional layer — router,
data resources, motion, accessible primitives — around a narrow compiler core,
and does not aim to be a general application framework.

## Side by side

**Naos** — a function compiled to a Custom Element:

```tsx
import { state } from "@naos-ui/core"

export function Counter() {
  const count = state(0)
  return (
    <button onClick={() => count.set(count() + 1)}>
      Count: {count()}
    </button>
  )
}
```

**React** — a function component with hooks, rendered by React:

```tsx
import { useState } from "react"

export function Counter() {
  const [count, setCount] = useState(0)
  return (
    <button onClick={() => setCount(count + 1)}>
      Count: {count}
    </button>
  )
}
```

Same JSX shape; different machinery. React re-runs `Counter` and diffs a virtual
DOM on each click. Naos updates just the one text node, and the compiled result
is a native element a React app can then embed as `<…-counter>`.

## Which one fits

Reach for **React** when:

- you are **building an application** and want the largest ecosystem, hiring
  pool, and framework tooling (Next.js, Router, Query, RSC)
- your team is deep in hooks and the React mental model
- you do not need framework-neutral, runtime-free component distribution

Reach for **Naos** when:

- you need **framework-neutral components** — a design system or widget that a
  React app (and everything else) can consume as a native tag
- you want **no framework runtime** shipped to each consumer, and **no virtual
  DOM**
- you prefer **signals** over hooks and re-renders
- you are comfortable adopting a **v0.1 prerelease**

Often the answer is **both**: Naos for the shared, long-lived component layer;
React for the application that consumes it.

## Honest caveats

- Naos is a **v0.1 prerelease** and is **not** a drop-in React replacement: no
  hooks ecosystem, no React Server Components, no Next.js-style full stack.
- "No virtual DOM" is an architectural difference, not a blanket performance
  claim for every workload.
- React 19's custom-element support is good but not identical across every edge
  case; validate interop for your specific props/events.
- Treat this as a July 2026 snapshot and re-check current docs.

## Sources

- Naos: this repository's [README](../README.md), [docs](README.md), and
  [React 19 adaptation review](react-19-adaptation.md)
- React: <https://react.dev/>
- React 19 release notes (incl. Custom Elements support):
  <https://react.dev/blog/2024/12/05/react-19>
