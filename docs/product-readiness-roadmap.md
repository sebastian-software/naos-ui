# Iktia Product Readiness Roadmap

Status: 2026-06-16

This roadmap describes the work needed to move Iktia from a strong compiler MVP
to a product-grade public tool. It extends `docs/milestones.md`,
`docs/milestones-v2.md`, and `docs/mvp-verification.md`; it does not replace
them.

The main sequencing principle is documentation first. Reading and tightening the
docs should expose mismatches in the API, compiler boundary, native packaging,
and demo story before larger implementation work starts.

## Current Baseline

Iktia already proves the core vertical slice:

* TypeScript authoring APIs for function components, signals, computed values,
  effects, events, host helpers, slots, parts, and explicit control flow.
* Rust/OXC analysis and native Custom Element code generation.
* Declarative Shadow DOM prerendering and hydration.
* A typed N-API boundary exposed through `@iktia/compiler`.
* A Vite plugin and a browser-tested counter/toggle example.
* ADRs covering the major compiler and platform decisions.

The remaining MVP signals are mostly productization issues:

* Native bindings are local-development artifacts copied into
  `packages/compiler/native/iktia_node.node`.
* Published multi-platform native binary packages are not designed yet.
* The only GitHub workflow is the Pages workflow, and it still contains stale
  package filters from the previous project name.
* There is no CI matrix for Rust, Node packages, examples, docs, or native
  binary builds.
* There is no release automation for npm packages, release notes, GitHub
  releases, or optional Rust crate publishing.
* Diagnostics are still plain strings rather than span-rich messages with
  source-map context.
* The demo surface is too small to prove interop, styling, forms, and hosted
  documentation.

## FerroCat Patterns To Reuse

FerroCat is the closest internal reference for release discipline, not a
drop-in native npm packaging template. The useful patterns are:

* Separate CI jobs for docs, Rust linting, rustdoc warnings, MSRV, platform
  tests, and coverage.
* `cargo fmt --all --check`, Clippy with warnings denied, `cargo doc` with
  `RUSTDOCFLAGS=-D warnings`, and locked Cargo commands.
* Linux coverage with `cargo llvm-cov` and explicit threshold gates.
* Matrix testing on macOS and Windows in addition to Linux coverage.
* Release-Please as the release entry point.
* Publish jobs that run locked tests before publishing and publish crates in
  dependency order.
* A docs site that is built in CI separately from Rust crates.
* Dedicated conformance and benchmark crates for long-term quality signals.
* Dependabot, issue templates, and a pull request template.

Iktia needs one extra layer beyond FerroCat: a Node/N-API distribution plan with
platform-specific optional npm packages and a loader that can resolve the right
binary at install/runtime.

## Strategy

1. Audit and rewrite docs before adding more product surface.
2. Freeze the public API tiers before native package topology is implemented.
3. Build CI and release infrastructure before broad feature expansion.
4. Prove the tool through interop demos, not only unit fixtures.
5. Add conformance, benchmark, and coverage gates once the public contract is
   explicit enough to measure.

## Readiness Milestones

### R1: Documentation-First API Audit

Purpose: Turn the current documentation into a design review. If a feature
cannot be explained clearly, the API or implementation is probably not ready.

Deliverables:

* Review `README.md`, `docs/authoring.md`, `docs/compiler-limitations.md`,
  `docs/declarative-shadow-dom-plan.md`, `docs/demos.md`, and
  `docs/mvp-verification.md` as one user journey.
* Create an API inventory that classifies every public surface as stable,
  legacy-compatible, experimental, or internal.
* Normalize naming around Iktia, native interface elements, Custom Elements,
  Declarative Shadow DOM, and the compiler boundary.
* Remove stale previous-name references from docs, scripts, and workflows.
* Convert documentation mismatches into explicit issues or follow-up entries.

Acceptance criteria:

* A new user can read the README and build the example without knowing the
  repository history.
* Every public API mentioned in docs has a stated stability tier.
* Compiler limitations match the actual accepted and rejected syntax.
* `rg -n "l[e]an-wc|L[e]an WC|I[m]bria|TB[D]|TO[D]O|FIX[M]E" README.md docs
  .github packages crates examples scripts` returns no actionable stale
  entries.

### R2: Public API Contract Pass

Purpose: Decide what API shape Iktia wants before the binary distribution layer
turns it into a published contract.

Deliverables:

* Write ADRs for API stability tiers and package topology.
* Decide whether legacy `component()` and `prop.*()` stay indefinitely, become
  deprecated, or move behind compatibility docs.
* Freeze the first public shape of `signal()`, `computed()`, `effect()`,
  `event()`, `on()`, `host()` / `useHost()`, `<Show>`, `<For>`, and
  `ComponentOptions`.
* Decide whether event options belong in `event(name, options)`, `on(type,
  handler, options)`, both, or neither for the first release.
* Define the public DSD API boundary for `renderDeclarativeShadowDom()` and Vite
  prerender metadata.
* Define semver expectations for generated output markers such as
  `data-iktia-*`.

Acceptance criteria:

* The public API can be summarized in one reference document without caveats
  that contradict `docs/compiler-limitations.md`.
* Experimental APIs are clearly marked and isolated from stable examples.
* Type tests cover each public authoring primitive.
* ADRs make API trade-offs reviewable before implementation continues.

### R3: FerroCat-Style Repository Hygiene And CI

Purpose: Make every normal contribution prove the same basic health locally and
in GitHub Actions.

Deliverables:

* Add a general CI workflow with jobs for Rust lint, rustdoc, MSRV, Node package
  checks, Rust tests, package tests, example build/tests, and docs checks.
* Add macOS and Windows test matrix jobs for the Rust workspace and native
  binding build.
* Fix the existing Pages workflow to use `@iktia/example-counter` and Iktia env
  names.
* Add Dependabot, issue templates, and a pull request template.
* Add a coverage job after a realistic Rust baseline is measured.
* Keep all CI commands locked where the repository already has lockfiles.

Acceptance criteria:

* CI catches stale package names, missing native bindings, type failures, Rust
  warnings, and browser demo regressions.
* Local verification and CI use the same command vocabulary where practical.
* The Pages workflow can publish the current demo without manual cleanup.

### R4: Native Binary Package Architecture

Purpose: Design multi-native distribution before writing release scripts.

Recommended package topology:

* `@iktia/compiler`: pure TypeScript loader, public API, and optional
  dependencies on native packages.
* `@iktia/compiler-darwin-arm64`
* `@iktia/compiler-darwin-x64`
* `@iktia/compiler-linux-x64-gnu`
* `@iktia/compiler-linux-arm64-gnu`
* `@iktia/compiler-linux-x64-musl`
* `@iktia/compiler-win32-x64-msvc`

Deliverables:

* Write `docs/native-distribution.md` with target triples, package names,
  artifact names, Node version, N-API version, and fallback behavior.
* Define loader resolution order: explicit environment override, workspace
  local binding, installed optional package, then source-build guidance.
* Decide whether source builds are supported during package install or only for
  repository contributors.
* Define how native package versions stay locked to `@iktia/compiler`.
* Define the minimum Tier 1 platform set for the first prerelease.

Acceptance criteria:

* A user can understand which package contains the JS API and which package
  contains the native `.node` artifact.
* Missing binary errors tell the user the platform, attempted package names, and
  recovery commands.
* The design handles npm optional dependency behavior across macOS, Linux, and
  Windows.

### R5: Multi-Platform Native Binary Implementation

Purpose: Turn the native distribution design into installable packages.

Deliverables:

* Build release-profile N-API artifacts for the agreed target matrix.
* Generate package manifests for platform packages with correct `os`, `cpu`,
  `libc` where needed, `files`, and license metadata.
* Replace the single hard-coded native path with the loader resolution strategy.
* Add tests for successful loading, missing binary errors, explicit native path
  overrides, and local workspace fallback.
* Upload native artifacts from CI before publish jobs consume them.

Acceptance criteria:

* `@iktia/compiler` works from an installed package on each Tier 1 platform
  without requiring a Rust toolchain.
* Repository development still supports `pnpm build:native`.
* The native binding exposes version metadata that can be checked against the JS
  package version.

### R6: Release Automation

Purpose: Make public prereleases repeatable and auditable.

Deliverables:

* Add Release-Please configuration for the pnpm workspace and native platform
  packages.
* Add npm publish jobs with provenance and a dry-run mode.
* Add GitHub release artifact uploads for native binaries.
* Decide whether `iktia-core` is published to crates.io immediately or kept
  repository-internal until the Rust API is stable.
* Keep `iktia-node` unpublished as a crate unless there is a direct Rust use
  case for the Node binding.
* Add package-level changelogs if Release-Please needs them for clean release
  notes.

Acceptance criteria:

* A release PR shows all package version changes and changelog entries.
* Publish jobs run tests before publishing and stop on version skew.
* A failed native package publish cannot silently produce a broken JS package.

### R7: Compiler Diagnostics And Source Maps

Purpose: Make compiler failures feel intentional instead of MVP-shaped.

Deliverables:

* Introduce structured diagnostic types with severity, code, message, filename,
  span, and hint.
* Use OXC spans for supported semantic errors wherever possible.
* Add source maps for transformed modules in the Rust transform workflow.
* Preserve UTF-8/OXC span correctness instead of translating spans in the JS
  wrapper.
* Add fixture coverage for each accepted and rejected syntax path.
* Update Vite errors to surface diagnostic codes and source locations.

Acceptance criteria:

* Unsupported JSX patterns point to the relevant source range and recommended
  Iktia construct.
* Vite users see actionable errors without opening generated output.
* Source maps make browser stack traces refer back to `.wc.tsx` modules.

### R8: Generated Output And Runtime Contract Hardening

Purpose: Treat generated Custom Elements as a public product surface.

Deliverables:

* Document the generated element contract: tag inference, attributes, props,
  events, slots, parts, `data-iktia-*` markers, and DSD hydration behavior.
* Add snapshot or golden tests for generated output where output stability
  matters.
* Add browser tests for event payloads, attribute reflection, DSD delayed
  upgrade, and `aria-*` behavior.
* Decide which generated details are semver-protected and which remain internal.

Acceptance criteria:

* Demo components can be embedded into a host page with documented attributes,
  events, slots, and parts.
* Hydration markers are either documented as stable or explicitly internal.
* Contract tests catch accidental output drift.

### R9: Docs Site And Guided Learning Path

Purpose: Replace scattered markdown reading with a product-grade learning path.

Deliverables:

* Add a docs site that builds in CI, inspired by FerroCat's separate docs build.
* Start with a small information architecture: Introduction, Quickstart,
  Authoring, Compiler Limits, DSD, Vite, Native Distribution, API Reference,
  Demos, Troubleshooting.
* Keep source-of-truth docs in markdown and avoid duplicating API statements.
* Publish docs and demos through GitHub Pages or a single static deployment.

Acceptance criteria:

* A first-time reader can reach a working component in under ten minutes.
* The native binding and platform package story is documented before the first
  public prerelease.
* The docs site build is part of CI and Pages deployment.

### R10: Demo And Interop Suite

Purpose: Prove that Iktia outputs native elements that survive real host
applications.

Deliverables:

* Keep the counter/toggle demo as the minimal smoke path.
* Add a design-system primitive demo with parts, slots, `data-state`, and
  typed events.
* Add a form demo that exercises native form semantics once form work lands.
* Add plain HTML, Vite, React host, and at least one non-React host integration
  demo.
* Add Playwright tests that exercise compiled elements from host pages rather
  than only package-level tests.

Acceptance criteria:

* Demos show why native Custom Elements are the output target.
* Host apps consume Iktia elements through DOM APIs, not framework adapters.
* Demo tests run in CI and fail on broken bundling, events, or hydration.

### R11: Product-Grade Feature Completion

Purpose: Add the features that make the tool feel useful beyond counter demos,
after API and release foundations are stable.

Candidate feature groups:

* Form-associated Custom Elements and form lifecycle APIs.
* Event option code generation.
* Keyed `<For>` diffing or an explicitly documented non-keyed list contract.
* CSS import strategy for Shadow DOM, including how far Vite integration goes.
* Component module graph analysis beyond direct `.wc` imports.
* Vite cache invalidation and better dev-server diagnostics.
* More complete style, part, slot, and accessibility examples.

Acceptance criteria:

* Each feature group has its own ADR or focused design document before broad
  implementation.
* Features are added only when the docs can describe the user model clearly.
* No feature expands the runtime into a framework, virtual DOM, or React/Solid
  compatibility layer.

### R12: Conformance, Benchmarks, And Release Candidate

Purpose: Define the quality bar for a credible public prerelease.

Deliverables:

* Add an `iktia-conformance` test area or crate for accepted/rejected syntax
  fixtures and generated output contracts.
* Add an `iktia-bench` area or crate for transform performance and selected
  generated-output benchmarks.
* Define benchmark budgets for representative component sizes.
* Add a release-candidate checklist that combines CI, docs, demos, package
  install tests, and manual browser checks.

Acceptance criteria:

* The release candidate can be installed into a fresh project on each Tier 1
  platform.
* Conformance fixtures cover the documented public syntax boundary.
* Benchmarks give enough trend data to catch major transform regressions.

## Suggested Sequence

1. R1 and R2: documentation and API decisions.
2. R3: repository hygiene and CI, including the existing Pages workflow cleanup.
3. R4 and R5: native package design and multi-platform implementation.
4. R6: release automation once packages can be installed from artifacts.
5. R7 and R8: diagnostics, source maps, and output contract hardening.
6. R9 and R10: docs site and interop demos.
7. R11 and R12: larger product features, conformance, benchmarks, and release
   candidate gates.

This sequence intentionally puts release mechanics before broad feature
expansion. Iktia already has enough compiler capability to reveal packaging,
documentation, and API-contract problems.

## API Planning Questions For The Next Interview

These questions should be answered before R4/R5 implementation begins:

* Is `component()` a permanent compatibility API or a legacy bridge?
* Are `prop.*()` helpers still part of the preferred API, or should function
  props be the only documented path?
* Should `host()` and `useHost()` both remain public?
* Which event API owns event listener options?
* Which platforms are Tier 1 for the first public prerelease?
* Should npm installs ever compile from source, or should source builds be
  contributor-only?
* Is `data-iktia-*` a stable hydration/debug contract or internal generated
  markup?
* Which demos count as launch proof: vanilla, React host, Vue host, Angular
  host, static HTML, or CMS-style embed?
* Should `iktia-core` be public on crates.io before the Rust API is stable?

## Commit Discipline

Keep future work modular and reviewable:

* `docs:` for API inventories, ADRs, roadmap updates, and docs-site content.
* `ci:` for GitHub Actions, Dependabot, templates, and coverage gates.
* `build:` for native artifact generation, package manifests, and publish
  wiring.
* `feat:` for compiler, API, Vite, and runtime capabilities.
* `test:` for fixtures, conformance, browser tests, and install tests.

The first commit from this roadmap should only add this planning document. Each
future milestone should land as one or more focused commits with verification
noted in the commit body or pull request description.
