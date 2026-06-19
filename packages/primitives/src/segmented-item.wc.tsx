import { type ComponentOptions } from "@iktia/core"
import css from "./segmented-item.wc.css?inline"

export type IktiaSegmentedItemProps = {
  disabled?: boolean
  label?: string
  value?: string
}

export const options = {
  styles: [css],
} satisfies ComponentOptions

export function IktiaSegmentedItem({
  disabled = false,
  label = "",
  value = "",
}: IktiaSegmentedItemProps = {}) {
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
