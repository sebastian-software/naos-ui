# Actions

`@naos-ui/actions` provides reusable component-local action primitives for
Naos and plain Custom Element applications: reducer-driven mutations with
deterministic `pending`/`error`/`data` reporting, sequential execution, and
abort-aware lifecycles. The API adapts the useful parts of React's Actions
model (`useActionState`, `<form action={fn}>`, `useFormStatus`) as
platform-native primitives — no hooks, no React, no server-function
transport.

## The Boundary: Route Actions vs. Component-Local Actions

Both exist on purpose, and they do different jobs:

* **Route actions** (`@naos-ui/router`) are URL-bound navigation mutations.
  A submission targets a route, runs the route's `action()`, revalidates the
  loader, advances history with push/replace semantics, and commits a view.
  `data-naos-action` forms remain the router's territory, unchanged.
* **Component-local actions** (`@naos-ui/actions`) are element-scoped
  mutations with no navigation, history, or router dependency: a reducer
  over local state. They pair with `@naos-ui/data`'s `mutate()` in app code
  when a mutation should update cached resources.

Choose a route action when the mutation semantically *is* a navigation
(create-then-redirect, URL-addressable forms). Choose a component-local
action when the mutation stays inside one component (inline edits, toggles,
composer forms) and the URL must not change.

## `action(reducer, initialState, options?)`

The reducer is `(previousState, payload, { signal }) => State | Promise<State>`
— `useActionState`'s shape without hooks. The returned action object exposes
`state()`, `data()` (alias), `pending()`, `error()`, `submit(payload)`,
`reset()`, `subscribe(listener)`, and `dispose()`.

* Submissions run **sequentially**: a submit during a running submission
  queues behind it and receives the committed state of its predecessor.
* Every invocation receives a fresh `AbortSignal`. `reset()` aborts in-flight
  work, clears the queue, and restores the initial state; `dispose()` aborts
  and detaches permanently.
* Rejections settle the returned promise *and* are reported through
  `error()`; the previous committed state stays intact.

`bindAction(action, onChange)` mirrors `bindResource`: it subscribes,
delivers the current snapshot immediately, and returns the unsubscribe
cleanup. Inside a Naos `effect()` this follows the element's
connect/disconnect lifecycle, so host disconnect ends the subscription and
`dispose()`-managed work aborts.

## `formAction(reducer, initialState, options?)`

A form action receives `FormData`. Its `enhance(form)` listener respects native
constraint validation, including `novalidate` on the form and `formnovalidate`
on a submit button. A “Save draft” button can submit an incomplete form to the
reducer while “Publish” still requires valid fields. The listener prevents
navigation and calls `submit(new FormData(form, submitter))` for each accepted
submission.

## `<form action={save}>` in TSX

The compiler lowers a braced `action` value on a native `<form>` with a
runtime dispatch in the generated mount code:

* string values keep the native `action` attribute and full browser
  submission behavior;
* Naos form actions — detected via the `Symbol.for("naos.form.action")`
  brand, so generated code needs no import from `@naos-ui/actions` — are
  wired through `enhance(form)`;
* any other value fails fast with a descriptive error.

Static string attributes (`action="/api/save"`) compile to a plain attribute
exactly as before. The braced value is read once at mount; actions are
module-level constants by design (component setup constants do not survive
compilation). The generated element installs the enhancement on connection,
removes it on disconnect and restores it on reconnect.

## Pending status inside a form

A status indicator or submit control can look up its form action without
importing the action itself. `getFormStatus(element)` returns a snapshot.
`bindFormStatus(element, listener)` also delivers the current snapshot
immediately and calls the listener when pending changes or the form gains
or loses its enhancement.

```ts
import { bindFormStatus } from "@naos-ui/actions"

const stop = bindFormStatus(indicator, (status) => {
  indicator.textContent = status?.pending ? "Saving…" : ""
})
// Call stop() when the indicator disconnects.
```

A supported native control uses its browser-assigned form owner, including
an explicit `form="id"`. For a descendant without an owner, lookup follows
assigned slots and shadow hosts to the nearest discoverable form. An enhanced
form inside a closed shadow root can answer a request through its slot.
A third-party closed root can conceal an ordinary native form around a slot.
In that case an outside consumer can only resolve the visible ancestry.

An enhanced form returns `{ pending: false }` when idle and
`{ pending: true }` while its action has running or queued work. An
unenhanced form, an unresolved explicit owner, or a consumer without a
discoverable form returns `null`. Forms with separate actions have independent
pending states. Forms enhanced with the same action share its pending state.
A binding observes the form resolved at bind time. After moving a consumer,
reassigning its slot or changing its form owner, call the cleanup and bind
again.

## Field state and validation

The profile form example keeps presentation state in the application.
`naos-field` supplies slots for a label, control, hint and error. The native
input owns its value and constraint validation. The checkbox owns its live
checkedness and contributes its value through the browser's form machinery.

| Interaction | Field behavior in the profile form |
| --- | --- |
| Initial value | The field is untouched and clean. Its hint describes the input. |
| Edit | Compare the current value with the reset default to determine dirty state. Returning to the default clears dirty. Editing a field clears its server error. |
| Blur or native validation failure | Blur marks the field touched. A submit attempt can also reveal a constraint error. An invalid required input blocks submission. |
| Submit again | Clear the previous server error and allow the browser to validate again. Associate the submitted field with the current edit revision. |
| Server validation response | Show the field message only if its revision is still current. An edit, another submission or a reset supersedes the earlier result, even when the text matches again. |
| Reset | An accepted reset restores control defaults. The example also clears touched, dirty and errors, and calls the action’s `reset()` to abort outstanding work. |

Use a real label with `for` pointing to the input in the same tree. Put
`aria-invalid` and `aria-describedby` on the focusable input. When a message
is visible, point the description to the error. Restore the hint when the
message clears. The checkbox takes its accessible name from its own label or
slotted content. A server field error is presentation state, so the user can
retry the same value. Transport failures belong in the form's status output.

The [profile form](../examples/counter/field-state.html) and its
[event handlers](../examples/counter/src/profile-form.ts) show the complete
wiring. The [browser tests](../examples/counter/tests/field-state.spec.ts)
supply the profile endpoint and check the accessible name and description.
The [checkbox contract](../packages/primitives/README.md#checkbox-value-ownership)
covers reset, submission and reconnection.

## Out of Scope

Optimistic UI (a later slice on top of `onSettled`), React Server Functions,
RSC payloads, and `"use server"` semantics of any kind.
