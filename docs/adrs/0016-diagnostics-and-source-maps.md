# ADR 0016: Diagnostics And Source Maps

Status: Accepted

Weight: P1

## Context

Current compiler errors are intentionally plain. v0.1 needs errors that are
useful in direct compiler calls, the Vite plugin, the CLI, and CI logs.

Source maps also belong in the native transform workflow. OXC spans are UTF-8
byte offsets. Replaying edits in JavaScript would introduce UTF-16 index
translation risk and duplicate transform orchestration outside Rust.

## Decision

Compiler failures throw structured errors with `diagnostics[]`.

Each diagnostic contains:

* `code`;
* `severity`;
* `message`;
* `filename`;
* `span`;
* optional `hint`.

`transformComponent()` returns:

```ts
{
  code: string
  map?: SourceMap
  hasChanged: boolean
}
```

Rust owns transform source-map generation. The native transform workflow returns
final code and the optional source map together. JavaScript wrappers and Vite
must not replay Rust transform edits to recreate a source map.

Generated maps use authored statements and expressions preserved in the output
as precise line/column anchors. Lines that are entirely compiler-owned fall back
to the component declaration. This avoids a misleading all-lines-to-1:1 map;
future IR span plumbing can replace individual fallback segments incrementally.

Vite renders diagnostics with filename, span, code, severity, message, and
hint. The CLI uses the same diagnostic structure and exits nonzero when
diagnostics represent failed compilation.

## Alternatives

* Keep plain string errors.
* Return result unions instead of throwing.
* Generate source maps only in the Vite plugin.
* Replay edits in JavaScript through a MagicString-style library.
* Defer source maps until after v0.1.

## Consequences

* Rust compiler internals need stable span plumbing.
* N-API result and error types need generated TypeScript declarations.
* Vite and CLI error rendering can share the same diagnostic model.
* Source-map correctness follows OXC/Rust UTF-8 offsets rather than JavaScript
  UTF-16 indexes.

## Related Milestones

v0.1 M3, M6, M7
