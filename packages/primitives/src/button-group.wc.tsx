import { type ComponentOptions } from "@iktia/core"
import css from "./button-group.wc.css?inline"

export type IktiaButtonGroupProps = {
  disabled?: boolean
  label?: string
  orientation?: string
}

export const options = {
  styles: [css],
} satisfies ComponentOptions

export function IktiaButtonGroup({
  disabled = false,
  label = "Actions",
  orientation = "horizontal",
}: IktiaButtonGroupProps = {}) {
  return (
    <div
      part="root"
      role="group"
      aria-label={label}
      aria-orientation={orientation}
      data-disabled={disabled || undefined}
      data-orientation={orientation}
    >
      <slot />
    </div>
  )
}
