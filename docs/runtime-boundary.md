# Runtime Boundary

`@naos-ui/runtime` supplies the small, shared execution kernel used by
compiler-generated Custom Element modules. It removes invariant browser and
reactivity mechanics from each generated module; it is not a framework
runtime, a base class, or an author-facing component API.

Generated modules remain plain `HTMLElement` shells. The compiler owns their
DOM shape, bindings, control flow, and component-specific update callbacks.
Each module imports only the named helpers it uses from
`@naos-ui/runtime/internal`, so normal ESM bundlers can tree-shake unused
kernel capabilities.

## Runtime Inventory

| Area                 | Helpers                                                                                                                              | Boundary                                                                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kernel and lifecycle | `K`, `createKernel`, `connect`, `disconnect`, `attrChanged`, `defineProps`, `defineComponent`                                        | Owns per-instance state records, Custom Element lifecycle sequencing, prop/attribute plumbing, and registration. It does not provide an inheritance API.  |
| Reactivity           | `markDirty`, `markAllDirty`, `scheduleFlush`, `flush`, `flushSync`, `shouldUpdate`, `stateAccessor`, `computedAccessor`, `runEffect` | Owns invariant dirty-set, batching, cache, and effect-cleanup mechanics. The compiler still emits what to update and which dependencies each binding has. |
| Platform mechanics   | `emitter`, `hostApi`, `listen`, `setAttr`, `clx`, `applyStyleValue`, `applySpreadAttributes`, `lazySheet`, `reconcileKeyed`            | Wraps repeatable native browser behavior, including class resolution and dynamic style/spread cleanup. Generated code supplies DOM targets, list row construction, and application callbacks. |

`@naos-ui/runtime` keeps the small public event and scheduling helpers at its
package root. The `./internal` entry point is a compiler/runtime contract and
is intentionally not an application authoring API.

## Allowed Helpers

Runtime helpers may centralize behavior that is invariant across generated
components:

- lifecycle sequencing and per-instance kernel storage;
- dirty tracking, flush scheduling, computed-cache invalidation, and effect
  cleanup;
- prop reflection and observed-attribute conversion driven by compiler-emitted
  tables;
- native event, listener, host-scope, style-sheet, and keyed-record mechanics;
- Custom Element registration diagnostics.

## Disallowed Helpers

The kernel must not become a general framework. Do not add:

- virtual DOM or a declarative renderer;
- hooks, signals, or an author-facing reactive programming model;
- an `HTMLElement` base class or inheritance surface for consumers;
- component discovery, module loading, routing, forms, actions, data loading,
  or server behavior;
- framework compatibility layers or adapters.

## Review Checklist

Before adding a runtime helper:

1. Establish that the behavior is invariant mechanics, while generated code
   continues to express the component-specific semantics.
2. Export it as a small named helper so generated imports remain individually
   tree-shakeable.
3. Add focused runtime tests, plus compiler-output tests for every new emitted
   import or metadata table.
4. Keep `./internal` compiler-facing and preserve the documented public root
   API.
5. Confirm that the generated module still defines a standalone native Custom
   Element without a Naos base class or virtual DOM.
