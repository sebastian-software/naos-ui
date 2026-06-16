# ADR 0011: v0.1 Public API Surface

Status: Accepted

Weight: P1

## Context

The MVP intentionally kept early compatibility paths while the compiler proved
its vertical slice. That left multiple ways to describe the same idea:
function components and legacy `component()`, destructured props and `prop.*()`,
`state()` and `signal()`, plus both `host()` and `useHost()`.

Before v0.1, Iktia is still free to remove this early surface. Keeping it would
turn experimental vocabulary into a public compatibility burden.

## Decision

v0.1 keeps one public authoring path:

* exported PascalCase function components;
* destructured function props;
* `state()` for writable local state;
* `computed()` for derived values;
* `effect()` for lifecycle side effects;
* `event()` for typed `CustomEvent` dispatch;
* `on()` for typed DOM event listeners;
* `host()` for host element access;
* `Show` for explicit conditional control flow;
* narrow typed `.map()` list authoring.

Remove these APIs from the public v0.1 surface:

* `component()`;
* `prop.*()` and `prop()`;
* `signal()`;
* `useHost()`.

`state()` is the public component-state name. Compiler internals may keep signal
or reactive naming, but public docs, examples, diagnostics, and types must use
`state()`.

Event options are split by purpose:

* `event(name, customEventOptions)` controls dispatch.
* `on(type, handler, listenerOptions)` controls listener installation.

## Alternatives

* Keep legacy and new APIs as equally supported.
* Keep `signal()` as the preferred public primitive.
* Keep both `host()` and `useHost()`.
* Remove `Show` and require JavaScript conditionals.

## Consequences

* v0.1 has a smaller public contract.
* Existing local examples must be migrated before prerelease.
* Removed APIs need clear diagnostics while old docs are being updated.
* ADR 0006 remains useful for the reactive model, but its public `signal()`
  naming is superseded by this v0.1 decision.

## Related Milestones

v0.1 M2, M3
