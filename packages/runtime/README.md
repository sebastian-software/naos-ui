# `@naos-ui/runtime`

`@naos-ui/runtime` is the small shared execution layer imported by
compiler-generated Custom Element modules. It centralizes invariant lifecycle,
batching, prop/attribute, effect, and browser-platform mechanics so each
generated module can remain a thin native `HTMLElement` shell.

Application code normally does not import this package directly. The compiler
emits the helpers required by a component.

## Entry points

- `@naos-ui/runtime` is the public, small platform-helper entry point. It
  exports `createNaosEvent` and `scheduleNaosUpdate`.
- `@naos-ui/runtime/internal` is the compiler-facing kernel contract. It
  exports individually tree-shakeable functions such as `createKernel`,
  `connect`, `markDirty`, and `lazySheet`. It is not an author-facing
  component API and carries no `HTMLElement` base class.

**Stability: preview.** Before 1.0, the `./internal` contract tracks the
generated-output contract and may change in a minor release.

See the [generated output contract](https://github.com/sebastian-software/naos-ui/blob/main/docs/generated-output-contract.md), the [runtime boundary](https://github.com/sebastian-software/naos-ui/blob/main/docs/runtime-boundary.md), and [RFC 0009](https://github.com/sebastian-software/naos-ui/blob/main/docs/rfcs/0009-shared-runtime-kernel.md).
