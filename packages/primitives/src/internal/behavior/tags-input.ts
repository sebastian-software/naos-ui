export function tagsInputValueArray(value: string, delimiter: string): string[] {
  return (delimiter ? value.split(delimiter) : [value]).map((item) => item.trim()).filter(Boolean)
}

type TagsInputOptions = {
  root: ParentNode
  signal: AbortSignal
  settings(): { allowDuplicates?: boolean; delimiter?: string; disabled?: boolean; max?: number }
  values(): string[]
  write(values: string[]): void
  input(next: string): void
  highlight(index: number | null, value: string | null): void
  edit(index: number | null): void
  invalid(reason: "invalidTag" | "rangeOverflow"): void
}

export function bindTagsInput(options: TagsInputOptions) {
  const { root, signal } = options
  const input = root.querySelector<HTMLInputElement>('[part~="input"]')
  const control = root.querySelector<HTMLElement>('[part~="control"]')
  if (!input || !control) return null

  const listenerOptions = { signal }
  let highlighted: number | null = null
  let edited: number | null = null
  const setHighlight = (index: number | null) => {
    if (index === highlighted) return
    highlighted = index
    options.highlight(index, index === null ? null : (options.values()[index] ?? null))
  }
  const clearDraft = () => {
    if (input.value === "") return
    input.value = ""
    options.input("")
  }
  const commit = (values: string[]) => {
    const previous = options.values()
    if (
      values.length !== previous.length ||
      values.some((value, index) => value !== previous[index])
    ) {
      options.write(values)
    }
  }
  const add = (values: string[]) => {
    if (values.length === 0) {
      options.invalid("invalidTag")
      return
    }
    const { allowDuplicates, max = 10 } = options.settings()
    const previous = options.values()
    const all = [...previous, ...values]
    const next = allowDuplicates ? all : [...new Set(all)]
    if (next.length > max) {
      options.invalid("rangeOverflow")
      return
    }
    commit(next)
  }
  const remove = (index: number) => {
    setHighlight(null)
    commit(options.values().filter((_, position) => position !== index))
    input.focus()
  }
  const editInput = () =>
    root.querySelector<HTMLInputElement>(`[part~="item-input"][data-index="${edited}"]`)
  const startEdit = (index: number) => {
    edited = index
    setHighlight(null)
    options.edit(index)
    queueMicrotask(() => {
      if (!signal.aborted && edited === index) editInput()?.select()
    })
  }
  const endEdit = (save: boolean, restoreFocus: boolean) => {
    if (edited === null) return
    const index = edited
    const next = editInput()?.value.trim()
    edited = null
    options.edit(null)
    if (save && next) {
      const values = options.values()
      if (
        options.settings().allowDuplicates ||
        !values.some((value, i) => i !== index && value === next)
      ) {
        commit(values.map((value, i) => (i === index ? next : value)))
      }
    }
    if (restoreFocus) input.focus()
  }
  const disabled = () => Boolean(options.settings().disabled)

  input.addEventListener(
    "input",
    (event) => {
      if (disabled()) return
      setHighlight(null)
      const { delimiter = "," } = options.settings()
      if (event instanceof InputEvent && event.isComposing) {
        options.input(input.value)
        return
      }
      if (
        (event instanceof InputEvent && event.inputType === "insertFromPaste") ||
        (delimiter !== "" && input.value.endsWith(delimiter))
      ) {
        add(tagsInputValueArray(input.value, delimiter))
        clearDraft()
        return
      }
      options.input(input.value)
    },
    listenerOptions,
  )

  input.addEventListener(
    "keydown",
    (event) => {
      if (disabled() || event.defaultPrevented || event.isComposing) return
      const values = options.values()
      if (event.key === "Enter") {
        event.preventDefault()
        if (highlighted !== null) startEdit(highlighted)
        else {
          add(tagsInputValueArray(input.value, options.settings().delimiter ?? ","))
          clearDraft()
        }
        return
      }
      if (event.key === "Escape") {
        if (highlighted !== null) {
          event.preventDefault()
          setHighlight(null)
        }
        return
      }
      if (input.value !== "" || values.length === 0) return
      const rtl = getComputedStyle(input).direction === "rtl"
      const backwardKey = rtl ? "ArrowRight" : "ArrowLeft"
      const forwardKey = rtl ? "ArrowLeft" : "ArrowRight"
      if (event.key === backwardKey || (event.key === "Backspace" && highlighted === null)) {
        event.preventDefault()
        setHighlight(Math.max(0, (highlighted ?? values.length) - 1))
      } else if (event.key === forwardKey && highlighted !== null) {
        event.preventDefault()
        setHighlight(highlighted < values.length - 1 ? highlighted + 1 : null)
      } else if ((event.key === "Backspace" || event.key === "Delete") && highlighted !== null) {
        event.preventDefault()
        remove(highlighted)
      }
    },
    listenerOptions,
  )

  const itemIndex = (event: Event) => {
    if (!(event.target instanceof HTMLElement)) return null
    const index = event.target.closest<HTMLElement>('[part~="item"]')?.dataset.index
    return index == null ? null : Number(index)
  }
  control.addEventListener(
    "click",
    (event) => {
      if (disabled() || event.defaultPrevented || !(event.target instanceof HTMLElement)) return
      const index = itemIndex(event)
      if (event.target.closest('[part~="clear"]')) {
        setHighlight(null)
        clearDraft()
        commit([])
        input.focus()
      } else if (index !== null && event.target.closest('[part~="item-delete"]')) {
        remove(index)
      } else if (index !== null && event.target.closest('[part~="item-preview"]')) {
        setHighlight(index)
        input.focus()
      }
    },
    listenerOptions,
  )
  control.addEventListener(
    "dblclick",
    (event) => {
      if (disabled() || event.defaultPrevented || !(event.target instanceof HTMLElement)) return
      const index = itemIndex(event)
      if (
        index !== null &&
        event.target.closest('[part~="item-preview"]') &&
        !event.target.closest('[part~="item-delete"]')
      )
        startEdit(index)
    },
    listenerOptions,
  )
  control.addEventListener(
    "keydown",
    (event) => {
      if (event.defaultPrevented || event.isComposing || event.target !== editInput()) return
      if (event.key !== "Enter" && event.key !== "Escape") return
      event.preventDefault()
      endEdit(event.key === "Enter", true)
    },
    listenerOptions,
  )
  control.addEventListener(
    "focusout",
    (event) => {
      if (event.target === editInput()) endEdit(true, false)
      if (event.relatedTarget instanceof Node && control.contains(event.relatedTarget)) return
      setHighlight(null)
      clearDraft()
    },
    listenerOptions,
  )

  return {
    reset(values: string[]) {
      endEdit(false, false)
      setHighlight(null)
      clearDraft()
      commit(values)
    },
  }
}
