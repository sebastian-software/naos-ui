import { type ComponentOptions } from "@iktia/core"
import css from "./radio.wc.css?inline"

export type IktiaRadioProps = {
  disabled?: boolean
  label?: string
  value?: string
}

export const options = {
  styles: [css],
} satisfies ComponentOptions

export function IktiaRadio({
  disabled = false,
  label = "",
  value = "",
}: IktiaRadioProps = {}) {
  void disabled
  void value

  return (
    <span part="root">
      <span part="control" aria-hidden="true">
        <span part="indicator" />
      </span>
      <span part="label">
        <slot>{label || value}</slot>
      </span>
    </span>
  )
}
