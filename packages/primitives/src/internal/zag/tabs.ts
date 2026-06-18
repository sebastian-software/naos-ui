import {
  connect,
  machine as tabsMachine,
  type Api as ZagTabsApi,
} from "@zag-js/tabs"

import { createZagScope } from "./scope.js"
import { createZagService } from "./service.js"
import { normalizeZagProps } from "./props.js"

export type IktiaZagTabsService = ReturnType<typeof createZagService>

type IktiaZagTabsServiceOptions = {
  host: HTMLElement
  id: string
  onValueChange(value: string | null): void
  orientation: "horizontal" | "vertical"
  root: ParentNode
  value: string
}

export function createIktiaZagTabsService({
  host,
  id,
  onValueChange,
  orientation,
  root,
  value,
}: IktiaZagTabsServiceOptions): IktiaZagTabsService {
  return createZagService({
    machine: tabsMachine as never,
    props: {
      activationMode: "automatic",
      composite: true,
      defaultValue: value,
      id,
      loopFocus: true,
      onValueChange(details: { value: string | null }) {
        onValueChange(details.value)
      },
      orientation,
    },
    scope: createZagScope({
      host,
      id,
      root: root as Document | ShadowRoot,
    }),
  })
}

export function getIktiaZagTabsApi(
  service: IktiaZagTabsService | null
): ZagTabsApi | null {
  if (service == null) return null
  return connect(service as never, normalizeZagProps as never)
}

export function stopIktiaZagTabsService(
  service: IktiaZagTabsService | null
) {
  service?.stop()
}
