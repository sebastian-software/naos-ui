type EditableOptions = {
  root: ParentNode
  signal: AbortSignal
  disabled(): boolean
  value(): string
  editing(): boolean
  submitMode(): "enter" | "blur" | "both" | "none"
  change(value: string): void
  edit(editing: boolean): void
  submit(value: string): void
  cancel(value: string): void
}

export function bindEditable(options: EditableOptions) {
  const { root, signal } = options
  const preview = root.querySelector<HTMLElement>('[part~="preview"]')
  const input = root.querySelector<HTMLInputElement>('[part~="input"]')
  const label = root.querySelector<HTMLElement>('[part~="label"]')
  const edit = root.querySelector<HTMLButtonElement>('[part~="edit"]')
  const submit = root.querySelector<HTMLButtonElement>('[part~="submit"]')
  const cancel = root.querySelector<HTMLButtonElement>('[part~="cancel"]')
  if (!preview || !input || !edit || !submit || !cancel) return null
  const scope = { signal }
  let previous = options.value()

  const start = () => {
    if (options.disabled() || options.editing()) return
    previous = options.value()
    options.edit(true)
    queueMicrotask(() => {
      if (!signal.aborted && options.editing()) input.select()
    })
  }
  const finish = (commit: boolean, restoreFocus: boolean) => {
    if (!options.editing()) return
    if (commit) {
      options.submit(options.value())
    } else {
      if (previous !== options.value()) options.change(previous)
      options.cancel(previous)
    }
    options.edit(false)
    if (restoreFocus) {
      queueMicrotask(() => {
        if (!signal.aborted && !options.editing()) edit.focus()
      })
    }
  }

  preview.addEventListener("focus", start, scope)
  edit.addEventListener("click", start, scope)
  label?.addEventListener("click", start, scope)
  input.addEventListener("input", () => options.change(input.value), scope)
  input.addEventListener(
    "keydown",
    (event) => {
      if (event.defaultPrevented || event.isComposing) return
      const submitMode = options.submitMode()
      if (event.key === "Escape") {
        event.preventDefault()
        finish(false, true)
      } else if (
        event.key === "Enter" &&
        !event.shiftKey &&
        !event.metaKey &&
        (submitMode === "both" || submitMode === "enter")
      ) {
        event.preventDefault()
        finish(true, true)
      }
    },
    scope,
  )
  const leave = (target: EventTarget | null) => {
    if (target === input || target === submit || target === cancel) return
    const mode = options.submitMode()
    finish(mode === "both" || mode === "blur", false)
  }
  input.addEventListener("blur", (event) => leave(event.relatedTarget), scope)
  submit.addEventListener("blur", (event) => leave(event.relatedTarget), scope)
  cancel.addEventListener("blur", (event) => leave(event.relatedTarget), scope)
  // Keep input focus until click so explicit Save and Cancel also work on browsers
  // that do not focus a button when it is pressed with the pointer.
  submit.addEventListener("mousedown", (event) => event.preventDefault(), scope)
  cancel.addEventListener("mousedown", (event) => event.preventDefault(), scope)
  submit.addEventListener("click", () => finish(true, true), scope)
  cancel.addEventListener("click", () => finish(false, true), scope)
  return {
    reset(next: string) {
      if (next !== options.value()) options.change(next)
      if (options.editing()) options.edit(false)
    },
  }
}
