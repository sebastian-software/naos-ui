# ADR 0024: Public API Naming And Lifecycle Ownership

Status: Accepted

Weight: P2

## Context

Naos framework packages grew with two inconsistent public conventions.
Router and motion types use a `Naos` prefix, while data exported generic names
such as `Resource`, `ResourceState`, and `ResourceCache`. Those names collide
easily in applications and make sibling packages look unrelated.

Teardown also uses several platform-appropriate mechanisms: data resources
have `dispose()`, the router has `start()` and `stop()`, subscriptions return a
cleanup callback, and asynchronous work accepts `AbortSignal`. Treating these
as interchangeable would hide who owns a lifetime and whether an object can be
started again.

The packages have release tags but have not been published to npm. The naming
contract can therefore be corrected without preserving an unshipped alias API.

## Decision

All exported framework types, interfaces, classes, and enums use the `Naos`
prefix. This applies to `@naos-ui/data`, `@naos-ui/data-convex`,
`@naos-ui/motion`, and `@naos-ui/router` and to new sibling framework packages.

Functions remain concise verbs scoped by their package, such as
`fetchResource`, `createRouter`, and `spring`. Values use descriptive names;
generic singleton values that can collide in consumer scope include `Naos`, as
in `defaultNaosResourceCache`.

The repository check scans framework public entry points and rejects exported
type declarations that do not start with `Naos`. It also rejects the former
generic default-cache name.

Lifecycle APIs communicate ownership as follows:

* `AbortSignal` is for caller-controlled cancellation of asynchronous work or
  listeners. The receiver observes it but does not own or reuse the controller.
* `dispose()` belongs to an object or handle that owns resources and cannot be
  restarted after disposal. It is synchronous and idempotent even when cleanup
  triggers asynchronous cancellation.
* `start()` and `stop()` belong to a reusable service with explicit inactive
  and active states. `stop()` releases active work but permits a later
  `start()`; final object disposal is unnecessary while it owns no work when
  stopped.
* A cleanup callback represents one lexical registration, such as a listener
  returned by `subscribe()`. Calling it more than once is harmless.

APIs do not add a shared `NaosDisposable` interface. TypeScript structural
typing already expresses `dispose(): void`, while a universal nominal type
would encourage unrelated lifetimes to be treated as equivalent.

## Alternatives

### Keep generic data names

Package imports provide some namespace context, but generic names still collide
after import and remain inconsistent with the sibling packages. Rejected.

### Prefix every exported value and function

Names such as `naosFetchResource` and `naosCreateRouter` repeat the package
namespace and are less idiomatic. Rejected; the prefix is required for public
types and collision-prone generic singleton values.

### Standardize every teardown path on `dispose()`

This would make restartable services and caller-owned cancellation less clear.
Rejected in favor of ownership-specific mechanisms.

## Consequences

Data and Convex type imports use their new `Naos*` names. No deprecated aliases
are provided because the old names were not published. Future framework types
are checked in CI. New lifecycle APIs must document whether they are
cancelable, disposable, restartable, or lexically scoped.

## Related Milestones

* Epic #123
* Issue #122
* Issues #102, #109, #110, and #108 consume this lifecycle convention.
