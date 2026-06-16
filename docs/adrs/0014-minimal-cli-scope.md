# ADR 0014: Minimal CLI Scope

Status: Accepted

Weight: P2

## Context

Vite is the main integration path, but v0.1 also needs a direct command-line
entry point for compiler workflows, static prerendering, smoke tests, and
debugging native package installs.

The CLI should not become a second build system.

## Decision

Publish `@iktia/cli` with the `iktia` binary.

v0.1 commands:

* `iktia compile`
* `iktia prerender`
* `iktia info`

`compile` and `prerender` use the same `@iktia/compiler` workflows as the Vite
plugin. `info` reports package, native binding, platform, and version metadata.

The v0.1 CLI does not include `init`, `create`, `watch`, project scaffolding,
docs serving, or an application build pipeline.

## Alternatives

* Put the `iktia` binary in `@iktia/compiler`.
* Publish an unscoped `iktia` package for v0.1.
* Delay all CLI work until after v0.1.
* Build a full project CLI immediately.

## Consequences

* The CLI is useful for CI and users without taking ownership of bundling.
* `@iktia/cli` joins the public release set.
* Command output and exit codes need test coverage.
* Future project scaffolding can be added without overloading
  `@iktia/compiler`.

## Related Milestones

v0.1 M6, M7
