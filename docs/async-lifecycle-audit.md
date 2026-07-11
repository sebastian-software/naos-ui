# Async Lifecycle Audit

This audit records the v0.1 async cleanup pass for generated JSX event
handlers, manual DOM listeners in primitives, and the `host()` lifecycle
handle.

## Findings

* Generated event handlers previously had no invocation-scoped cancellation.
  Async handlers could continue after a newer handler invocation, a list row
  removal, or host disconnect.
* Static listeners receive an invocation-scoped `AbortSignal`; the public
  `on(handler, options?)` marker exposes it as the handler's second typed
  argument. The signal aborts on the next invocation of the same generated
  listener and when the host disconnects.
* Dynamic list-row listeners now abort the previous row handler before
  reinstalling a listener, and stale row records abort active handler work
  before their DOM nodes are removed.
* `host().update()` now returns a `Promise<AbortSignal>` that resolves after
  the next generated update pass. That signal is aborted by the next generated
  update pass or by disconnect.
* `host().queueTask()` schedules work after the next generated update pass,
  which gives primitives a supported place for DOM reads or focus work that
  depends on generated bindings being current.

## Primitive Pass

Primitives use bare JSX handlers for ordinary synchronous listeners and reserve
`on(handler, options?)` for native options or async cancellation:

* button, checkbox, dropdown, rating group, slider, toast, and toggle use bare
  generated handlers for local DOM events.
* tooltip, hover-card, popover, context-menu, menu, dialog, and dropdown use
  document or host listeners for overlay behavior. These listeners are already
  tied to `AbortController` cleanup, `host().signal`, or effect cleanup.
* Zag-backed behavior kernels install internal DOM listeners as part of their
  service lifecycle. They remain owned by the service stop functions and are
  outside generated JSX-listener cancellation.

## Scope Boundary

Spread event attributes remain plain DOM listener assignments. They do not get
Naos re-entry signals because they are not `on()` calls and may come from
foreign object shapes. If those need lifecycle-aware cancellation later, they
should become an explicit spread-event policy rather than implicit magic.

Generated listeners invoke the supplied handler with `(event, signal)`. Bare
handler types expose the normal event argument; `on(handler, options?)` exposes
the second signal. Generated callbacks do not bind a receiver, so handlers that
rely on `this` should keep using an arrow or closure instead of a standalone
`function` body.
