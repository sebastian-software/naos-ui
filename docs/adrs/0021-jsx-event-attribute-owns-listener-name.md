# ADR 0021: JSX Event Attributes Own Listener Names

Status: Accepted

Weight: P1

## Context

The unreleased authoring API required event names twice:

```tsx
<button onClick={on("click", handler)}>Save</button>
```

The attribute and helper argument could disagree. The helper call was also
decoded by a string parser during code generation, after OXC had already
parsed the expression.

Naos is still being developed before its first public release. There is no
external consumer source base or released compatibility contract that needs a
migration tool.

## Decision

The JSX attribute is the sole source of the listener name. Bare handlers cover
the common form. `on(handler, options?)` remains only as an authoring marker for
`AddEventListenerOptions` and the compiler-provided handler `AbortSignal`.

OXC lowers event attribute values into owned handler/options IR. Codegen never
extracts an event name or helper arguments from source text. Standard compound
DOM event names use one shared explicit mapping; unknown camel-case names map
to kebab-case custom event names.

The string-first signature is removed immediately. The compiler emits a
diagnostic when it encounters that shape. We will not build a codemod,
deprecation overload, or compatibility layer for an API that has not shipped.

## Consequences

* Authored event names cannot diverge from their JSX attributes.
* The simplest event handler needs no helper call.
* Listener options use the native browser contract without a runtime wrapper.
* Dynamic-list listener replacement must retain the installed capture option.
* Existing repository sources and documentation change atomically.
* If Naos later changes a released event API, that change requires a separate
  migration decision based on actual adoption.

## Alternatives

* Keep the string-first overload temporarily and reject only mismatched names.
* Provide a repository script or CLI codemod for the unreleased syntax.
* Keep deriving names from `on()` and treat the JSX attribute as decorative.

## Related Work

Issue #93; Epic #95; ADR 0003; ADR 0007; ADR 0011; ADR 0020

