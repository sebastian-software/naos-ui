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

A form action is an action whose payload is `FormData`, plus
`enhance(form)`: it listens for `submit`, lets **native constraint
validation** run first (invalid forms never reach the reducer and keep the
browser's reporting), prevents default only for valid submissions, and calls
`submit(new FormData(form, submitter))`.

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
compilation).

## Out of Scope

Optimistic UI (a later slice on top of `onSettled`), React Server Functions,
RSC payloads, and `"use server"` semantics of any kind.
