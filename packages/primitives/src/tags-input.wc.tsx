import {
  event,
  formControl,
  host,
  onConnected,
  onDisconnected,
  state,
  type ComponentOptions,
} from "@naos-ui/core"
import { bindTagsInput, tagsInputValueArray } from "./internal/behavior/tags-input.js"
import css from "./tags-input.wc.css?inline"

export type NaosTagsInputProps = {
  allowDuplicates?: boolean
  delimiter?: string
  disabled?: boolean
  label?: string
  max?: number
  name?: string
  placeholder?: string
  value?: string
}

export const options = {
  styles: [css],
} satisfies ComponentOptions

export function NaosTagsInput({
  allowDuplicates = false,
  delimiter = ",",
  disabled = false,
  label = "Tags",
  max = 10,
  name = "",
  placeholder = "Add tag",
  value = "",
}: NaosTagsInputProps = {}) {
  const current = state(tagsInputValueArray(value, delimiter))
  const input = state("")
  const highlighted = state<number | null>(null)
  const editing = state<number | null>(null)
  const controller = state<ReturnType<typeof bindTagsInput>>(null)
  const changed = event<{ value: string[]; valueAsString: string }>("naos-change")
  const inputChanged = event<{ inputValue: string }>("naos-input")
  const highlightedChanged = event<{ highlightedValue: string | null }>("naos-highlight-change")
  const invalid = event<{ reason: string }>("naos-invalid")
  const form = formControl({
    value: () => current().join(","),
    reset: () => controller()?.reset(tagsInputValueArray(value, delimiter)),
    disabled,
  })
  void form
  void name
  void allowDuplicates
  void max

  onConnected(() => {
    const component = host<NaosTagsInputProps>()
    controller.set(
      bindTagsInput({
        root: component.root,
        signal: component.signal,
        settings: () => ({
          ...host<NaosTagsInputProps>().props,
          disabled: host<NaosTagsInputProps>().element.matches(":disabled"),
        }),
        values: current,
        write(next) {
          current.set(next)
          changed.emit({ value: next, valueAsString: next.join(",") })
        },
        input(next) {
          input.set(next)
          inputChanged.emit({ inputValue: next })
        },
        highlight(index, highlightedValue) {
          highlighted.set(index)
          highlightedChanged.emit({ highlightedValue })
        },
        edit(index) {
          editing.set(index)
        },
        invalid(reason) {
          invalid.emit({ reason })
        },
      }),
    )
  })
  onDisconnected(() => {
    controller.set(null)
    highlighted.set(null)
    editing.set(null)
  })

  return (
    <section
      part="root"
      data-scope="tags-input"
      data-part="root"
      data-state={current().length === 0 ? "empty" : "filled"}
      data-disabled={disabled || undefined}
      data-value={current().join(",")}
    >
      <label part="label" data-scope="tags-input" data-part="label" {...{ for: "tags-input" }}>
        {label}
      </label>
      <div part="control" data-scope="tags-input" data-part="control">
        {current().map((tagValue, tagIndex) => (
          <span
            key={`${tagValue}-${tagIndex}`}
            part="item"
            data-scope="tags-input"
            data-part="item"
            data-value={tagValue}
            data-index={tagIndex}
            data-disabled={disabled || undefined}
          >
            <span
              part="item-preview"
              data-scope="tags-input"
              data-part="item-preview"
              data-value={tagValue}
              data-highlighted={highlighted() === tagIndex || undefined}
              hidden={editing() === tagIndex}
            >
              <span part="item-text" data-scope="tags-input" data-part="item-text">
                {tagValue}
              </span>
              <button
                part="item-delete"
                data-scope="tags-input"
                data-part="item-delete-trigger"
                type="button"
                aria-label={`Delete tag ${tagValue}`}
                disabled={disabled}
                tabindex={-1}
              >
                x
              </button>
            </span>
            <input
              part="item-input"
              data-scope="tags-input"
              data-part="item-input"
              data-index={tagIndex}
              aria-label={`Edit tag ${tagValue}`}
              hidden={editing() !== tagIndex}
              value={tagValue}
              disabled={disabled}
              tabindex={-1}
            />
          </span>
        ))}
        <input
          id="tags-input"
          part="input"
          data-scope="tags-input"
          data-part="input"
          {...{
            autocomplete: "off",
            autocorrect: "off",
            autocapitalize: "none",
            enterkeyhint: "done",
          }}
          placeholder={current().length === 0 ? placeholder : undefined}
          value={input()}
          disabled={disabled}
        />
        <button
          part="clear"
          data-scope="tags-input"
          data-part="clear-trigger"
          type="button"
          aria-label="Clear tags"
          hidden={current().length === 0}
          disabled={disabled}
        >
          Clear
        </button>
      </div>
    </section>
  )
}
