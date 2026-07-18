import { effect, state } from "@naos-ui/core"
import { bindAction } from "@naos-ui/actions"
import { saveNoteAction } from "./note-actions.js"

export function NoteForm() {
  const count = state(0)
  const pending = state(false)
  const failed = state(false)

  effect(() =>
    bindAction(saveNoteAction, ({ error, pending: isPending, state: notes }) => {
      pending.set(isPending)
      count.set(notes.length)
      failed.set(error !== undefined)
    }),
  )

  return (
    <form action={saveNoteAction} data-pending={String(pending())} data-failed={String(failed())}>
      <label>
        Note
        <input name="note" required />
      </label>
      <button>Save note</button>
      <output data-note-count>{count()}</output>
    </form>
  )
}
