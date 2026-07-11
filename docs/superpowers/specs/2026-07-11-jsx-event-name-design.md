# JSX event attributes own listener names

Status: Approved

Related issues: #93, #95

## Context

Naos currently repeats every DOM event name in the JSX attribute and the
`on()` helper:

```tsx
<button onClick={on("click", handler)}>Save</button>
```

The two names can diverge, and code generation still extracts the handler from
the authored expression with a delimiter-based string parser. Naos has not had
a public release or external adoption, so there is no installed source base to
migrate and no compatibility contract to preserve.

## Goals

* Make the JSX attribute the only source of the listener event name.
* Support a bare handler for the common case and `on(handler, options?)` when
  listener options are needed.
* Preserve the compiler-provided per-invocation `AbortSignal` for both forms.
* Lower event handler expressions with OXC into owned compiler IR before
  codegen.
* Apply `capture`, `passive`, and `once` through the native
  `addEventListener()` options contract.
* Document and test the conversion from JSX attribute spelling to DOM event
  name.

## Non-goals

* A codemod, deprecation period, compatibility overload, or transitional
  warning for the unreleased string-first signature.
* Runtime event delegation or a framework event layer.
* Inferring custom event payload types from component imports.
* Expanding the public `event()` emitter contract.

## Public authoring API

The supported forms are:

```tsx
<button onClick={(event) => save(event)}>Save</button>

<div
  onScroll={on(
    (event, signal) => trackScroll(event, signal),
    { passive: true },
  )}
/>
```

`on()` has one signature family:

```ts
on<EventType extends Event>(
  handler: (
    event: EventType & { currentTarget: EventTarget },
    signal: AbortSignal,
  ) => void | Promise<void>,
  options?: AddEventListenerOptions,
): EventHandler<EventType>
```

The surrounding JSX event attribute context determines `EventType` for known
intrinsic events. A bare handler and `on(handler)` compile identically. The
helper is only an authoring marker that carries listener options; it has no
runtime implementation.

The old `on("click", handler)` form is rejected with a stable compiler
diagnostic that points to `on(handler, options?)`. There is intentionally no
automatic migration command because the API has not shipped.

## AST and IR boundary

`ast.rs` recognizes event attributes while lowering JSX. Their value becomes a
typed event-handler IR payload with:

* the exact handler expression source;
* an optional exact listener-options expression source.

For a direct `on()` call, OXC validates the argument count and separates the
handler from the options expression. A string first argument is diagnosed as
the removed pre-release signature. Other event attribute expressions are bare
handlers and become the handler source directly.

Codegen consumes the structured payload. It does not search for `on(`, split
arguments, or infer an event name from the helper call.

## Event-name mapping

The compiler strips the leading `on`, converts the remainder to kebab case,
then applies a documented table for standard compound DOM names:

| JSX attribute | DOM event |
| --- | --- |
| `onClick` | `click` |
| `onDblClick` | `dblclick` |
| `onKeyDown` / `onKeyUp` | `keydown` / `keyup` |
| `onBeforeInput` | `beforeinput` |
| `onContextMenu` | `contextmenu` |
| `onFocusIn` / `onFocusOut` | `focusin` / `focusout` |
| `onMouseDown` / `onMouseMove` / `onMouseUp` | `mousedown` / `mousemove` / `mouseup` |
| `onPointerDown` / `onPointerMove` / `onPointerUp` | `pointerdown` / `pointermove` / `pointerup` |
| `onTouchStart` / `onTouchMove` / `onTouchEnd` | `touchstart` / `touchmove` / `touchend` |

The same table covers the related enter, leave, over, out, cancel, capture,
composition, animation, transition, drag, and fullscreen names. Unknown
camel-case attributes remain kebab-case custom event names, for example
`onDataReady` becomes `data-ready`.

The mapping lives outside codegen so AST lowering, DOM generation, tests, and
future manifest/type generation share one rule.

## Listener generation

Static element listeners pass the preserved options expression as the third
argument to `addEventListener()`. The handler still receives a new
compiler-owned `AbortSignal` for each invocation.

Dynamic list rows retain both their installed listener and evaluated options.
Before replacing a listener, codegen calls `removeEventListener()` with the
same capture value used for installation, aborts the previous invocation
signal, stores the new options, and installs the new listener. This keeps
`capture: true` correct during row reconciliation.

Declarative Shadow DOM output continues to omit event handlers.

## Diagnostics

Add `NAOS_UNSUPPORTED_EVENT_HANDLER` for malformed event attributes, including:

* boolean or static-string event values;
* `on()` without a handler or with more than handler plus options;
* spread arguments;
* the removed string-first signature.

Diagnostics use the existing authoring-limitation hint and identify the
supported bare-handler and `on(handler, options?)` forms.

## Repository cutover

All source components, primitives, fixtures, type tests, README examples, and
current authoring documentation move to the new form in the same PR. Historical
RFC examples may be updated where they describe the current API; no migration
artifact is produced.

## Validation

The delivery must pass:

```sh
cargo fmt --check
cargo clippy --workspace --all-targets --all-features -- -D warnings
cargo test --workspace
pnpm check
pnpm test
pnpm verify:fresh-project
```

Tests cover the mapping table, bare handlers, `on(handler)`, all three listener
options, list-row replacement with capture, TypeScript contextual event types,
the removed signature diagnostic, and browser behavior.

