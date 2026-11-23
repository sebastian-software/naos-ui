import {
  computed,
  event,
  formControl,
  host,
  onConnected,
  onDisconnected,
  state,
  type ComponentOptions,
} from "@naos-ui/core"
import { rating } from "@ui-sdk/core/rating"
import { ratingItems, ratingKeyboardValue } from "./internal/ui-sdk/rating.js"
import css from "./rating-group.wc.css?inline"

export type NaosRatingGroupProps = {
  allowHalf?: boolean
  count?: number
  disabled?: boolean
  label?: string
  name?: string
  readOnly?: boolean
  required?: boolean
  value?: number
}
export const options = { styles: [css] } satisfies ComponentOptions

export function NaosRatingGroup({
  allowHalf = false,
  count = 5,
  disabled = false,
  label = "Rating",
  name = "",
  readOnly = false,
  required = false,
  value = 0,
}: NaosRatingGroupProps = {}) {
  const current = state(value)
  const hovered = state(-1)
  const items = computed(() => ratingItems(count))
  const controller = state<ReturnType<typeof rating> | null>(null)
  const changed = event<{ value: number }>("naos-change")
  const hoverChanged = event<{ hoveredValue: number }>("naos-hover-change")
  const form = formControl({
    value: () => (current() > 0 ? String(current()) : null),
    reset: () => {
      current.set(value)
      controller()?.api.setValue(value > 0 ? value : null)
    },
    disabled,
  })
  void form
  void name
  onConnected(() => {
    controller.set(
      rating({
        id: "naos-rating-group",
        defaultValue: current() > 0 ? current() : null,
        max: count,
        step: allowHalf ? 0.5 : 1,
        onValueChange(next) {
          current.set(next ?? 0)
          changed.emit({ value: next ?? 0 })
        },
      }),
    )
  })
  onDisconnected(() => {
    controller()?.destroy()
    controller.set(null)
    hovered.set(-1)
  })
  return (
    <section
      part="root"
      aria-disabled={disabled || undefined}
      data-disabled={disabled || undefined}
      data-readonly={readOnly || undefined}
      data-hovering={hovered() >= 0 ? "" : undefined}
      data-state={current() > 0 ? "filled" : "empty"}
      data-value={current() > 0 ? String(current()) : ""}
    >
      <label part="label">{label}</label>
      <div
        part="control"
        role="radiogroup"
        aria-label={label}
        aria-required={required || undefined}
        onPointerLeave={() => {
          if (hovered() !== -1) {
            hovered.set(-1)
            hoverChanged.emit({ hoveredValue: -1 })
          }
        }}
      >
        {items().map((itemIndex) => (
          <span
            key={String(itemIndex)}
            part="item"
            role="radio"
            aria-label={`${Math.ceil(current()) === itemIndex && current() % 1 !== 0 ? current() : itemIndex} of ${count}`}
            aria-posinset={itemIndex}
            aria-setsize={count}
            aria-checked={Math.ceil(current()) === itemIndex ? "true" : "false"}
            aria-disabled={disabled ? "true" : undefined}
            tabindex={
              Math.ceil(current()) === itemIndex || (current() <= 0 && itemIndex === 1) ? 0 : -1
            }
            data-checked={current() > itemIndex - 1 ? "" : undefined}
            data-highlighted={hovered() > itemIndex - 1 ? "" : undefined}
            data-half={
              (hovered() >= 0 ? hovered() : current()) === itemIndex - 0.5 ? "" : undefined
            }
            data-state={current() > itemIndex - 1 ? "checked" : "unchecked"}
            onClick={(event) => {
              if (disabled || readOnly) return
              const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
              const next =
                allowHalf && event.clientX < rect.left + rect.width / 2
                  ? itemIndex - 0.5
                  : itemIndex
              controller()?.api.setValue(next, { reason: "item-press", event })
              ;(event.currentTarget as HTMLElement).focus()
            }}
            onPointerMove={(event) => {
              if (disabled || readOnly) return
              const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
              const next =
                allowHalf && event.clientX < rect.left + rect.width / 2
                  ? itemIndex - 0.5
                  : itemIndex
              if (next !== hovered()) {
                hovered.set(next)
                hoverChanged.emit({ hoveredValue: next })
              }
            }}
            onKeyDown={(event) => {
              if (disabled || readOnly) return
              const next = ratingKeyboardValue(event.key, current(), count, allowHalf, itemIndex)
              if (next == null) return
              event.preventDefault()
              if (hovered() !== -1) {
                hovered.set(-1)
                hoverChanged.emit({ hoveredValue: -1 })
              }
              controller()?.api.setValue(next, { reason: "list-navigation", event })
              queueMicrotask(() => {
                const item = host().root.querySelector(`[aria-posinset="${Math.ceil(next)}"]`)
                if (item instanceof HTMLElement) item.focus()
              })
            }}
          >
            *
          </span>
        ))}
      </div>
      <input part="input" type="text" hidden value={current() > 0 ? String(current()) : ""} />
    </section>
  )
}
