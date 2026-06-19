import { event, on, type ComponentOptions } from "@iktia/core"
import { createIktiaToast } from "./internal/zag/toast.js"
import css from "./toast.wc.css?inline"

export type IktiaToastProps = {
  closable?: boolean
  description?: string
  duration?: number
  label?: string
  title?: string
  type?: "success" | "error" | "loading" | "info" | "warning"
}

export const options = {
  styles: [css],
} satisfies ComponentOptions

export function IktiaToast({
  closable = true,
  description = "",
  duration = 5000,
  label = "Show notification",
  title = "Notification",
  type = "info",
}: IktiaToastProps = {}) {
  const created = event<{ id: string }>("iktia-create")

  return (
    <button
      part="trigger"
      type="button"
      data-type={type}
      onClick={on("click", () => {
        const id = createIktiaToast({
          closable,
          description,
          duration,
          title,
          type,
        })
        created.emit({ id })
      })}
    >
      <slot>{label}</slot>
    </button>
  )
}
