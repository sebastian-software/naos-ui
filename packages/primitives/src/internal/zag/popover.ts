import {
  connect,
  machine as popoverMachine,
  type Api as ZagPopoverApi,
} from "@zag-js/popover"

import { normalizeZagProps } from "./props.js"
import { createZagScope } from "./scope.js"
import { createZagService } from "./service.js"

export type IktiaZagPopoverService = ReturnType<typeof createZagService>

type IktiaZagPopoverServiceOptions = {
  host: HTMLElement
  id: string
  modal: boolean
  onOpenChange(open: boolean): void
  open: boolean
  root: ParentNode
}

export function createIktiaZagPopoverService({
  host,
  id,
  modal,
  onOpenChange,
  open,
  root,
}: IktiaZagPopoverServiceOptions): IktiaZagPopoverService {
  return createZagService({
    machine: popoverMachine as never,
    props: {
      autoFocus: false,
      closeOnEscape: true,
      closeOnInteractOutside: true,
      defaultOpen: open,
      finalFocusEl: () =>
        host.shadowRoot?.querySelector<HTMLElement>("[part~='trigger']") ?? host,
      id,
      modal,
      onOpenChange(details: { open: boolean }) {
        onOpenChange(details.open)
      },
      portalled: false,
      positioning: { placement: "bottom-start", sameWidth: true },
      restoreFocus: true,
      translations: {
        closeTriggerLabel: "Close popover",
      },
    },
    scope: createZagScope({
      host,
      id,
      root: root as Document | ShadowRoot,
    }),
  })
}

export function getIktiaZagPopoverApi(
  service: IktiaZagPopoverService | null
): ZagPopoverApi | null {
  if (service == null) return null
  return connect(service as never, normalizeZagProps as never)
}

export function stopIktiaZagPopoverService(
  service: IktiaZagPopoverService | null
) {
  service?.stop()
}
