import { bindAction, bindFormStatus, formAction } from "@naos-ui/actions"
import "@naos-ui/primitives/checkbox"
import "@naos-ui/primitives/field"

const form = document.querySelector<HTMLFormElement>("#profile")!
const field = form.querySelector("naos-field")!
const name = form.querySelector<HTMLInputElement>("#display-name")!
const error = form.querySelector<HTMLElement>("#name-error")!
const updates = form.querySelector("naos-checkbox")!
const status = form.querySelector<HTMLOutputElement>("#save-status")!
const revisionKey = "_profileRevision"
let revision = 0
let touched = false
let attempted = false
let serverError = ""

function renderName(dirty = name.value !== name.defaultValue) {
  const localError = touched || attempted ? name.validationMessage : ""
  const message = localError || serverError
  field.dataset.dirty = String(dirty)
  field.dataset.touched = String(touched)
  field.toggleAttribute("invalid", Boolean(message))
  name.setAttribute("aria-invalid", String(Boolean(message)))
  name.setAttribute("aria-describedby", message ? error.id : "name-hint")
  error.textContent = message
}

function renderCheckbox() {
  updates.dataset.dirty = String(updates.checked !== updates.hasAttribute("checked"))
}

name.addEventListener("input", () => {
  revision++
  serverError = ""
  renderName()
})
name.addEventListener("blur", () => {
  touched = true
  renderName()
})
name.addEventListener("invalid", () => {
  attempted = true
  renderName()
})
updates.addEventListener("naos-change", renderCheckbox)
updates.addEventListener("focusout", () => {
  updates.dataset.touched = "true"
})

form.addEventListener("submit", () => {
  revision++
  attempted = true
  serverError = ""
  renderName()
  // Stamp this submission before the enhanced action queues its payload.
  form.addEventListener("formdata", (event) => event.formData.set(revisionKey, String(revision)), {
    once: true,
  })
})

const save = formAction(async (_state: null, data, { signal }) => {
  const submittedRevision = data.get(revisionKey)
  data.delete(revisionKey)
  const response = await fetch("/api/profile", { method: "POST", body: data, signal })
  if (response.status === 422) {
    const result = (await response.json()) as { name: string }
    if (submittedRevision === String(revision)) {
      serverError = result.name
      renderName()
    }
  } else if (!response.ok) {
    throw new Error("Could not save the profile.")
  }
  return null
}, null)
save.enhance(form)
bindFormStatus(status, (current) =>
  form.setAttribute("aria-busy", String(current?.pending ?? false)),
)
bindAction(save, (action) => {
  status.value = action.pending ? "Saving…" : action.error ? "Could not save the profile." : ""
})

// Handle the bubbling reset after the form's listeners can cancel it. The
// browser restores control values after dispatch, so record their clean state
// directly. A second submission in the same task starts a fresh action.
window.addEventListener("reset", (event) => {
  if (event.target !== form || event.defaultPrevented) return
  revision++
  touched = false
  attempted = false
  serverError = ""
  save.reset()
  updates.dataset.touched = "false"
  updates.dataset.dirty = "false"
  renderName(false)
})
updates.dataset.touched = "false"
renderName()
renderCheckbox()
