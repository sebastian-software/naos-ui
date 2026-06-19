import {
  connect,
  machine as numberInputMachine,
  type Api as ZagNumberInputApi,
} from "@zag-js/number-input"

import { normalizeZagProps } from "./props.js"
import { createZagScope } from "./scope.js"
import { createZagService } from "./service.js"

export type IktiaZagNumberInputService = ReturnType<typeof createZagService>

type IktiaZagNumberInputServiceOptions = {
  disabled: boolean
  host: HTMLElement
  id: string
  label: string
  max: number
  min: number
  onValueChange(details: { value: string; valueAsNumber: number }): void
  root: ParentNode
  step: number
  value: string
}

export function createIktiaZagNumberInputService({
  disabled,
  host,
  id,
  label,
  max,
  min,
  onValueChange,
  root,
  step,
  value,
}: IktiaZagNumberInputServiceOptions): IktiaZagNumberInputService {
  return createZagService({
    machine: numberInputMachine as never,
    props: {
      allowOverflow: false,
      clampValueOnBlur: true,
      defaultValue: value,
      disabled,
      focusInputOnChange: true,
      id,
      inputMode: "decimal",
      max,
      min,
      onValueChange,
      spinOnPress: false,
      step,
      translations: {
        decrementLabel: `Decrease ${label}`,
        incrementLabel: `Increase ${label}`,
      },
    },
    scope: createZagScope({
      host,
      id,
      root: root as Document | ShadowRoot,
    }),
  })
}

export function getIktiaZagNumberInputApi(
  service: IktiaZagNumberInputService | null
): ZagNumberInputApi | null {
  if (service == null) return null
  return connect(service as never, normalizeZagProps as never)
}

export function stopIktiaZagNumberInputService(
  service: IktiaZagNumberInputService | null
) {
  service?.stop()
}
