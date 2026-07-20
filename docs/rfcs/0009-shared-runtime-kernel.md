# RFC 0009: Shared Runtime Kernel for Generated Components

Status: Implemented
Date: 2026-07-20

## Summary

Move the invariant machinery that the compiler currently duplicates into every
generated component — flush pipeline, dirty tracking, host update scopes,
effect cleanup, event listener abort management, prop/attribute plumbing,
keyed-list reconciliation, style adoption, and element registration — into
`@naos-ui/runtime` as a set of small, individually importable functions that
operate on a per-instance state record (the "kernel").

Generated Custom Elements stay thin `HTMLElement` shells. There is no base
class and no inheritance surface. Each generated module imports only the
helpers its component actually uses, so bundlers tree-shake the runtime per
application.

This RFC supersedes the strict reading of ADR 0013 that keeps all component
machinery in generated output, and proposes the matching revisions to
ADR 0013 and `docs/runtime-boundary.md`.

## Motivation

Measurements of the current compiler output (all 16 example components from
`examples/counter` and `examples/tasks`, compiled with `naos-core` at
`e1930db`):

- Generated output is 5–17× the authored TSX. A purely static 17-line
  component (`board.wc.tsx`, 385 B source) compiles to 6.4 KB; a small
  interactive component (`toggle.wc.tsx`, 1.6 KB source) compiles to 19 KB
  unminified (8.8 KB minified, 3.2 KB min+gzip).
- 3.3 KB of every generated module — 26 complete methods — is byte-identical
  across all 16 components. For small components that is up to 52 % of the
  file. Near-identical name-parameterized patterns (prop getters/setters, the
  `host()` factory, event abort boilerplate, keyed-list reconciliation, the
  inline attribute set/remove sequence) push the real duplication share
  substantially higher.
- Extrapolated to `@naos-ui/primitives` (44 components today), a full bundle
  carries roughly 65 KB of duplicated minified boilerplate that could ship
  once as a shared ~5 KB (minified; ~2 KB gzip) runtime.
- Gzip deduplicates identical blocks inside a single bundle (16 concatenated
  modules compress to 19 KB versus 53 KB summed individually), but that only
  helps transfer within one bundle. Parse time, JIT work, and memory scale
  with uncompressed size, and per-module delivery (CDN, import maps,
  micro-frontends) gets no cross-module benefit.

Typical consumers use a handful to a few dozen Naos components. Regenerating
identical machinery per component penalizes exactly that mainstream case.

## Existing Constraints

- ADR 0004: Naos does not ship a framework runtime. No virtual DOM, no
  reconciler-as-framework, no hook semantics at runtime.
- ADR 0013: `@naos-ui/runtime` is a tiny platform-helper package; component
  semantics stay in generated output. This RFC proposes revising the boundary
  line, not the framework-free posture.
- `docs/runtime-boundary.md` currently disallows "component lifecycle
  ownership" and "reconciliation" in the runtime. Both lines move under this
  RFC (see Required Document Revisions).
- Generated components must keep working as plain Custom Elements consumable
  from any framework or none.

## Design

### Kernel record instead of a base class

`customElements.define` requires an `HTMLElement` subclass, so a class shell
remains — but it stays mechanical. The compiler emits:

```js
import {
  K,
  createKernel,
  connect,
  disconnect,
  attrChanged,
  defineProps,
  defineComponent,
  lazySheet,
} from "@naos-ui/runtime/internal"

const SPEC = {
  defaults: { disabled: false, label: "Toggle" },
  props: {
    /* coerce/reflect per prop */
  },
  attrs: {
    /* parse per observed attribute */
  },
  styles: lazySheet([css]),
  initState(k) {
    k.state.pressed = false
  },
  mount(k) {
    /* component-specific DOM construction */
  },
  update(k, dirty) {
    /* component-specific guarded updates */
  },
  effects(k, dirty) {
    /* component-specific effect bodies */
  },
}

class ToggleElement extends HTMLElement {
  static observedAttributes = ["disabled", "label"]
  constructor() {
    super()
    this[K] = createKernel(this, SPEC)
  }
  connectedCallback() {
    connect(this[K])
  }
  disconnectedCallback() {
    disconnect(this[K])
  }
  attributeChangedCallback(n, o, v) {
    attrChanged(this[K], n, o, v)
  }
}
defineProps(ToggleElement, SPEC)
defineComponent("naos-toggle", ToggleElement, META)
```

The kernel is a plain per-instance record (`dirty`, `props`, `state`, abort
controllers, computed cache, node references) stored on the element under a
runtime-private `Symbol`. All shared machinery is free functions over that
record: `markDirty(k, source)`, `flush(k)`, `shouldUpdate(deps, dirty)`,
`reconcileKeyed(...)`, `setAttr(node, name, value)`, `stateAccessor(k, name)`,
`computedAccessor(k, name, fn)`, `emitter(k, name)`, `hostApi(k)`,
`listen(k, node, type, handler)`, `runEffect(k, index, dirty, deps, body)`.

What stays generated per component: the prop/attribute spec data, DOM
construction, guarded update statements with their dependency lists, binding
wiring, and event/effect bodies. Component semantics remain a compile-time
product; the runtime only executes the mechanics.

### Why functions, not a base class

Both designs were prototyped feature-equivalently and measured (esbuild,
minified; Node 22 micro-benchmark; details in the appendix):

- Performance is a wash: 4 million flush cycles across 20 000 instances differ
  by ~2 % (within noise); heap per instance is equal (~440 B for the mirrored
  pipeline state). Both shapes are monomorphic with shared function objects,
  and real cost is dominated by DOM work.
- Size favors functions where it matters. A base class is atomic for
  tree-shaking: every component drags the entire class, including machinery it
  never uses. With free functions the bundler keeps only what a component
  imports. Measured: static component + runtime bundled is 3.3 KB (functions)
  versus 5.2 KB (base class); the interactive toggle is 7.7 KB versus 8.4 KB.
  Marginal per-component cost in a shared-runtime bundle is equal (the
  functional shell repeats four thin callback methods, ~200 B minified).
- No inheritance surface. The base-class variant needs a protected-style
  member contract (`_naos*` prefixes typed `protected` in `.d.ts`) and a
  compiler diagnostic against prop names colliding with base members.
  TypeScript `protected` is compile-time only, so that contract is convention
  at runtime. The kernel has none of these problems: the record hides behind a
  `Symbol`, helpers live in an internal entry point, and the element's public
  surface is exactly its props.
- Modularity scales with future features. New capabilities (forms/FACE,
  motion, context, overlay) become additional helper modules that only
  importing components pay for — a base class would grow monotonically for
  everyone.

### Packaging and versioning

- Helpers ship from `@naos-ui/runtime/internal`. The specifier is public (the
  generated code imports it) but documented as a compiler-output contract, not
  an application API, with no semver guarantees for hand-written callers.
- Generated packages declare `@naos-ui/runtime` as a regular dependency with a
  caret range; bundlers deduplicate. Cross-package sharing on one page works
  because nothing depends on class identity — there is no `instanceof`
  coupling between runtime versions.
- The existing per-tag registration guard (package name/version metadata)
  continues to arbitrate duplicate registrations.

### Standalone mode

The zero-dependency story remains available: a compiler flag (working name
`--standalone`) keeps inlining the helpers into the generated module for
single-component drops where a dependency is unwanted. Default output uses the
shared runtime.

## Migration Plan

The change is incremental per helper; each phase keeps conformance green.

1. Use what exists: emit `createNaosEvent` instead of inline
   `new CustomEvent(...)` (the helper is exported today but unused by
   codegen); add `setAttr` and replace the inline attribute set/remove
   sequences.
2. Move the pure functions: `shouldUpdate`, `reportError`, `ensureHostId`,
   `lazySheet`, registration (`defineComponent` with metadata guard).
3. Introduce the kernel record: constructor/`connectedCallback`/
   `disconnectedCallback`/`attributeChangedCallback` become shell calls;
   flush pipeline, host update scopes, effect cleanup, and event abort
   management move behind `connect`/`disconnect`/`flush`.
4. Data-drive props: emit the `SPEC.props`/`SPEC.attrs` tables and generate
   getters/setters via `defineProps`.
5. Move `reconcileKeyed` (generic cursor/insert/remove walk; per-component
   record build and patch stay generated callbacks).
6. Hydration helpers (`requiredHydrationElement`, `requiredHydrationText`,
   remount fallback) move last, together with the DSD conformance fixtures.

Independent follow-up (any variant): stop recreating the full bindings object
on every flush and event dispatch; bind lazily or cache per instance.

## Required Document Revisions

- ADR 0013: replace "component lifecycle runtime" in the disallowed list with
  "framework runtime (virtual DOM, reconciler-as-framework, hook semantics,
  cross-framework adapters)"; allow "shared execution mechanics for generated
  output, imported per function". Record this RFC as the superseding context.
- `docs/runtime-boundary.md`: rewrite the inventory around the kernel helper
  set; keep the review checklist, adding "must be individually importable and
  tree-shakeable" and "must not require an inheritance relationship".
- `README.md` / docs positioning: "no framework runtime" stays; phrase the
  runtime as a small library of platform functions that generated components
  import à la carte.

## Alternatives Considered

- Status quo (inline everything): rejected by measurement; 5–17× output
  factors and per-component duplication penalize the mainstream multi-
  component case. The gzip counter-argument only covers single-bundle
  transfer, not parse/memory or per-module delivery.
- Abstract base class `NaosElement`: rejected — equal performance, worse
  tree-shaking, all-or-nothing coupling, needs a protected-member convention
  and collision diagnostics, and contradicts the project's functional lean.
- Bigger runtime (signals/scheduler as a reactive framework): out of scope;
  ADR 0004 stands. Reactivity semantics remain compiled, not interpreted.

## Acceptance Criteria

- Generated output for the existing conformance fixtures shrinks by at least
  40 % unminified once phases 1–5 land, with unchanged fixture behavior.
- `@naos-ui/runtime` stays under ~6 KB minified for the full helper set, and
  a static component bundled with the runtime stays under ~4 KB minified.
- No generated module contains a copy of a helper that the runtime exports
  (enforced by an output test), except under `--standalone`.
- Runtime helpers ship with focused unit tests; compiler output tests cover
  every emitted helper import.
- ADR 0013 and `docs/runtime-boundary.md` revisions land in the same change
  set as phase 3.

## Appendix: Measurements (2026-07-20)

Corpus: 16 example components compiled at `e1930db`. The prototype sources,
the benchmark harness, and the exact esbuild/gzip invocations are preserved
in [`assets/0009-shared-runtime-kernel/`](assets/0009-shared-runtime-kernel/).

Current output per component (minified: esbuild 0.24 `--minify --format=esm`,
CSS/cross-module imports stubbed or external; gzip -9):

| Component        | Source  | Generated | Factor | Minified | Min+gzip |
| ---------------- | ------- | --------- | ------ | -------- | -------- |
| `board` (static) | 385 B   | 6 381 B   | 16.5×  | 3 042 B  | 1 421 B  |
| `status-badge`   | 436 B   | 7 360 B   | 16.8×  | 3 537 B  | 1 573 B  |
| `toggle`         | 1 628 B | 19 012 B  | 11.6×  | 8 839 B  | 3 180 B  |
| `task-list`      | 2 843 B | 22 284 B  | 7.8×   | 10 558 B | 3 570 B  |

Duplication: 26 byte-identical chunks, 3 307 B, present in all 16 modules
(52 % of `board`, 17 % of `toggle`). Sum of all 16 modules: 217 KB; with the
identical share emitted once: 168 KB.

Prototype A/B (feature-equivalent, esbuild `--bundle --minify`, gzip -9).
The "Current output" row is the component alone with everything inlined —
that is the whole bundle today, so it reads against the "+ runtime" rows,
which already include the full shared runtime; every additional component
then costs only the marginal row:

| Scenario                               | Base class         | Functional kernel  |
| -------------------------------------- | ------------------ | ------------------ |
| Current output (`toggle`, all inlined) | 8 839 B (3 180 gz) | —                  |
| Runtime alone                          | 4 788 B (2 009 gz) | 4 836 B (2 143 gz) |
| Static component + runtime             | 5 180 B (2 168 gz) | 3 270 B (1 513 gz) |
| Toggle + runtime                       | 8 410 B (3 069 gz) | 7 720 B (3 043 gz) |
| Marginal component (runtime external)  | 539–3 769 B        | 742–3 670 B        |

The prototypes omit the hydration/DSD paths in both variants, so the A/B
comparison is internally consistent while absolute sizes are indicative.

Micro-benchmark (Node 22 `--expose-gc`, mirrored flush pipeline without DOM;
20 000 instances × 200 update cycles per run, median of 5 interleaved runs;
heap measured as `heapUsed` delta across 50 000 retained instances after
forced GC): class 1 056 ms, kernel 1 078 ms; creation 4.9 ms both; heap per
instance 448 B versus 440 B.
