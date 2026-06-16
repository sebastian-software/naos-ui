# ADR 0009: OXC AST Analysis Before API Expansion

Status: Accepted

Weight: P1

## Context

The MVP used simple extraction to prove the vertical slice quickly. Signals,
computed values, effects, control flow, and better diagnostics require more
reliable semantic analysis than string and regex extraction can provide.

## Decision

Move semantic analysis to OXC AST-driven infrastructure before broadening the
v2 API surface too far. Public transform and N-API shapes should remain stable,
but internals should track supported declarations, JSX, imports, spans, and
diagnostics through structured AST data.

## Alternatives

* Keep extending regex and string extraction.
* Add a TypeScript compiler dependency for semantic analysis.
* Defer AST work until after signals, effects, and control flow ship.

## Consequences

* The compiler can produce more deterministic diagnostics.
* Accepted and rejected syntax fixtures become more important.
* Source maps and span-aware errors become more feasible.
* Early refactor cost reduces later API risk.

## Related Milestones

M3, M10, M11, M12, M13, M16

