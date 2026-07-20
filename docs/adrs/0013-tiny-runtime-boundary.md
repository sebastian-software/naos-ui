# ADR 0013: Shared Runtime Kernel Boundary

Status: Accepted (revised by RFC 0009)

Weight: P1

## Context

Naos's core promise is native Custom Element output without React, Vue, a
virtual DOM, or a framework runtime. Identical lifecycle, dirty-tracking,
effect-cleanup, prop/attribute, and browser-platform mechanics in every
generated module nevertheless create avoidable parse and memory work.

RFC 0009 changes the earlier narrow reading of this ADR. The runtime may own
invariant execution mechanics through an explicit per-instance kernel record;
the compiler continues to own the component's DOM, bindings, control flow, and
semantic update callbacks.

## Decision

Keep `@naos-ui/runtime` small and split its surface deliberately:

- the package root contains the supported public platform helpers;
- `@naos-ui/runtime/internal` is the compiler-facing, named-helper kernel
  contract used by generated modules.

The internal kernel may provide lifecycle sequencing, prop/attribute plumbing,
dirty tracking, scheduling, computed-cache invalidation, effect cleanup,
listener abort handling, host scopes, constructable-sheet adoption, keyed
record reconciliation, and registration diagnostics. Generated components stay
plain `HTMLElement` subclasses with no Naos base class. They import only the
helpers they use and provide the DOM-specific callbacks and metadata tables.

The runtime must not grow into a framework runtime. It must not add a virtual
DOM, hooks or signals for authors, application services, component loading, or
framework compatibility layers.

## Alternatives

- Inline all helpers into every generated component.
- Keep only platform helpers and retain the duplicated execution machinery.
- Publish a base class or a general component framework.

## Consequences

- Generated output is smaller and less repetitive while retaining native
  Custom Element interoperability.
- The compiler/runtime `./internal` contract receives focused unit and
  compiler-output coverage.
- Runtime review must distinguish shared invariant mechanics from
  component-specific rendering semantics.
- ADR 0004 remains intact: this is not a framework runtime.

## Related Milestones

v0.1 M4, M7; RFC 0009
