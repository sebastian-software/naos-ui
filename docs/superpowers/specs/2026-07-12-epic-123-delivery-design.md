# Epic 123 Delivery Design

Date: 2026-07-12

Status: Approved delivery design

Related: Epic #123, Epic #95, issues #96-#122

## Purpose

Epic #123 is a multi-subsystem correctness and developer-experience program.
It spans the compiler, generated runtime, Vite integration, framework packages,
examples, documentation, contributor tooling, and two exploratory distribution
questions. This document defines how the remaining work reaches `main` without
turning the epic into one long-lived integration branch.

The epic is complete only when every production issue in P1-P3 is implemented,
tested, documented, merged, and closed. The exploratory issues #119 and #121
complete with reproducible spikes, a recorded go/no-go decision, and follow-up
issues for any approved production work.

## Current Baseline

The following Epic #123 findings are already merged:

* #98 and #99 through the owned OXC compiler IR work in PR #125;
* #114 through the canonical public-package inventory in PR #124.

The adjacent v1-hardening work in PRs #126-#128 also establishes contracts that
this epic consumes: JSX-owned event names, package-stable custom-element tags
and manifest metadata, and enforced package dependency boundaries.

All remaining issue work starts from the latest green `main`. Existing merged
contracts are not reimplemented in the epic branches.

## Delivery Model

Each production issue receives a dedicated branch, worktree, issue update, and
pull request. Branches use `codex/issue-<number>-<slug>`. Pull requests are
reviewable, independently releasable slices and use Conventional Commit titles.

Closely related issues may share one design pass, but they remain separate PRs.
A dependent branch starts only after its prerequisite has merged into `main`.
This avoids stacked-branch ambiguity and makes the issue and PR state reliable
evidence of epic progress.

Every issue follows this loop:

1. Refresh `main` and confirm the issue remains open and unclaimed.
2. Create its worktree and post the branch, scope, dependencies, and validation
   plan on the issue.
3. Implement the smallest complete production slice, including tests, consumer
   documentation, and release-inventory changes where applicable.
4. Run narrow checks first, then the repository-required validation.
5. Commit, push, open a ready PR, and link the closing issue.
6. Resolve valid CI and review findings, rebase when required, and merge only
   with green required checks and no unresolved actionable threads.
7. Confirm the issue closed, update the epic checklist, and remove the worktree.

There is no epic integration branch and no mega-PR.

## Ordered Delivery Phases

### Phase 1: Public Conventions And Runtime Correctness

Deliver #122, #106, #102, and #103 in that order.

* #122 fixes the public naming and disposal vocabulary before new data and
  testing APIs expand it. The ADR must state when APIs use `AbortSignal`, a
  disposable handle, or an owning object's `dispose()` method.
* #106 adds the `Object.is` state-write guard and establishes the expected
  no-op update behavior used by later runtime tests.
* #102 makes effects connection-scoped: disconnect cleans them up and reconnect
  re-establishes them without remounting DOM or resetting component state.
  `onConnected`, `onDisconnected`, and `effect()` semantics are documented as a
  coherent lifecycle contract. Adoption across documents does not introduce a
  second lifecycle unless browser behavior proves one is required.
* #103 guarantees host-update scope settlement with `finally`, reports failures
  through the platform error channel, dispatches an observable `naos-error`
  event, and proves subsequent updates can recover.

These issues share generated-code fixtures and browser lifecycle coverage but
do not share a PR.

### Phase 2: Compiler Locations And Diagnostics

Deliver #96 before #97.

* #96 uses compiler-owned OXC spans to emit meaningful source-map mappings.
  A map is emitted only when it is truthful; uniform `AAAA` mappings are not a
  fallback. Tests decode representative mappings and connect generated output
  to the expected TSX lines and columns.
* #97 builds on the same span model to expose structured diagnostic locations,
  CLI line/column output, Vite error locations and frames, and fixture coverage
  for every public diagnostic code.

Span conversion remains owned by Rust because OXC offsets are compiler input.
Hosts consume structured locations and do not reverse-engineer byte offsets.

### Phase 3: Vite Development Correctness

Deliver #101 before #100.

* #101 returns style dependencies from compiler metadata, registers them as
  Vite watch files, removes plugin-side source parsing, and gives `hasChanged`
  one truthful documented meaning or removes it.
* #100 first guarantees predictable full-page reloads for changed `.wc.tsx`
  modules. Its ADR evaluates prototype mutation and live-instance remounting but
  keeps reload-only behavior unless a stronger approach preserves custom
  element registry and component-state invariants.

The production acceptance criterion is that an edit is visible without a
manual browser action. Silent reuse of an obsolete registered constructor is
never acceptable.

### Phase 4: Prop Semantics And Generated Types

Deliver #104 before #107.

* #104 derives primitive prop behavior from TypeScript annotations, diagnoses
  incompatible defaults, and adds property-only rich values without accidental
  string coercion or reflection.
* #107 extends the component metadata and manifest pipeline established by #94
  to generate element declarations, `HTMLElementTagNameMap` augmentation,
  typed properties, and typed custom-event listener overloads. The primitives
  package ships its generated declarations.

The compiler owns one prop and event model. JavaScript output, manifest output,
and TypeScript declarations must not maintain parallel inference rules.

### Phase 5: Data Lifetime And Component Integration

Deliver #109 before #110 and only after #102 and #122.

* #109 adds configurable cache retention, observable deletion and clearing, and
  eviction after the last listener and in-flight operation are gone. Default
  behavior must prevent unbounded growth while allowing deliberate short-term
  reuse.
* #110 binds resources to the approved component connection lifecycle, defers
  initial work until subscription or explicit enablement, exposes validation
  state and retry policy, and makes Convex optimistic mutations use the same
  cache mutation contract.

Reconnect must not duplicate requests or subscriptions. Abort, retry, rollback,
and disposal paths receive deterministic fake-clock and failure tests.

### Phase 6: Router Type And Navigation Semantics

Deliver #111 before #112.

* #111 threads path-template generics through loaders, actions, and matches with
  type tests proving valid and invalid parameter access.
* #112 implements nested/layout route ownership, consumes reusable prefetched
  loader results under a documented invalidation window, and makes error-view
  URL commits deterministic. RFC 0006 is updated to match the shipped behavior.

The router keeps navigation transactional: route matching, loading, history
mutation, and outlet commit have an explicit order, and failed navigation does
not leave the address bar and rendered route describing different states.

### Phase 7: Styling And First-Party Testing

Deliver #105 and then #108.

* #105 rejects styled light-DOM components with a targeted diagnostic unless a
  document-safe, ownership-aware injection design is proven during its design
  pass. Shadow components share constructable stylesheets when supported and
  retain a correct style-element fallback for DSD and older environments.
* #108 introduces `@naos-ui/testing` with mount, flush, mutation, event, shadow
  query, and cleanup helpers. It consumes the runtime scheduler instead of
  guessing with timers and follows the disposal convention from #122.

The testing package is added to the canonical release inventory in the same PR
that introduces it. Representative primitives tests migrate to it; wholesale
test churn is not required to prove the package.

### Phase 8: Integrated Example And Scaffolding

Deliver #113 before #120.

* #113 adds a deterministic list/detail application using typed routing, a
  lifecycle-bound data resource, motion, generated component types, and the
  testing helpers. Browser tests use controlled local data, not an external
  service. A Convex variant may be documented but is not required for CI.
* #120 ships a separate create package rather than expanding the compile CLI.
  The generated project matches the canonical example contracts and is built
  and tested by the fresh-project verifier.

The scaffold command is documented only after its package is present in the
release set and publish workflow. Documentation must not promise an unpublished
package.

### Phase 9: Repository And Release Readiness

Deliver #116, #117, #118, and #115.

* #116 retains Oxlint for source correctness and dependency policy, adds one
  repository formatter and a check-only CI gate, and records editor defaults.
  The existing Oxlint work from #128 is treated as baseline, not duplicated.
* #117 provides contributor policy, templates, a reproducible devcontainer,
  security guidance, and a verified JS-only workflow that obtains an exact
  compatible native binding without requiring Rust.
* #118 runs the platform-sensitive compiler, CLI, and Vite JavaScript tests on
  macOS and Windows after building or installing the matching binding.
* #115 audits the final canonical package inventory so every shipped package has
  a README, documentation-site entry, stability tier, and accurate DSD boundary.

#115 lands last in this phase so its inventory includes the testing and create
packages introduced earlier.

### Phase 10: Exploratory Spikes

#119 begins after #100 and #101. #121 is independent but lands after the
production phases unless it uncovers a release blocker.

* #119 measures the amount of genuinely shared transform/watch behavior across
  Vite, Rollup, and esbuild; produces smoke prototypes; records dependency,
  bundle-size, HMR, and maintenance trade-offs; and decides whether Unplugin is
  the correct public abstraction.
* #121 builds the smallest viable OXC-backed WASM experiment and records target
  compatibility, compressed binary size, cold and warm transform time, memory,
  loader implications, and browser-playground constraints.

A spike is complete when its commands and fixtures reproduce the measurements,
an ADR records a clear go or no-go decision, and every approved production
slice exists as a separately scoped follow-up issue. Spike code is not shipped
from a public package merely to close the issue.

## Cross-Cutting Error Contract

New public operations use typed or structured failures at their ownership
boundary. Compiler failures remain `NaosDiagnostic` values. Runtime failures
are observable without permanently wedging a component. Data and router async
failures retain cancellation and cause information. CLI and Vite adapters add
host-specific presentation but do not replace the underlying diagnostic.

Tests cover both failure observability and recovery. A rejected promise, thrown
effect, aborted request, failed loader, malformed prop, or unavailable native
binding must not leave hidden pending work or contradictory visible state.

## Validation Contract

Every production PR runs the narrow package or crate tests affected by the
change and then, before merge:

```sh
cargo fmt --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test --workspace
pnpm check
pnpm lint
pnpm test
pnpm verify:fresh-project
```

Changes affecting examples or browser-visible generated output also run the
example build and browser matrix required by CI. Platform-sensitive loader,
path, and Vite changes require evidence from the relevant OS matrix rather than
Linux-only local tests.

Generated artifacts, package manifests, README examples, docs-site references,
and release inventory are part of the implementation, not deferred cleanup.

## Progress And Completion Evidence

The Epic #123 body is updated after each merged PR. A checked item must have a
merged closing PR or an explicitly linked decision artifact for a spike. Local
branches and passing local tests are progress evidence, not completion.

Before closing the epic:

* every P1-P3 child issue is closed by a merged PR;
* #119 and #121 contain their ADR, reproducible measurements, decision, and any
  follow-up issue links;
* `main` passes required CI after the last merge;
* the release inventory, package docs, and contributor docs describe the final
  repository state;
* no actionable review thread or required check remains unresolved;
* the epic checklist and dependency notes match live GitHub state.

## Alternatives Considered

### Stacked Domain Branches

Stacking several runtime, data, or compiler branches could reduce calendar
time, but it would make review findings and rebases propagate through dependent
PRs. It is rejected as the default. A temporary stack is permitted only for a
short proof during design; production PRs still rebase onto merged `main`.

### Domain Mega-PRs

One PR per phase would reduce GitHub administration but combine public API,
runtime behavior, generated code, docs, and tooling changes. The resulting
review and rollback boundary is too broad, so this approach is rejected.

### One Epic Integration Branch

A long-lived integration branch would hide the authoritative completion state
from issues and release automation and make continuous shipping impossible. It
is rejected.
