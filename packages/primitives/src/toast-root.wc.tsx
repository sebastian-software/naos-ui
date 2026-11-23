import "@ui-sdk/web/toast"
import {
  event,
  host,
  onConnected,
  onDisconnected,
  state,
  type ComponentOptions,
} from "@naos-ui/core"
import { bindToastRegion } from "./internal/ui-sdk/toast.js"
import css from "./toast-root.wc.css?inline"

export type NaosToastRootProps = {
  label?: string
  placement?: "top-start" | "top" | "top-end" | "bottom-start" | "bottom" | "bottom-end"
}

export const options = {
  styles: [css],
} satisfies ComponentOptions

export function NaosToastRoot({
  label = "Notifications",
  placement = "bottom-end",
}: NaosToastRootProps = {}) {
  const count = state(0)
  const unsubscribe = state<VoidFunction | null>(null)
  const statusChanged = event<{ id: string; status: string }>("naos-status-change")
  onConnected(() => {
    const region = host().root.querySelector("ui-toast-region")
    if (region)
      unsubscribe.set(
        bindToastRegion(
          region,
          (next) => count.set(next),
          (id, status) => statusChanged.emit({ id, status }),
        ),
      )
  })
  onDisconnected(() => {
    unsubscribe()?.()
    unsubscribe.set(null)
  })
  return (
    <ui-toast-region
      part="root"
      role="region"
      aria-label={label}
      max-visible="4"
      {...{
        side: placement.startsWith("top") ? "top" : "bottom",
        align: placement.endsWith("start") ? "start" : placement.endsWith("end") ? "end" : "center",
      }}
      data-count={String(count())}
      data-placement={placement}
    />
  )
}
