# ADR 0020: Owned Compiler IR Lowered From OXC AST

Status: Accepted

Weight: P1

## Context

ADR 0009 chose OXC for compiler analysis, but the implementation still kept a
raw JSX return string and parsed it again during code generation. Reactive
dependencies and module facts used additional character-level scans. That
split made valid TSX details such as comments, regular-expression literals,
entities, and lexical callback bindings easy to misread. It also made one
source construct pass through several unrelated parsers.

## Decision

The compiler lowers supported OXC AST nodes into owned, serializable compiler
IR before code generation. The root JSX tree, authored attributes, text, and
expressions cross the analysis boundary as structured data, not raw template
source.

Reactive dependency detection parses expressions with OXC and walks the AST.
It treats parse failure as an unknown dependency set, which safely schedules a
broad update. The visitor respects lexical bindings in arrow and classic
function callbacks. Module options, style expressions, removed authoring APIs,
and `host()` usage are likewise derived from OXC nodes.

The remaining nested control-flow lowering follows the same boundary: no
production code generator path may re-parse TSX text once the migration is
complete.

## Alternatives

* Keep the existing template parser and strengthen its token scanning.
* Re-parse each JSX expression or control-flow callback independently.
* Use a TypeScript compiler dependency for selected semantic queries.

## Consequences

* Correct TSX semantics are centralized in OXC instead of being replicated in
  compiler-local string scanners.
* Unsupported syntax remains explicit and span-aware instead of falling
  through to parser accidents.
* The IR is an owned boundary that can be tested directly and later consumed by
  alternate code generators.
* The migration temporarily touches analysis, code generation, tests, and
  compiler documentation together; it therefore ships as one coherent PR.

## Related Milestones

Issues #92, #98, #99; Epic #95; Epic #123
