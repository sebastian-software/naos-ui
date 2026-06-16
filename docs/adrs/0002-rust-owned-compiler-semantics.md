# ADR 0002: Rust-Owned Compiler Semantics

Status: Accepted

Weight: P0

## Context

The project is intentionally built on existing Rust infrastructure and OXC.
TypeScript owns authoring ergonomics and host integration, but compiler
correctness should not drift between JavaScript wrappers and Rust internals.

## Decision

Rust owns compiler semantics: parsing, semantic analysis, validation,
diagnostics, transform decisions, and code generation. TypeScript wrappers call
the native workflow through a typed boundary and should not reimplement compiler
logic.

## Alternatives

* Implement analysis and codegen in TypeScript.
* Split semantic decisions between Rust and TypeScript.
* Use Rust only for parsing performance and keep transform policy in the Vite
  plugin.

## Consequences

* The Rust core becomes the source of truth for accepted syntax and generated
  behavior.
* The N-API boundary should remain coarse and typed.
* TypeScript tests must validate authoring types, while Rust tests validate
  compiler semantics.
* Future source maps and span diagnostics should be implemented in the Rust
  transform path.

## Related Milestones

M1, M3, M4, M5, M16

