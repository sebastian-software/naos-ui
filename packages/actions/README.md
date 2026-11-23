# `@naos-ui/actions`

Reusable component-local action primitives for Naos and plain Custom Element
applications: reducer-driven mutations with deterministic
`pending`/`error`/`data` reporting, sequential execution, per-invocation
`AbortSignal`s, and native-form enhancement.

**Stability: preview.** Pre-1.0; the action contract may change between
minor versions.

```ts
import { bindAction, formAction } from "@naos-ui/actions"

export const saveNote = formAction(async (notes: string[], formData, { signal }) => {
  const note = String(formData.get("note") ?? "")
  await fetch("/api/notes", { body: formData, method: "POST", signal })
  return [...notes, note]
}, [])
```

Inside a component, `<form action={saveNote}>` respects native constraint
validation, including a draft button’s `formnovalidate` override. The reducer
receives `new FormData(form, submitter)`. Use
`effect(() => bindAction(saveNote, onChange))` to bind pending/state
snapshots to the element lifecycle. String `action` values keep native
browser submission.

A nested status indicator can read `getFormStatus(element)?.pending` or use
`bindFormStatus(element, listener)` for immediate and subsequent snapshots.
A missing form action yields `null`. Call the returned cleanup on disconnect
and rebind if the element changes form owners. See the
[form status and validation guide](../../docs/actions.md#pending-status-inside-a-form).

`action(reducer, initialState, options?)` is the payload-generic variant for
non-form mutations. Submissions run sequentially, `reset()` aborts in-flight
work and restores the initial state, and `dispose()` detaches permanently.

Route actions are a different tool: URL-bound navigation mutations stay in
`@naos-ui/router` (`data-naos-action` forms, loaders, redirects). See
`docs/actions.md` for the boundary.

The package is dependency-free. It does not depend on the router, React, or
any server-function transport.
