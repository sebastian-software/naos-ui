# `@naos-ui/runtime`

`@naos-ui/runtime` is the tiny helper runtime imported by compiler-generated
Custom Element modules. Application code does not import it directly; the
compiler emits the imports it needs.

**Stability: preview.** Pre-1.0; the runtime contract tracks the generated
output contract and may change between minor versions.

See the [generated output contract](https://github.com/sebastian-software/naos-ui/blob/main/docs/generated-output-contract.md)
and the [runtime boundary notes](https://github.com/sebastian-software/naos-ui/blob/main/docs/runtime-boundary.md).
