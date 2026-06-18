import {
  computed,
  event,
  host,
  onConnected,
  onDisconnected,
  state,
  type ComponentOptions,
} from "@iktia/core"
import {
  getIktiaZagToastApi,
  getIktiaZagToastGroupApi,
  removeIktiaToast,
  createIktiaZagToastGroupService,
  stopIktiaToastServices,
  stopIktiaZagToastGroupService,
  subscribeIktiaToasts,
  syncIktiaToastServices,
} from "./internal/zag/toast.js"
import type {
  IktiaToastView,
  IktiaZagToastGroupService,
} from "./internal/zag/toast.js"
import css from "./toast-root.wc.css?inline"

export type IktiaToastRootProps = {
  label?: string
  placement?: "top-start" | "top" | "top-end" | "bottom-start" | "bottom" | "bottom-end"
}

export const options = {
  styles: [css],
} satisfies ComponentOptions

export function IktiaToastRoot({
  label = "Notifications",
  placement = "bottom-end",
}: IktiaToastRootProps = {}) {
  const groupService = state<IktiaZagToastGroupService | null>(null)
  const groupApi = computed(() => getIktiaZagToastGroupApi(groupService()))
  const toasts = state<IktiaToastView[]>([])
  const unsubscribe = state<VoidFunction | null>(null)
  const statusChanged = event<{ id: string; status: string }>("iktia-status-change")

  onConnected(() => {
    const service = createIktiaZagToastGroupService({
      host: host().element,
      id: "iktia-toast-root",
      placement,
      root: host().root,
    })
    groupService.set(service)
    toasts.set(syncIktiaToastServices({
      current: toasts(),
      host: host().element,
      onStatusChange(id, details) {
        statusChanged.emit({ id, status: details.status })
        if (details.status === "unmounted") {
          removeIktiaToast(id)
        }
        host().update()
      },
      parent: service,
      root: host().root,
    }))
    unsubscribe.set(subscribeIktiaToasts(() => {
      queueMicrotask(() => {
        toasts.set(syncIktiaToastServices({
          current: toasts(),
          host: host().element,
          onStatusChange(id, details) {
            statusChanged.emit({ id, status: details.status })
            if (details.status === "unmounted") {
              removeIktiaToast(id)
            }
            host().update()
          },
          parent: service,
          root: host().root,
        }))
      })
    }))
  })
  onDisconnected(() => {
    unsubscribe()?.()
    unsubscribe.set(null)
    stopIktiaToastServices(toasts())
    toasts.set([])
    stopIktiaZagToastGroupService(groupService())
    groupService.set(null)
  })

  return (
    <section
      {...(groupApi()?.getGroupProps({ label }) ?? {})}
      part="root"
      data-count={String(toasts().length)}
      data-placement={placement}
    >
      {toasts().map((toast) => (
        <article
          key={toast.id}
          {...(getIktiaZagToastApi(toast.service)?.getRootProps() ?? {})}
          part="toast"
          data-type={toast.type}
          data-state={toast.status}
        >
          <div
            {...(getIktiaZagToastApi(toast.service)?.getTitleProps() ?? {})}
            part="title"
          >
            {toast.title}
          </div>
          <div
            {...(getIktiaZagToastApi(toast.service)?.getDescriptionProps() ?? {})}
            part="description"
          >
            {toast.description}
          </div>
          <button
            {...(getIktiaZagToastApi(toast.service)?.getCloseTriggerProps() ?? {})}
            part="close"
          >
            Dismiss
          </button>
        </article>
      ))}
    </section>
  )
}
