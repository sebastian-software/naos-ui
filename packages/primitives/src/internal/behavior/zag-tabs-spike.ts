import { connect, type Api as ZagTabsApi } from "@zag-js/tabs"

import { tabsValueForKey, type TabsOrientation } from "./tabs.js"

type ZagTabsProbeOptions = {
  id?: string
  orientation?: TabsOrientation
  value: string
  values: readonly string[]
}

type ZagTabsEvent = {
  type: string
  value?: string
}

type MutableContext = {
  animateIndicator: boolean
  focusedValue: string | null
  indicatorRect: { x: number; y: number; width: number; height: number } | null
  ssr: boolean
  value: string | null
}

const normalizeProps = {
  button: <T extends Record<string, unknown>>(props: T) => props,
  element: <T extends Record<string, unknown>>(props: T) => props,
}

export type ZagTabsProbe = {
  api(): ZagTabsApi
  sentEvents(): readonly string[]
  value(): string | null
}

export function createZagTabsProbe({
  id = "iktia-zag-tabs-spike",
  orientation = "horizontal",
  value,
  values,
}: ZagTabsProbeOptions): ZagTabsProbe {
  const context: MutableContext = {
    animateIndicator: false,
    focusedValue: null,
    indicatorRect: null,
    ssr: false,
    value,
  }
  const sentEvents: string[] = []
  const props = {
    activationMode: "automatic",
    composite: true,
    dir: "ltr",
    loopFocus: true,
    orientation,
    translations: undefined,
  }

  const currentValue = () => context.focusedValue ?? context.value ?? values[0] ?? null
  const setValue = (next: string | null) => {
    context.focusedValue = next
    context.value = next
  }
  const move = (key: string) => {
    const current = currentValue()
    if (current == null) return
    setValue(tabsValueForKey(current, key, values, orientation))
  }
  const send = (event: ZagTabsEvent) => {
    sentEvents.push(event.type)
    switch (event.type) {
      case "ARROW_NEXT":
        move(orientation === "vertical" ? "ArrowDown" : "ArrowRight")
        break
      case "ARROW_PREV":
        move(orientation === "vertical" ? "ArrowUp" : "ArrowLeft")
        break
      case "CLEAR_VALUE":
        setValue(null)
        break
      case "END":
        setValue(values[values.length - 1] ?? null)
        break
      case "HOME":
        setValue(values[0] ?? null)
        break
      case "SET_VALUE":
      case "TAB_CLICK":
        setValue(event.value ?? null)
        break
      case "TAB_BLUR":
        context.focusedValue = null
        break
      case "TAB_FOCUS":
        context.focusedValue = event.value ?? null
        break
      default:
        break
    }
  }

  const service = {
    computed: () => false,
    context: {
      get: <Key extends keyof MutableContext>(key: Key) => context[key],
      hash: <Key extends keyof MutableContext>(key: Key) => JSON.stringify(context[key]),
      initial: <Key extends keyof MutableContext>(key: Key) => context[key],
      set: <Key extends keyof MutableContext>(
        key: Key,
        next: MutableContext[Key] | ((value: MutableContext[Key]) => MutableContext[Key])
      ) => {
        context[key] =
          typeof next === "function"
            ? (next as (value: MutableContext[Key]) => MutableContext[Key])(context[key])
            : next
      },
    },
    event: {
      current: () => ({ type: "" }),
      previous: () => ({ type: "" }),
      type: "",
    },
    getStatus: () => "Started",
    prop: (key: keyof typeof props) => props[key],
    refs: {
      get: () => undefined,
      set: () => undefined,
    },
    scope: {
      getActiveElement: () => null,
      getById: () => null,
      getDoc: () => globalThis.document,
      getRootNode: () => globalThis.document,
      getWin: () => globalThis.window,
      id,
      isActiveElement: () => false,
    },
    send,
    state: {
      get: () => "idle",
      hasTag: () => false,
      hash: () => "idle",
      initial: "idle",
      invoke: () => undefined,
      matches: (state: string) => state === "idle",
      ref: undefined,
      set: () => undefined,
    },
  }

  return {
    api: () => connect(service as never, normalizeProps as never),
    sentEvents: () => sentEvents,
    value: () => context.value,
  }
}
