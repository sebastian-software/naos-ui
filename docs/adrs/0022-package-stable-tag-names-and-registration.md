# ADR 0022: Package-Stable Tag Names And Registration

Status: Accepted

Weight: P1

## Context

Custom element names appear in HTML, CSS selectors, tests, and router
configuration. They are public output even when the generated JavaScript class
is an implementation detail.

Naos previously derived a tag only from the component export and added `x-` to
single-word names. Unrelated packages could therefore claim the same global
custom element name. The generated registration guard kept the first
constructor but provided no explanation when it skipped another definition.

Package version cannot solve the collision. Including a version in the tag
would rename every consumer-facing element on every release. Supporting two
versions of one component package in one global registry would also require a
different architecture that Naos does not intend to provide.

## Decision

Every generated tag is namespaced by its npm package. The default prefix is the
complete normalized package name. A package may declare one concise override at
`package.json#naos.tagPrefix`. Package-local config is the only prefix source;
Vite flags, CLI flags, and component-local options cannot override it.
If the complete prefix is already the component export's exact leading token
sequence, it is not repeated: `naos` plus `NaosButton` is `naos-button`. Naos
does not apply broader word-deduplication heuristics.

The package version is attached to generated constructor metadata and manifest
entries for diagnostics, but it never participates in tag derivation. Tags are
therefore identical across package versions.

The Node compiler boundary resolves and validates the nearest `package.json`
and passes owned package context to the host-neutral Rust compiler. Rust does
not read the filesystem.

The existing `naos-manifest.json` becomes the deterministic normal-build
manifest. Vite emits it independently of DSD, and package builders use the same
manifest types and serializer. DSD enriches the same component entry.

Generated registration uses metadata stored under
`Symbol.for("naos.component.metadata")`. The first constructor wins. An exact
or same-package/same-version duplicate is silent; a version, package, or unknown
ownership conflict emits a clear warning and never attempts a second
`customElements.define()` call.

This is a direct pre-release cutover. Naos does not generate old `x-*` aliases,
version suffixes, hashes, or migration machinery.

## Alternatives

* Use only the unscoped package segment. This is shorter but allows unrelated
  scopes to collide.
* Add a short hash. This reduces length but makes tags harder to read and
  explain.
* Configure prefixes separately in Vite, CLI, or component options. This lets
  one package compile to different public contracts.
* Add the package version to every tag. This makes every release a tag rename.
* Silently keep the current constructor. This preserves runtime behavior but
  hides the dependency-resolution problem from developers.
* Suffix conflicting tags or support scoped registries. That implicitly
  supports duplicate package versions, which is outside the product contract.

## Consequences

* Package ownership is visible in every default tag.
* Existing package-qualified component exports do not duplicate the exact
  package prefix in their tags.
* A package rename or prefix override change is an explicit breaking change.
* Normal builds expose a stable machine-readable component-to-tag mapping.
* Duplicate versions fail loud without breaking page startup.
* Rust stays deterministic and portable across Node, Vite, CLI, and tests.
* Repository fixtures and consumer HTML must move atomically to the new names.
* A later Custom Elements Manifest adapter can consume the Naos manifest rather
  than rediscover compiler output.

## Related Work

Issue #94; Epic #95; ADR 0001; ADR 0002; ADR 0003; ADR 0010; ADR 0016; ADR 0019;
ADR 0020
