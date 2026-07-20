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

Inside a component, `<form action={saveNote}>` enhances the native form —
invalid submissions stay with the browser's constraint validation, valid
ones run the reducer with `new FormData(form, submitter)` — and
`effect(() => bindAction(saveNote, onChange))` binds the pending/state
snapshots to the element lifecycle. String `action` values keep native
browser submission.

`action(reducer, initialState, options?)` is the payload-generic variant for
non-form mutations. Submissions run sequentially, `reset()` aborts in-flight
work and restores the initial state, and `dispose()` detaches permanently.

Route actions are a different tool: URL-bound navigation mutations stay in
`@naos-ui/router` (`data-naos-action` forms, loaders, redirects). See
`docs/actions.md` for the boundary.

The package is dependency-free. It does not depend on the router, React, or
any server-function transport.
