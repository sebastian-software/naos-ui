import { type ComponentOptions } from "@iktia/core"
import css from "./menu-item.wc.css?inline"

export type IktiaMenuItemProps = {
  disabled?: boolean
  label?: string
  value?: string
}

export const options = {
  styles: [css],
} satisfies ComponentOptions

export function IktiaMenuItem({
  disabled = false,
  label = "",
  value = "",
}: IktiaMenuItemProps = {}) {
  void disabled
  void value

  return (
    <span part="root">
      <span part="label">
        <slot>{label || value}</slot>
      </span>
    </span>
  )
}
