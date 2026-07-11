# Release-set single-source design

Status: Proposed

Related issues: #114, #123

## Problem

Naos currently describes its publishable npm packages in several independent
places. The lists have drifted: the release workflow publishes six JavaScript
packages, whereas release-please and the release checker know about ten. In
particular, `@naos-ui/data`, `@naos-ui/data-convex`, `@naos-ui/motion`, and
`@naos-ui/router` can receive release metadata without ever being published.
The fresh-project verifier and publishing runbook repeat the same incomplete
view of the public package set.

This is a release-integrity failure: public documentation tells users to
install packages that a successful release may not have placed on npm.

## Goals

* Establish one executable inventory of all public packages and native targets.
* Make the release workflow consume that inventory for its native matrix and
  JavaScript publish loop.
* Make release validation, the fresh-project verifier, and the publishing
  runbook agree with the inventory.
* Fail before publishing when a checked-in release configuration drifts from the
  inventory.
* Keep the public package list readable in the runbook without making prose a
  second source of truth.

## Non-goals

* Change package names, package stability, release-please versioning policy, or
  npm provenance policy.
* Publish a release as part of this work.
* Add a package merely because it is present in the workspace.

## Design

### Canonical inventory

Add `scripts/release-set.mjs`. It will export immutable package records rather
than separate ad-hoc arrays. Each record has a workspace path, npm name, and
kind (`javascript` or `native`). Native records additionally contain the GitHub
runner, Rust target, and platform metadata required by the release matrix.

The module will export derived collections for public packages, JavaScript
packages, and native targets. It will also provide small command-line output
modes:

* a GitHub Actions output mode that serializes the native matrix as JSON;
* a newline-delimited JavaScript publish-path mode;
* a Markdown package-table mode for the runbook.

The data remains ordinary, checked-in JavaScript. No package installation or
workspace build is needed to read it in a release job.

### Release workflow

Add a lightweight `release-set` job after checkout that writes the native
matrix JSON to `GITHUB_OUTPUT`. The native job consumes that output through
`fromJSON`; it no longer embeds a second target matrix in YAML. The JavaScript
job reads the newline-delimited paths from `release-set.mjs` before publishing,
so every canonical JavaScript package is handled in order.

The existing validation job remains the gate before publishing. It will also
verify that the workflow invokes the canonical inventory, rather than matching
individual package strings scattered through YAML.

### Other consumers and verification

`check-release-set.mjs` will import the canonical records. It will continue to
verify package metadata, native optional dependencies, release-please entries,
and manifest versions against those records. It will add explicit checks for
the workflow integration and for the generated runbook package block.

`verify-fresh-project.mjs` will import the same records. It will pack every
public package and make every JavaScript package a temporary-project dependency.
It will retain platform-aware handling for the one native package resolved on
the current host. This proves that the full published JavaScript surface can be
installed together without pretending that every native binary can run locally.

`docs/npm-publishing.md` will contain a marked, generated package table. The
release checker compares that block with the Markdown mode from
`release-set.mjs`; changing the inventory without refreshing the docs fails the
preflight. The runbook will use the correct npm organization and GitHub
repository (`sebastian-software/naos-ui`) for its trusted-publishing setup.

### Architecture decision record

Add ADR 0019, **Canonical public release inventory**, when implementing this
design. It will record that executable inventory data owns package membership,
while release-please JSON and human-facing documentation are validated derived
representations. This extends ADR 0012's native-distribution decision without
changing its platform package model.

## Alternatives considered

### Keep lists synchronized manually

Rejected. The current failure proves that review and conventional discipline do
not provide an enforceable release boundary.

### Generate every release configuration file

Rejected. GitHub Actions and release-please intentionally use checked-in YAML
and JSON. Generating and committing whole files would obscure their normal
review surface. The inventory drives the dynamic workflow paths and verifies
the static release-please configuration instead.

### Publish all workspace packages

Rejected. The Rust crates and documentation site are intentionally not npm
packages. Public-package membership is a product and distribution decision, not
a filesystem glob.

## Validation

The implementation must pass:

```sh
pnpm check-release-set
node --test scripts/release-set.test.mjs
pnpm verify:fresh-project
pnpm check
pnpm test
```

The focused tests will cover canonical collection derivation, detection of a
release-please mismatch, detection of a missing workflow inventory invocation,
and detection of a stale marked documentation block. The fresh-project test
will prove that all ten JavaScript packages are packed and installed.

## Rollout

This is backward compatible and release-safe. The change must merge before any
first `dry_run=false` release workflow dispatch. No npm package version or
consumer migration is required.
