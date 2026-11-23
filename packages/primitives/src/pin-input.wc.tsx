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
import { otpInput } from "@ui-sdk/core/otp-input"
import {
  pinKeyAction,
  pinPattern,
  pinSlots,
  type NaosPinInputType,
} from "./internal/ui-sdk/pin-input.js"
import css from "./pin-input.wc.css?inline"

export type NaosPinInputProps = {
  count?: number
  disabled?: boolean
  label?: string
  mask?: boolean
  name?: string
  otp?: boolean
  placeholder?: string
  type?: NaosPinInputType
  value?: string
}
export const options = { styles: [css] } satisfies ComponentOptions
export function NaosPinInput({
  count = 4,
  disabled = false,
  label = "Code",
  mask = false,
  name = "",
  otp = false,
  placeholder = "○",
  type = "numeric",
  value = "",
}: NaosPinInputProps = {}) {
  const current = state(value)
  const slots = computed(() => pinSlots(count))
  const controller = state<ReturnType<typeof otpInput> | null>(null)
  const changed = event<{ complete: boolean; value: string }>("naos-change")
  const completed = event<{ value: string }>("naos-complete")
  const invalid = event<{ index: number; value: string }>("naos-invalid")
  const form = formControl({
    value: () => current(),
    reset: () => {
      current.set(value)
      controller()?.api.setValue(value)
    },
    disabled,
  })
  void form
  void name
  onConnected(() => {
    controller.set(
      otpInput({
        id: "naos-pin-input",
        defaultValue: current(),
        maxLength: count,
        pattern: pinPattern(type),
        onValueChange(next) {
          current.set(next)
          changed.emit({ complete: next.length >= count, value: next })
        },
        onValueCommit(next) {
          completed.emit({ value: next })
        },
      }),
    )
  })
  onDisconnected(() => {
    controller()?.destroy()
    controller.set(null)
  })
  return (
    <section
      part="root"
      data-state={current().length >= count ? "complete" : "incomplete"}
      data-disabled={disabled || undefined}
      data-value={current()}
    >
      <label part="label">{label}</label>
      <div part="control" role="group" aria-label={label}>
        {slots().map((slot) => (
          <input
            key={String(slot)}
            part="input"
            type={mask ? "password" : "text"}
            inputmode={type === "numeric" ? "numeric" : "text"}
            autocomplete={otp && slot === 0 ? "one-time-code" : "off"}
            aria-label={`${label} ${slot + 1} of ${count}`}
            maxlength={count}
            placeholder={placeholder}
            value={current()[slot] ?? ""}
            disabled={disabled}
            data-complete={current().length >= count || undefined}
            onInput={(event) => {
              if (disabled) return
              const input = event.currentTarget as HTMLInputElement
              const incoming = (event as InputEvent).data ?? input.value
              const before = current()
              const pattern = pinPattern(type)
              if (Array.from(incoming).some((character) => !pattern.test(character))) {
                invalid.emit({ index: slot, value: incoming })
                input.value = before[slot] ?? ""
                return
              }
              const start = incoming.length >= count ? 0 : Math.min(slot, before.length)
              const candidate =
                before.slice(0, start) +
                incoming +
                before.slice(start + Math.max(1, incoming.length))
              controller()?.api.setValue(candidate, { reason: "input-change", event })
              input.value = controller()?.api.getValue()[slot] ?? ""
              const next =
                host().root.querySelectorAll('[part~="input"]')[
                  Math.min(start + incoming.length, count - 1)
                ]
              if (next instanceof HTMLElement) next.focus()
            }}
            onKeyDown={(event) => {
              if (
                disabled ||
                event.defaultPrevented ||
                event.isComposing ||
                event.altKey ||
                event.ctrlKey ||
                event.metaKey
              )
                return
              const action = pinKeyAction(event.key, slot, current(), count)
              if (!action) return
              event.preventDefault()
              if (action.value !== current())
                controller()?.api.setValue(action.value, { reason: "input-change", event })
              const next = host().root.querySelectorAll('[part~="input"]')[action.focus]
              if (next instanceof HTMLElement) next.focus()
            }}
          />
        ))}
      </div>
    </section>
  )
}
