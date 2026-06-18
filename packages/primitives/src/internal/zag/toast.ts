import {
  connect,
  createStore as createToastStore,
  group,
  machine as toastMachine,
  type Api as ZagToastApi,
  type GroupApi as ZagToastGroupApi,
  type GroupService as ZagToastGroupService,
  type Options as ZagToastOptions,
  type Placement,
  type Props as ZagToastProps,
  type Service as ZagToastService,
  type Status,
  type StatusChangeDetails,
  type Type as ZagToastType,
} from "@zag-js/toast"

import { normalizeZagProps } from "./props.js"
import { createZagScope } from "./scope.js"
import { createZagService } from "./service.js"

export type IktiaZagToastService = ReturnType<typeof createZagService>
export type IktiaZagToastGroupService = ReturnType<typeof createZagService>

export type IktiaToastView = {
  description: string
  id: string
  service: IktiaZagToastService
  status: Status
  title: string
  type: ZagToastType
}

type IktiaZagToastGroupServiceOptions = {
  host: HTMLElement
  id: string
  placement: Placement
  root: ParentNode
}

type IktiaZagToastServiceOptions = {
  host: HTMLElement
  index: number
  onStatusChange(details: StatusChangeDetails): void
  parent: ZagToastGroupService
  root: ParentNode
  toast: Required<Pick<ZagToastProps<string>, "id" | "type">> & ZagToastProps<string>
}

type SyncIktiaToastServicesOptions = {
  current: IktiaToastView[]
  host: HTMLElement
  onStatusChange(id: string, details: StatusChangeDetails): void
  parent: IktiaZagToastGroupService
  root: ParentNode
}

export const iktiaToastStore = createToastStore<string>({
  duration: 5000,
  max: 4,
  placement: "bottom-end",
  removeDelay: 0,
})

export function createIktiaToast(options: ZagToastOptions<string>): string {
  return iktiaToastStore.create({
    closable: true,
    ...options,
  })
}

export function removeIktiaToast(id: string) {
  iktiaToastStore.remove(id)
}

export function subscribeIktiaToasts(callback: VoidFunction): VoidFunction {
  return iktiaToastStore.subscribe(callback)
}

export function createIktiaZagToastGroupService({
  host,
  id,
  placement,
  root,
}: IktiaZagToastGroupServiceOptions): IktiaZagToastGroupService {
  iktiaToastStore.attrs.placement = placement

  return createZagService({
    machine: group.machine as never,
    props: {
      id,
      store: iktiaToastStore,
    },
    scope: createZagScope({
      host,
      id,
      root: root as Document | ShadowRoot,
    }),
  })
}

export function getIktiaZagToastGroupApi(
  service: IktiaZagToastGroupService | null
): ZagToastGroupApi | null {
  if (service == null) return null
  return group.connect(service as never, normalizeZagProps as never)
}

export function createIktiaZagToastService({
  host,
  index,
  onStatusChange,
  parent,
  root,
  toast,
}: IktiaZagToastServiceOptions): IktiaZagToastService {
  return createZagService({
    machine: toastMachine as never,
    props: {
      ...toast,
      index,
      parent,
      translations: {
        closeTriggerLabel: "Dismiss notification",
      },
      onStatusChange,
    },
    scope: createZagScope({
      host,
      id: toast.id,
      root: root as Document | ShadowRoot,
    }),
  })
}

export function getIktiaZagToastApi(
  service: IktiaZagToastService | null
): ZagToastApi | null {
  if (service == null) return null
  return connect(service as never, normalizeZagProps as never)
}

export function syncIktiaToastServices({
  current,
  host,
  onStatusChange,
  parent,
  root,
}: SyncIktiaToastServicesOptions): IktiaToastView[] {
  const existing = new Map(current.map((toast) => [toast.id, toast]))
  const nextToasts = iktiaToastStore.getVisibleToasts()

  const next = nextToasts.map((toast, index) => {
    const id = String(toast.id)
    const existingToast = existing.get(id)
    if (existingToast) {
      existing.delete(id)
      return {
        ...existingToast,
        description: String(toast.description ?? ""),
        title: String(toast.title ?? ""),
        type: toast.type ?? "info",
      }
    }

    const service = createIktiaZagToastService({
      host,
      index,
      onStatusChange: (details) => onStatusChange(id, details),
      parent: parent as never,
      root,
      toast: {
        ...toast,
        id,
        type: toast.type ?? "info",
      } as Required<Pick<ZagToastProps<string>, "id" | "type">> & ZagToastProps<string>,
    })

    return {
      description: String(toast.description ?? ""),
      id,
      service,
      status: "visible" as Status,
      title: String(toast.title ?? ""),
      type: toast.type ?? "info",
    }
  })

  for (const stale of existing.values()) {
    stale.service.stop()
  }

  return next
}

export function stopIktiaToastServices(toasts: IktiaToastView[]) {
  for (const toast of toasts) {
    toast.service.stop()
  }
}

export function stopIktiaZagToastGroupService(
  service: IktiaZagToastGroupService | null
) {
  service?.stop()
}
