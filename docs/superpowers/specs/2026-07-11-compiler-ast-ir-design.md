# Compiler AST-to-IR foundation design

Status: Implemented

Related issues: #92, #98, #99, #95, #123

## Problem

Naos parses every component with OXC, then discards important structure. The
current analyser stores the returned JSX as `template_source: String`; codegen
re-parses it with `TemplateParser`. Reactive dependency detection and several
module checks then scan expression or module text character by character.

That creates three copies of JavaScript and JSX syntax knowledge. It also makes
comments, regexes, member expressions, string literals, and spans easy to
mis-handle. The implementation conflicts with ADR 0009's AST-first direction
and makes the compiler harder to extend safely.

## Goals

* Parse TypeScript and TSX once with OXC, then lower the required semantics into
  an owned compiler IR.
* Make generated-template code and reactive dependency metadata consume that
  IR, not source-slice parsers or identifier scanners.
* Preserve current supported output unless a fixture documents an intentional
  improvement.
* Replace AST-addressable module string scans for component options, styles, and
  removed authoring APIs.
* Make keyed-list renderer invariants unrepresentable instead of relying on
  `expect()` or `unreachable!()` in production code.
* Keep syntax ownership in OXC so #96/#97 can extend source-map and diagnostic
  metadata without reintroducing a second TSX parser.

## Non-goals

* Implement source maps or Vite diagnostic overlays (#96 and #97).
* Broaden the supported TypeScript, JSX, control-flow, or runtime API surface.
* Preserve accidental output from unsupported syntax. Such changes need either
  a documented diagnostic or an explicit fixture-approved improvement.

## Decision

Deliver #92, #98, and the AST-aligned portions of #99 as one compiler
foundation PR. Do not add an intermediate expression re-parser that would
preserve the second parser until #98.

### Owned IR boundary

OXC AST nodes borrow the parser allocator and cannot cross the compiler's
long-lived model boundary. `ast.rs` will therefore lower them immediately into
owned model types:

* `TemplateNode`, `TemplateElement`, attributes, children, and control-flow
  nodes represent supported JSX structure.
* Authored expressions retain the exact source text needed by code generation;
  dependency facts are derived by an OXC expression walk.
* Dependency resolution produces either a deterministic set of state/prop
  sources or `Unknown`, which keeps the conservative update behavior.
* Keyed-list variants carry their required typed key value in the variant that
  needs it, so an item-keyed renderer cannot exist without a key.

This is an owned, serializable compiler IR, not a public API. It protects the
ownership boundary without cloning OXC subtrees or keeping allocator lifetimes
alive through code generation.

### Lowering and dependency resolution

The AST analyser will lower supported OXC `JSXElement`, JSX fragment, JSX text,
expression container, and recognised control-flow forms directly. It will
produce the same expression source substrings as today, but those substrings
are evidence attached to structured AST nodes rather than inputs to a JSX
parser.

For every reactive expression, an OXC visitor records identifier references and
direct call sites. A resolution pass then maps those facts to props, states,
computed values, and keyed selectors. Computed dependencies recurse through
the same resolved metadata with cycle detection. Unknown direct calls resolve
to `Unknown`; member calls and non-reactive global calls follow the existing
conservative semantics. Parse or lowering uncertainty must select `Unknown` or
return a structured compiler diagnostic, never panic.

The lexical dependency scanner is removed. A checked-in conformance fixture
freezes exact generated dependency guards for comments, template literals,
regex literals, computed dependencies, and lexical callback bindings.

### Module facts and error handling

The same module traversal will resolve:

* `export const options` and its `styles` bindings;
* removed authoring calls such as `signal()` and `useHost()`;
* removed `prop` usages without matching comments, strings, or longer
  identifiers.

Unsupported or internally inconsistent shapes produce `CompilerError` values
with spans. No new production `unwrap`, `expect`, `unreachable!`, or panic
path is permitted. Invariants that can be expressed in enum structure are
encoded in types instead.

### Code generation

`codegen.rs` consumes the owned template and reactive-expression IR. The
hand-written `TemplateParser`, template-source delimiter helpers, identifier
scanner, and module-wide substring checks are removed. Generated JavaScript
continues to use exact authored expression text where source preservation is
necessary.

The new IR spans are retained in codegen output metadata, but source-map
emission itself remains scoped to #96.

## Golden corpus and tests

Add checked-in fixture pairs that name the input and expected generated output
or dependency result. The corpus includes all existing accepted conformance
components plus focused cases for:

* comments and string literals that resemble helper calls;
* template literal interpolations and nested expressions;
* direct calls, member calls, optional calls, and computed dependencies;
* JSX comments, regex braces, and JSX text/entity semantics;
* options/style bindings and removed-API false positives;
* keyed-list renderer construction and malformed/unsupported forms.

The conformance suite records exact expected dependency guards for its focused
AST edge-case fixture. Intentional improvements are documented in the fixture
expectation and ADR. A source-level invariant test prevents the legacy parser
or production panic paths from returning.

## Alternatives considered

### AST walker only for #92, followed by a later template rewrite

Rejected. It leaves a second parser in production and requires the same
reactive expression boundary to be redesigned again for #98.

### Retain OXC nodes in `ComponentModule`

Rejected. OXC nodes borrow allocator-owned data. Extending those lifetimes into
the model would couple codegen to parser allocation and make serialization and
testing brittle.

### Make the existing scanners more comment-aware

Rejected. It treats individual syntax gaps but retains three independent
parsers and cannot provide durable span ownership.

## Architecture decision record

Add ADR 0020, **Owned compiler IR lowered from OXC AST**, with this delivery.
It records the AST-to-owned-IR boundary, conservative unknown dependency rule,
and the rule that syntax-sensitive compiler behavior belongs in AST traversal.

## Validation

The implementation must pass:

```sh
cargo fmt --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test --workspace
pnpm check
pnpm test
pnpm verify:fresh-project
```

The compiler tests must prove that production sources no longer contain
`TemplateParser` or the lexical dependency scanner and that every golden-corpus
fixture has an explicit expected result.

## Rollout

This is an internal compiler implementation change. It ships in the same v1
contract train as #95, with no consumer migration. The PR closes #92, #98, and
the covered portions of #99 only after the full corpus and browser CI pass.
