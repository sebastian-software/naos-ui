# Dependency Boundary Enforcement Design

Date: 2026-07-12

Status: Approved design

Related: Issue #91, Epic #95, ADR 0023

## Summary

Naos will enforce its one-way package boundary with a hybrid design:

* Oxlint checks JavaScript and TypeScript imports with its native
  `no-restricted-imports` rule.
* A small repository-owned checker validates dependency declarations in
  workspace `package.json` files.
* Both checks share one layer inventory so source and manifest enforcement
  cannot drift apart.

This keeps import parsing in an established OXC tool while retaining coverage
for package metadata that a source linter does not inspect.

## Goals

* Fail CI when a foundation package imports or declares a dependency on an
  outward-facing Naos package.
* Catch declared and undeclared cross-layer edges.
* Make the package layers understandable from the root README.
* Add a conservative JavaScript and TypeScript lint baseline without starting
  an unrelated style migration.
* Keep the enforcement configuration small, explicit, and testable.

## Non-Goals

* Define a complete allowlist for every package-to-package relationship.
* Prevent outward packages from depending on foundations.
* Analyze computed dynamic imports whose target cannot be known statically.
* Replace TypeScript checking, Rust linting, or package-manager validation.
* Introduce dependency-cruiser or a custom JavaScript parser.

## Layer Model

The repository has two enforced package sets.

### Foundations

Foundations implement compiler, authoring, platform, data, and generated-output
mechanics without depending on optional product layers:

* `@naos-ui/core`
* `@naos-ui/runtime`
* `@naos-ui/motion`
* `@naos-ui/data`
* `@naos-ui/compiler`
* `@naos-ui/compiler-*` native packages

Foundation-to-foundation edges remain possible. For example, the compiler
wrapper owns optional dependencies on its native packages. The rule is focused
on outward dependencies, not a frozen graph of every permitted internal edge.

### Outward Layers

Outward packages may depend inward on foundations:

* `@naos-ui/primitives`
* `@naos-ui/router`
* `@naos-ui/vite`
* `@naos-ui/cli`
* `@naos-ui/data-convex`

Examples, docs applications, and future application/framework packages also
sit outside the foundation boundary. Adding a new published package requires
classifying it in the shared inventory. The checker fails when a discovered
public Naos package has no classification, so an unclassified package cannot
silently bypass the rule.

The README will show the direction as:

```text
Applications and examples
          |
          v
Optional layers and adapters
  primitives, router, vite, cli, data-convex
          |
          v
Foundations
  core, runtime, motion, data, compiler
```

Dependencies may point down this diagram or remain within one layer. A
foundation package must never point upward.

## Shared Inventory

One small module under `scripts/` owns:

* foundation package names;
* outward package names;
* foundation source globs;
* helpers for recognizing `@naos-ui/*` subpath imports.

The Oxlint configuration and manifest checker consume this inventory. The
inventory contains policy, not filesystem parsing or lint execution.

Native compiler packages are recognized as one foundation family rather than
copying every target-specific name into several configurations.

## Source Import Enforcement With Oxlint

The repository adds Oxlint as a root development dependency and commits an
`oxlint.config.ts` configuration.

Oxlint's native `no-restricted-imports` rule applies only to foundation source
files through a file override. The generated restriction list covers every
outward package root and its subpaths. It therefore catches:

* static imports;
* type-only imports;
* re-exports;
* string-literal dynamic imports.

Type-only imports remain forbidden because they still couple the foundation's
public build and type graph to an outward package. Computed dynamic imports are
outside the rule's static contract and remain a code-review concern.

Oxlint also runs its conservative default correctness checks across repository
JavaScript and TypeScript. Style, pedantic, and experimental rule categories
are not enabled as part of #91. Any correctness findings caused by adopting the
tool are fixed in this same PR.

The normal lint command becomes one stable entry point for both ecosystems:

```text
pnpm lint
  -> oxlint
  -> cargo clippy
```

## Manifest Dependency Enforcement

Oxlint does not own `package.json` dependency policy. A small Node script reads
workspace package manifests and checks these fields:

* `dependencies`
* `optionalDependencies`
* `peerDependencies`
* `devDependencies`

For each foundation package, an entry targeting an outward package is an
error. Foundation-to-foundation entries remain allowed. Outward packages are
not restricted by this focused rule.

The script also verifies that every discovered published `@naos-ui/*` package
belongs to exactly one layer. Native compiler packages are classified by their
documented family rule.

The checker does not infer architecture from the current dependency graph. The
shared inventory is the explicit contract, while workspace discovery ensures
new packages cannot go unclassified.

## Diagnostics

Both enforcement paths should make the violated edge obvious.

Oxlint diagnostics use the source filename, line, imported package, and a
custom boundary message. The manifest checker prints one deterministic block
per violation:

```text
Dependency boundary violation:
  package: @naos-ui/core
  field: dependencies
  target: @naos-ui/router
  rule: foundation packages cannot depend on outward layers
```

Multiple manifest violations are sorted by package, dependency field, and
target before printing. The command exits non-zero after reporting every
violation.

An unclassified package uses a separate diagnostic so classification drift is
not confused with an illegal edge.

## Testing

The repository adds focused negative coverage for both enforcement mechanisms.

### Source Fixture

An ignored fixture shaped like a foundation source tree imports an outward
package. A Node test invokes Oxlint with the production configuration and
`--no-ignore`, then asserts:

* a non-zero exit status;
* `no-restricted-imports` in the diagnostic;
* the forbidden package and boundary message.

The normal Oxlint run ignores the intentionally invalid fixture.

### Manifest Fixture

The manifest checker exposes a pure validation function. Tests pass it:

* the current valid package inventory;
* a synthetic foundation manifest depending on an outward package;
* a synthetic unclassified public package.

The tests assert deterministic diagnostics and non-zero CLI behavior without
editing real workspace manifests.

### Positive Repository Check

The production command runs against the actual workspace. Its passing result
proves the repository contains no current boundary violations.

## Scripts And CI

Root scripts expose the pieces directly:

* `lint:js` runs Oxlint;
* `lint:rust` keeps the existing Clippy command;
* `lint` runs both;
* `check-dependency-boundaries` runs Oxlint's source boundary and the manifest
  checker;
* `test:dependency-boundaries` runs the focused negative tests.

`pnpm check` includes `check-dependency-boundaries`. The Quality Gates workflow
also runs it as an explicit early step after dependency installation, before
builds and broad test suites. This gives the architectural rule a named CI
failure instead of burying it inside a later aggregate command.

The regular package test workflow includes the focused Node tests so their
fixtures cannot rot.

## README Contract

The root README will place the layer diagram next to the package inventory and
state the rule in one paragraph:

> Optional packages may depend on Naos foundations. Foundations never import
> optional product layers. CI checks both source imports and package manifests,
> so this boundary is enforced rather than conventional.

The package list remains grouped by role so a new evaluator can identify the
small compiler/authoring foundation before reading implementation details.

## Alternatives Considered

### Repository-Owned Import Scanner

A custom scanner could inspect source and manifests in one script. It was
rejected because JavaScript, TypeScript, re-export, and dynamic-import parsing
already belong to Oxlint. Reimplementing that parser would create avoidable
syntax gaps.

### Oxlint Only

Oxlint alone gives strong source coverage through `no-restricted-imports`. It
was rejected as the complete solution because it does not validate dependency
declarations in package manifests.

### Dependency-Cruiser

Dependency-cruiser can model larger dependency graphs. It was rejected for
this focused boundary because Oxlint already supplies the required source rule,
while the remaining manifest check is small and repository-specific.

### Complete Internal Allowlist

A complete matrix would reject every unlisted internal edge. It was rejected
because #91 needs one durable inward boundary, not a frozen model of all future
composition between peer packages.

## Rollout

This is a tooling-only change with no runtime, authoring, or generated-output
migration. The implementation lands in one PR with granular commits for:

1. approved spec and ADR;
2. Oxlint configuration and source fixture;
3. manifest checker and tests;
4. root/CI integration and README layer documentation.

Issue #91 closes only after the remote Quality Gates prove the new named check
and the existing build/test matrix are green.

## References

* [Oxlint `no-restricted-imports`](https://oxc.rs/docs/guide/usage/linter/rules/eslint/no-restricted-imports)
* [Oxlint configuration and overrides](https://oxc.rs/docs/guide/usage/linter/config)
* [Oxlint nested monorepo configuration](https://oxc.rs/docs/guide/usage/linter/nested-config)
