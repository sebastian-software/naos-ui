import {
  connect,
  machine as tooltipMachine,
  type Api as ZagTooltipApi,
} from "@zag-js/tooltip"

import { normalizeZagProps } from "./props.js"
import { createZagScope } from "./scope.js"
import { createZagService } from "./service.js"

export type IktiaZagTooltipService = ReturnType<typeof createZagService>

type IktiaZagTooltipServiceOptions = {
  closeDelay: number
  disabled: boolean
  host: HTMLElement
  id: string
  onOpenChange(open: boolean): void
  open: boolean
  openDelay: number
  root: ParentNode
}

export function createIktiaZagTooltipService({
  closeDelay,
  disabled,
  host,
  id,
  onOpenChange,
  open,
  openDelay,
  root,
}: IktiaZagTooltipServiceOptions): IktiaZagTooltipService {
  return createZagService({
    machine: tooltipMachine as never,
    props: {
      closeDelay,
      closeOnClick: true,
      closeOnEscape: true,
      closeOnPointerDown: true,
      closeOnScroll: true,
      defaultOpen: open,
      disabled,
      id,
      onOpenChange(details: { open: boolean }) {
        onOpenChange(details.open)
      },
      openDelay,
      positioning: { placement: "top", gutter: 8 },
    },
    scope: createZagScope({
      host,
      id,
      root: root as Document | ShadowRoot,
    }),
  })
}

export function getIktiaZagTooltipApi(
  service: IktiaZagTooltipService | null
): ZagTooltipApi | null {
  if (service == null) return null
  return connect(service as never, normalizeZagProps as never)
}

export function stopIktiaZagTooltipService(
  service: IktiaZagTooltipService | null
) {
  service?.stop()
}
