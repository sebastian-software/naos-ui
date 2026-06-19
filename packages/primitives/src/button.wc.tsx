import { event, on, type ComponentOptions } from "@iktia/core"
import css from "./button.wc.css?inline"

export type IktiaButtonProps = {
  disabled?: boolean
  label?: string
  variant?: string
}

export const options = {
  styles: [css],
} satisfies ComponentOptions

export function IktiaButton({
  disabled = false,
  label = "",
  variant = "default",
}: IktiaButtonProps = {}) {
  const pressed = event<{ variant: string }>("iktia-press")

  return (
    <button
      part="root control"
      type="button"
      data-variant={variant}
      data-disabled={disabled || undefined}
      disabled={disabled}
      onClick={on("click", () => {
        if (disabled) return
        pressed.emit({ variant })
      })}
    >
      <slot name="icon" />
      <slot>{label}</slot>
    </button>
  )
}
