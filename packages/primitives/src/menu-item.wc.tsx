import { event, type ComponentOptions } from "@naos-ui/core"
import css from "./menu-item.wc.css?inline"

export type NaosMenuItemProps = {
  checked?: boolean
  disabled?: boolean
  name?: string
  type?: "action" | "checkbox" | "radio"
  label?: string
  value?: string
}

export const options = {
  styles: [css],
} satisfies ComponentOptions

export function NaosMenuItem({
  checked = false,
  disabled = false,
  label = "",
  name = "",
  type = "action",
  value = "",
}: NaosMenuItemProps = {}) {
  const checkedChange = event<{ value: string; checked: boolean }>("naos-checked-change")
  void checkedChange
  void checked
  void name
  void type
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
