import {
  connect,
  machine as toggleMachine,
  type Api as ZagToggleApi,
} from "@zag-js/toggle"

import { normalizeZagProps } from "./props.js"
import { createZagScope } from "./scope.js"
import { createZagService } from "./service.js"

export type IktiaZagToggleService = ReturnType<typeof createZagService>

type IktiaZagToggleServiceOptions = {
  disabled: boolean
  host: HTMLElement
  id: string
  onPressedChange(pressed: boolean): void
  pressed: boolean
  root: ParentNode
}

export function createIktiaZagToggleService({
  disabled,
  host,
  id,
  onPressedChange,
  pressed,
  root,
}: IktiaZagToggleServiceOptions): IktiaZagToggleService {
  return createZagService({
    machine: toggleMachine as never,
    props: {
      defaultPressed: pressed,
      disabled,
      id,
      onPressedChange,
    },
    scope: createZagScope({
      host,
      id,
      root: root as Document | ShadowRoot,
    }),
  })
}

export function getIktiaZagToggleApi(
  service: IktiaZagToggleService | null
): ZagToggleApi | null {
  if (service == null) return null
  return connect(service as never, normalizeZagProps as never)
}

export function withoutIktiaZagToggleClick<T extends Record<string, unknown>>(
  props: T
): T {
  const nextProps = { ...props }
  delete nextProps.onClick
  return nextProps
}

export function stopIktiaZagToggleService(
  service: IktiaZagToggleService | null
) {
  service?.stop()
}
