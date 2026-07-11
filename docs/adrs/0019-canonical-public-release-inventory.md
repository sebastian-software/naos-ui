# ADR 0019: Canonical Public Release Inventory

Status: Accepted

Weight: P1

## Context

Naos distributes a public compiler package, ten JavaScript packages, and eight
platform-specific native packages. ADR 0012 defines the native-package model,
but package membership was copied into release-please configuration, the
release workflow, the release-set checker, fresh-project verification, and the
npm publishing runbook.

Those copies diverged. Release metadata covered ten JavaScript packages while
the workflow only published six. A version could therefore be released with
documented, installable-looking packages missing from npm.

## Decision

`scripts/release-set.mjs` owns the executable inventory of public npm packages
and native release targets.

The release workflow derives its native matrix and JavaScript publish paths
from that module. The release-set checker, fresh-project verifier, and marked
package table in the npm publishing runbook consume or validate the same
inventory. `release-please-config.json` remains checked-in JSON, because it is
reviewed by release-please directly; the checker verifies that its package keys
match the canonical inventory.

Public package membership is explicit. It is not derived from workspace globs,
so internal Rust crates, documentation, and future workspace tools do not
become publishable accidentally.

## Alternatives

* Maintain each list manually.
* Generate and commit the complete release workflow and release-please files.
* Treat every workspace package as public.

## Consequences

* Adding or removing a public package starts in `scripts/release-set.mjs`.
* Any drift in release-please, workflow integration, fresh-project coverage, or
  the runbook fails `pnpm check-release-set` before publishing.
* The release workflow avoids hand-written native and JavaScript package lists.
* The runbook remains readable while its package table is mechanically checked.

## Related Milestones

v1 hardening, issue #114
