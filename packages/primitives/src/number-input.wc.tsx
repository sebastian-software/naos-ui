import {
  computed,
  event,
  formControl,
  host,
  onConnected,
  onDisconnected,
  state,
  type ComponentOptions,
} from "@iktia/core"
import {
  createIktiaZagNumberInputService,
  getIktiaZagNumberInputApi,
  stopIktiaZagNumberInputService,
} from "./internal/zag/number-input.js"
import type { IktiaZagNumberInputService } from "./internal/zag/number-input.js"
import css from "./number-input.wc.css?inline"

export type IktiaNumberInputProps = {
  disabled?: boolean
  label?: string
  max?: number
  min?: number
  name?: string
  step?: number
  value?: string
}

export const options = {
  styles: [css],
} satisfies ComponentOptions

export function IktiaNumberInput({
  disabled = false,
  label = "Number",
  max = 100,
  min = 0,
  name = "",
  step = 1,
  value = "",
}: IktiaNumberInputProps = {}) {
  const current = state(value)
  const numeric = state(Number(value))
  const numberInputService = state<IktiaZagNumberInputService | null>(null)
  const numberInputApi = computed(() => getIktiaZagNumberInputApi(numberInputService()))
  const changed = event<{ value: string; valueAsNumber: number }>("iktia-change")
  const form = formControl({
    value: () => current(),
    reset: () => {
      current.set(value)
      numeric.set(Number(value))
      if (value === "") {
        numberInputApi()?.clearValue()
      } else {
        numberInputApi()?.setValue(Number(value))
      }
    },
    disabled,
  })
  void form
  void name

  onConnected(() => {
    numberInputService.set(createIktiaZagNumberInputService({
      disabled,
      host: host().element,
      id: "iktia-number-input",
      label,
      max,
      min,
      onValueChange(details) {
        current.set(details.value)
        numeric.set(details.valueAsNumber)
        changed.emit(details)
      },
      root: host().root,
      step,
      value,
    }))
  })
  onDisconnected(() => {
    stopIktiaZagNumberInputService(numberInputService())
    numberInputService.set(null)
  })

  return (
    <section
      {...(numberInputApi()?.getRootProps() ?? {})}
      part="root"
      data-state={current() === "" ? "empty" : "filled"}
      data-disabled={disabled || undefined}
      data-invalid={numberInputApi()?.invalid || undefined}
    >
      <label {...(numberInputApi()?.getLabelProps() ?? {})} part="label">
        {label}
      </label>
      <div {...(numberInputApi()?.getControlProps() ?? {})} part="control">
        <button
          {...(numberInputApi()?.getDecrementTriggerProps() ?? {})}
          part="decrement"
        >
          -
        </button>
        <input
          {...(numberInputApi()?.getInputProps() ?? {})}
          part="input"
          name={undefined}
          value={current()}
          disabled={disabled}
        />
        <button
          {...(numberInputApi()?.getIncrementTriggerProps() ?? {})}
          part="increment"
        >
          +
        </button>
      </div>
      <output {...(numberInputApi()?.getValueTextProps() ?? {})} part="value">
        {Number.isNaN(numeric()) ? "" : current()}
      </output>
    </section>
  )
}
