import { type ComponentOptions } from "@iktia/core"
import css from "./select-item.wc.css?inline"

export type IktiaSelectItemProps = {
  disabled?: boolean
  label?: string
  value?: string
}

export const options = {
  styles: [css],
} satisfies ComponentOptions

export function IktiaSelectItem({
  disabled = false,
  label = "",
  value = "",
}: IktiaSelectItemProps = {}) {
  void disabled
  void value

  return (
    <span part="root">
      <span part="label">
        <slot>{label || value}</slot>
      </span>
      <span part="indicator" aria-hidden="true">*</span>
    </span>
  )
}
