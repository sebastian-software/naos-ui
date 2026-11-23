import {
  event,
  formControl,
  host,
  onConnected,
  onDisconnected,
  state,
  type ComponentOptions,
} from "@naos-ui/core"
import { bindEditable } from "./internal/behavior/editable.js"
import css from "./editable.wc.css?inline"

export type NaosEditableProps = {
  disabled?: boolean
  label?: string
  maxLength?: number
  name?: string
  placeholder?: string
  readOnly?: boolean
  required?: boolean
  submitMode?: "enter" | "blur" | "both" | "none"
  value?: string
}

export const options = {
  styles: [css],
} satisfies ComponentOptions

export function NaosEditable({
  disabled = false,
  label = "Editable",
  maxLength = 120,
  name = "",
  placeholder = "Edit value",
  readOnly = false,
  required = false,
  submitMode = "both",
  value = "",
}: NaosEditableProps = {}) {
  const current = state(value)
  const editing = state(false)
  const controller = state<ReturnType<typeof bindEditable>>(null)
  const changed = event<{ value: string }>("naos-change")
  const editChanged = event<{ edit: boolean }>("naos-edit-change")
  const submitted = event<{ value: string }>("naos-submit")
  const canceled = event<{ value: string }>("naos-cancel")
  const form = formControl({
    value: () => current() || null,
    reset: () => controller()?.reset(value),
    disabled,
  })
  void form
  void name
  void submitMode

  onConnected(() => {
    const component = host<NaosEditableProps>()
    controller.set(
      bindEditable({
        root: component.root,
        signal: component.signal,
        disabled: () =>
          Boolean(
            host<NaosEditableProps>().props.disabled || host<NaosEditableProps>().props.readOnly,
          ),
        value: current,
        editing,
        submitMode: () => host<NaosEditableProps>().props.submitMode ?? "both",
        change(next) {
          current.set(next)
          changed.emit({ value: next })
        },
        edit(next) {
          editing.set(next)
          editChanged.emit({ edit: next })
        },
        submit(next) {
          submitted.emit({ value: next })
        },
        cancel(next) {
          canceled.emit({ value: next })
        },
      }),
    )
  })
  onDisconnected(() => {
    controller.set(null)
  })

  return (
    <section
      part="root"
      data-scope="editable"
      data-part="root"
      data-state={editing() ? "edit" : "preview"}
      data-empty={current().trim() === "" || undefined}
      data-disabled={disabled || undefined}
      data-readonly={readOnly || undefined}
      data-value={current()}
    >
      <label
        id="editable-label"
        data-scope="editable"
        data-part="label"
        part="label"
        {...{ for: "editable-input" }}
      >
        {label}
      </label>
      <div data-scope="editable" data-part="area" data-focus={editing() || undefined} part="area">
        <span
          data-scope="editable"
          data-part="preview"
          aria-label={`Edit ${label}`}
          aria-disabled={disabled || undefined}
          aria-readonly={readOnly || undefined}
          tabindex={disabled || readOnly ? undefined : 0}
          data-placeholder-shown={current().trim() === "" || undefined}
          hidden={editing()}
          part="preview"
        >
          {current() || placeholder}
        </span>
        <input
          id="editable-input"
          aria-label={label}
          data-scope="editable"
          data-part="input"
          hidden={!editing()}
          placeholder={placeholder}
          required={required}
          {...{ maxlength: maxLength, readonly: readOnly }}
          part="input"
          value={current()}
          disabled={disabled}
        />
      </div>
      <div data-scope="editable" data-part="control" part="control">
        <button
          data-scope="editable"
          data-part="edit-trigger"
          type="button"
          aria-label={`Edit ${label}`}
          hidden={editing()}
          disabled={disabled || readOnly}
          part="edit"
        >
          Edit
        </button>
        <button
          data-scope="editable"
          data-part="submit-trigger"
          type="button"
          aria-label={`Save ${label}`}
          hidden={!editing()}
          disabled={disabled || readOnly}
          part="submit"
        >
          Save
        </button>
        <button
          data-scope="editable"
          data-part="cancel-trigger"
          type="button"
          aria-label={`Cancel ${label}`}
          hidden={!editing()}
          disabled={disabled || readOnly}
          part="cancel"
        >
          Cancel
        </button>
      </div>
    </section>
  )
}
