# ADR 0023: Oxlint-Enforced Dependency Boundaries

Status: Accepted

Weight: P0

## Context

Naos deliberately separates its compiler and platform foundations from
optional component, adapter, and application layers. The current repository
respects that direction, but conventions do not stop a future source import or
`package.json` dependency from reversing it.

Source syntax and package metadata need different enforcement. Oxlint has a
native `no-restricted-imports` rule with file overrides, patterns, re-export
support, and string-literal dynamic-import support. It does not validate
workspace dependency declarations.

## Decision

Naos will enforce one focused rule: foundation packages cannot depend on
outward layers.

Oxlint owns JavaScript and TypeScript source analysis. A root
`oxlint.config.ts` applies `no-restricted-imports` to foundation source globs
and forbids outward package roots and subpaths. Type-only imports are included.

A small repository-owned Node checker validates all dependency fields in
workspace package manifests. It also fails when a published Naos package has no
layer classification.

Both tools consume one shared inventory of foundation and outward packages.
Native compiler packages are treated as one foundation family.

Oxlint becomes the repository's conservative JavaScript and TypeScript linter.
This decision adopts default correctness checks but does not enable style,
pedantic, or experimental categories.

The root check and CI expose dependency-boundary enforcement as a named gate.
Negative fixtures prove that both source imports and manifest edges fail.

## Alternatives

* Build one custom source and manifest scanner. This would duplicate parsing
  already provided by OXC and risk missing valid JavaScript or TypeScript import
  forms.
* Use Oxlint alone. This would leave `package.json` dependency edges
  unenforced.
* Add dependency-cruiser. Its general graph engine is unnecessary for the one
  focused boundary retained by this decision.
* Encode a complete allowlist of all internal edges. This would constrain peer
  package composition beyond the architectural promise being protected.

## Consequences

* A foundation-to-outward source import fails with a file-level Oxlint
  diagnostic.
* A declared foundation-to-outward dependency fails even when no source file
  imports it yet.
* New published packages must declare their layer in the shared inventory.
* Developers gain a fast JS/TS correctness lint baseline based on the same OXC
  project family used by the Naos compiler.
* Computed dynamic imports remain outside static enforcement.
* The repository retains a small custom manifest checker, but no custom source
  parser.

## Related Work

Issue #91; Epic #95; ADR 0002; ADR 0003; ADR 0004; ADR 0013; ADR 0019
