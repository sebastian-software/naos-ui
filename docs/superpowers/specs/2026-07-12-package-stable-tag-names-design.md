# Package-Stable Tag Names, Manifest, And Define Guard

Date: 2026-07-12

Status: Approved design

Related: Issue #94, Epic #95, ADR 0022

## Purpose

Custom element tag names are public output. Consumers place them in HTML, CSS,
tests, and router configuration, so a release must not silently rename them.
Naos currently derives names only from the component export and adds `x-` to a
single-word name. That rule is unaware of package ownership and can collide
across unrelated libraries.

This design makes the package the stable namespace for every generated tag,
exports the resolved contract as build metadata, and turns duplicate
registration into a precise first-wins diagnostic.

## Goals

* Derive the default prefix from the complete npm package name.
* Allow one package-wide prefix override in `package.json`.
* Keep tag names identical across package versions.
* Preserve a host-neutral Rust compiler with no filesystem access.
* Emit one deterministic manifest for normal and DSD builds.
* Keep the first registered constructor and warn clearly on a conflict.
* Cover Vite, CLI, direct Node compiler use, package builds, and nested source
  component composition with the same naming contract.

## Non-Goals

* Supporting two versions of one package on the same page.
* Adding version suffixes, hashes, scoped registries, or automatic renaming.
* Providing old `x-*` aliases or a tag-name migration layer.
* Generating a full Custom Elements Manifest in this issue. The Naos manifest
  is structured so a later adapter can consume it.
* Allowing component-local prefix overrides.

## Package Configuration

The nearest ancestor `package.json` is the only configuration source for a
compiled `.wc.tsx` file.

```json
{
  "name": "@acme/design-system",
  "version": "2.3.0",
  "naos": {
    "tagPrefix": "acme"
  }
}
```

`name` is required. `version` is optional for private applications and is
represented as `null` when absent. Published packages already require a
version. A missing version never changes the derived tag; it only reduces the
detail available in duplicate-registration diagnostics.

`naos.tagPrefix` is optional. It must already be a lowercase, readable custom
element prefix:

```text
[a-z][a-z0-9]*(?:-[a-z0-9]+)*
```

Prefixes beginning with `xml` are rejected because custom element names cannot
use that reserved prefix. Naos rejects invalid overrides instead of silently
normalizing authored configuration.

There are no parallel Vite flags, CLI flags, or `ComponentOptions` fields for
the prefix. This prevents different hosts from compiling the same package to
different public tags.

## Default Prefix Derivation

Without an override, Naos normalizes the complete package name:

1. remove the leading `@` from a scoped package;
2. treat `/` and every run of non-alphanumeric characters as `-`;
3. split camel-case boundaries;
4. lowercase the result;
5. collapse and trim hyphens;
6. validate the result as a tag prefix.

Examples:

| Package | Component | Tag |
| --- | --- | --- |
| `@acme/design-system` | `Button` | `acme-design-system-button` |
| `widgets` | `DatePicker` | `widgets-date-picker` |
| `@acme/design-system` with override `acme` | `Button` | `acme-button` |

The component export is converted to kebab case and appended. When the full
resolved prefix already occurs as the component name's exact leading token
sequence, Naos does not repeat it: prefix `naos` plus `NaosButton` remains
`naos-button`. This is an exact prefix comparison, not general word
deduplication; `acme-design` plus `AcmeButton` remains
`acme-design-acme-button`.
The rule preserves existing package-qualified component names without relying
on a fuzzy naming heuristic.

Package version is never an input. `@acme/design-system@2.1.0` and
`@acme/design-system@2.3.0` both produce the same tag.

## Package Context Boundary

Rust remains deterministic and host-neutral. It receives a validated package
context with the source request:

```ts
type NaosPackageContext = {
  packageJsonPath: string
  packageName: string
  packageVersion: string | null
  tagPrefix: string
}
```

The `@naos-ui/compiler` Node layer owns a synchronous shared resolver because
the public transform API is synchronous today. It resolves a relative filename
against `process.cwd()`, walks to the nearest `package.json`, validates the
Naos configuration, and passes the resulting fields through the native
request.

Vite and CLI call the same compiler wrapper and therefore receive identical
behavior. Direct Node compiler users also get automatic resolution from the
request filename. A caller may provide `packageJsonPath` only to select a
specific package file for virtual or in-memory sources; the contents of that
file remain the source of package name, version, and prefix. Callers cannot
inject an independent prefix.

The native request carries owned strings. `naos-core` exposes an owned package
context and uses it for analysis, nested PascalCase source components, DSD, and
code generation. No Rust code opens `package.json`.

## Compiler Model And Result Metadata

The analyzed component module owns:

* package name;
* optional package version;
* resolved tag prefix;
* final tag name;
* class and export names.

Both normal transform and DSD results expose the same component metadata. The
normal transform result gains metadata so build tools do not need to invoke the
DSD renderer merely to learn the tag name.

Relative PascalCase `.wc.tsx` imports use the current package context. Naos
does not treat a source import from another published package as implicit
cross-package composition; published Custom Elements are consumed through
their documented tags or package entry points.

## Manifest Contract

The existing `naos-manifest.json` becomes a normal build artifact rather than
a DSD-only side effect.

```json
{
  "schemaVersion": 1,
  "package": {
    "name": "@acme/design-system",
    "version": "2.3.0",
    "tagPrefix": "acme-design-system"
  },
  "components": [
    {
      "className": "ButtonElement",
      "exportName": "Button",
      "importPath": "src/button.wc.tsx",
      "shadow": true,
      "tagName": "acme-design-system-button",
      "usesDeclarativeShadowDom": false
    }
  ]
}
```

The manifest has these rules:

* `schemaVersion` starts at `1` and changes only for incompatible schema
  changes.
* `package.version` is a string or `null`.
* components are sorted by `tagName`, then `importPath`;
* paths use `/` separators and are relative to the package root when possible;
* all entries in one manifest must have one package identity and prefix;
* duplicate tag names fail the build and report both source files;
* DSD updates `usesDeclarativeShadowDom` on the same entry;
* output ends with one newline for reproducible artifacts.

The compiler package owns manifest types, validation, sorting, and JSON
serialization helpers. Vite and the primitives builder consume those helpers
instead of implementing separate schemas.

Vite collects component metadata for every transformed component, regardless
of the prerender filter. `NaosVitePluginOptions` moves the file choice to a
top-level `manifestFile?: string | false`, defaulting to
`naos-manifest.json`. The old DSD-nested manifest option is removed before the
first release.

The primitives build emits `dist/naos-manifest.json`. The package already ships
`dist`, so the manifest becomes part of the published artifact without a new
files-list exception.

## Constructor Metadata And Define Guard

Every generated constructor receives frozen internal metadata under a global
symbol shared across separately bundled Naos versions:

```ts
const metadataKey = Symbol.for("naos.component.metadata")

Object.defineProperty(ButtonElement, metadataKey, {
  value: Object.freeze({
    packageName: "@acme/design-system",
    packageVersion: "2.3.0",
    tagName: "acme-design-system-button"
  })
})
```

Generated registration follows one algorithm for automatic and explicit
define paths:

1. read `customElements.get(tagName)`;
2. if absent, define the generated constructor;
3. if the exact generated constructor is already registered, return silently;
4. if metadata has the same package name and version, keep the first and return
   silently;
5. otherwise keep the first and emit one `console.warn` for this generated
   module.

The warning names the tag, registered package/version, attempted
package/version, and first-wins policy. Missing metadata or version is rendered
as `unknown`, never guessed.

```text
naos-ui: <acme-design-system-button> is already registered by
@acme/design-system@2.1.0 (attempted: @acme/design-system@2.3.0). Running two
versions of the same package on one page is not supported; the first
registration wins.
```

An unrelated or uninstrumented constructor produces the same warning shape
with `unknown` registered ownership. Naos never calls `customElements.define`
after a prior registration, so the browser does not throw `NotSupportedError`.

## Diagnostics

Package-context failures use stable structured diagnostics at the Node boundary
with clear filenames and hints. The catalog covers:

* package file not found;
* missing or invalid package `name`;
* invalid `naos` object;
* invalid or reserved `naos.tagPrefix`;
* normalized default prefix that cannot form a valid tag;
* duplicate manifest tag;
* mixed package contexts in one manifest.

Rust retains structured compiler diagnostics for invalid final tag names or
inconsistent native request data. Host validation is repeated at the Rust
boundary where accepting invalid input would violate generated-output
invariants.

## Repository Cutover

This is a direct pre-release output-contract change.

* Repository packages receive explicit `naos.tagPrefix` values where a concise
  public namespace is already intended. `@naos-ui/primitives` uses `naos`,
  preserving its existing `naos-*` public tags.
* The counter example uses a documented example prefix rather than retaining
  generic `x-*` names.
* Rust, compiler, CLI, Vite, example, DSD, router, and fresh-project fixtures
  update atomically.
* Docs stop presenting `x-*` as the default.
* No alias constructors or duplicate registrations preserve old tags.

## Verification

### Rust

* package-name and component-name normalization table tests;
* override validation and reserved-prefix diagnostics;
* same package across versions produces the same tag;
* nested PascalCase source components use the package prefix;
* generated metadata and both define paths use the shared guard;
* DSD and normal transform report identical component identity.

### TypeScript And Build Tools

* nearest-package resolution from absolute and relative filenames;
* optional version and explicit `packageJsonPath` behavior;
* invalid configuration diagnostics;
* transform request/native binding propagation;
* manifest generation without DSD;
* deterministic sorting and newline;
* duplicate-tag and mixed-package rejection;
* primitives package includes its manifest.

### Browser And Consumer Gates

* first registration wins;
* same package/version duplicate is silent;
* version mismatch warns with both versions;
* unrelated or unknown ownership warns without throwing;
* Chromium, Firefox, and WebKit retain normal component behavior;
* fresh-project output contains package-derived tags and
  `naos-manifest.json`.

### Required Commands

```sh
cargo fmt --check
cargo clippy --workspace --all-targets --all-features -- -D warnings
cargo test --workspace
CI=true pnpm check
CI=true pnpm test
CI=true pnpm --filter @naos-ui/example-counter type-check
CI=true pnpm --filter @naos-ui/example-counter test
CI=true pnpm verify:fresh-project
```

## Documentation

Update the README, authoring guide, API reference, compiler limitations,
styling/DSD guide, Vite options, CLI output, fresh-project expectations, and
package README text. Documentation must state plainly that tags are stable
across versions and that loading duplicate package versions on one page is
unsupported.
