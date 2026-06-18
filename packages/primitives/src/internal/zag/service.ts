type Dict = Record<string, any>

type ZagBindableParams<Value> = {
  defaultValue?: Value
  sync?: boolean
  value?: Value
  onChange?: (value: Value, previous: Value | undefined) => void
}

type ZagActionList = string | string[] | ((params: Dict) => string[] | undefined)
type ZagEffectList = string | string[] | ((params: Dict) => string[] | undefined)

type ZagMachineTransition = {
  actions?: string | string[]
  guard?: string | ((params: Dict) => boolean)
  target?: string
}

type ZagMachineState = {
  entry?: ZagActionList
  exit?: ZagActionList
  effects?: ZagEffectList
  tags?: string[]
  on?: Record<string, ZagMachineTransition | ZagMachineTransition[]>
}

type ZagMachine = {
  context?: (params: Dict) => Dict
  computed?: Record<string, (params: Dict) => unknown>
  entry?: ZagActionList
  exit?: ZagActionList
  effects?: ZagEffectList
  implementations?: {
    actions?: Record<string, (params: Dict) => void>
    effects?: Record<string, (params: Dict) => void | VoidFunction>
    guards?: Record<string, (params: Dict) => boolean>
  }
  initialState: (params: Dict) => string
  on?: Record<string, ZagMachineTransition | ZagMachineTransition[]>
  props?: (params: Dict) => Dict
  refs?: (params: Dict) => Dict
  states: Record<string, ZagMachineState>
  watch?: (params: Dict) => void
}

type ZagServiceOptions = {
  machine: ZagMachine
  props?: Dict
  scope?: Partial<Dict>
}

type ZagEvent = Dict & {
  type: string
}

const toArray = <Value>(value: Value | Value[] | undefined): Value[] => {
  if (value == null) return []
  return Array.isArray(value) ? value : [value]
}

function resolveList(value: ZagActionList | ZagEffectList | undefined, params: () => Dict) {
  if (typeof value === "function") return toArray(value(params()))
  return toArray(value)
}

function createBindable<Value>({
  defaultValue,
  onChange,
  value,
}: ZagBindableParams<Value>) {
  let current = value ?? defaultValue
  return {
    initial: current,
    ref: undefined,
    get: () => current,
    set(next: Value | ((previous: Value | undefined) => Value)) {
      const previous = current
      current = typeof next === "function" ? (next as (previous: Value | undefined) => Value)(current) : next
      if (!Object.is(current, previous)) {
        onChange?.(current as Value, previous)
      }
    },
    invoke(next: Value, previous: Value | undefined) {
      onChange?.(next, previous)
    },
    hash(next: Value) {
      return JSON.stringify(next)
    },
  }
}

function matchesState(current: string, value: string) {
  return current === value || current.startsWith(`${value}.`)
}

export function createZagService({
  machine,
  props: inputProps = {},
  scope: inputScope = {},
}: ZagServiceOptions) {
  const props = machine.props?.({ props: inputProps, scope: inputScope }) ?? inputProps
  const prop = (key: string) => props[key]
  const cleanupCallbacks: VoidFunction[] = []
  const rootEffectCleanups = new Map<string, VoidFunction>()
  const stateEffectCleanups = new Map<string, VoidFunction>()
  const trackers: {
    callback: VoidFunction
    reads: (() => unknown)[]
    values: unknown[]
  }[] = []
  let currentEvent: ZagEvent = { type: "" }
  let previousEvent: ZagEvent = { type: "" }
  let started = true

  const bindable = Object.assign(
    <Value>(factory: () => ZagBindableParams<Value>) => createBindable(factory()),
    {
      cleanup: (callback: VoidFunction) => {
        cleanupCallbacks.push(callback)
      },
      ref: <Value>(defaultValue: Value) => {
        let current = defaultValue
        return {
          get: () => current,
          set: (next: Value) => {
            current = next
          },
        }
      },
    }
  )

  const contextEntries = machine.context?.({
    bindable,
    flush: (callback: VoidFunction) => callback(),
    getComputed: () => computed,
    getContext: () => context,
    getEvent: () => currentEvent,
    getRefs: () => refs,
    prop,
    scope: inputScope,
  }) ?? {}
  const context = {
    get: (key: string) => contextEntries[key]?.get(),
    hash: (key: string) => contextEntries[key]?.hash(contextEntries[key]?.get()),
    initial: (key: string) => contextEntries[key]?.initial,
    set: (key: string, next: unknown) => {
      contextEntries[key]?.set(next)
    },
  }
  const computed = (key: string) => machine.computed?.[key]?.(params())
  const refsEntries = machine.refs?.({ context, prop }) ?? {}
  const refs = {
    get: (key: string) => refsEntries[key],
    set: (key: string, next: unknown) => {
      refsEntries[key] = next
    },
  }
  let currentState = machine.initialState({ prop })
  const state = {
    get: () => currentState,
    hasTag: (tag: string) => machine.states[currentState]?.tags?.includes(tag) ?? false,
    hash: () => currentState,
    initial: currentState,
    invoke: () => undefined,
    matches: (...values: string[]) => values.some((value) => matchesState(currentState, value)),
    ref: undefined,
    set: (next: string) => {
      currentState = next
    },
  }
  const scope = {
    getActiveElement: () => null,
    getById: () => null,
    getDoc: () => globalThis.document,
    getRootNode: () => globalThis.document,
    getWin: () => globalThis.window,
    id: props.id,
    isActiveElement: () => false,
    ...inputScope,
  }

  function params(): Dict {
    return {
      action: runActions,
      choose: chooseTransition,
      computed,
      context,
      event: Object.assign({}, currentEvent, {
        current: () => currentEvent,
        previous: () => previousEvent,
      }),
      flush: (callback: VoidFunction) => callback(),
      guard,
      prop,
      refs,
      scope,
      send,
      state,
      track: (reads: (() => unknown)[], callback: VoidFunction) => {
        trackers.push({
          callback,
          reads,
          values: reads.map((read) => read()),
        })
      },
    }
  }

  function guard(guardDefinition: string | ((params: Dict) => boolean)) {
    if (typeof guardDefinition === "function") return guardDefinition(params())
    return machine.implementations?.guards?.[guardDefinition]?.(params()) ?? false
  }

  function chooseTransition(
    transitions: ZagMachineTransition | ZagMachineTransition[] | null | undefined
  ) {
    return toArray(transitions).find((transition) => {
      if (transition == null) return false
      if (!transition.guard) return true
      return guard(transition.guard)
    })
  }

  function runActions(actions: string | string[] | undefined) {
    for (const actionName of toArray(actions)) {
      machine.implementations?.actions?.[actionName]?.(params())
    }
  }

  function runActionList(actions: ZagActionList | undefined) {
    runActions(resolveList(actions, params))
  }

  function startRootEffects() {
    for (const effectName of resolveList(machine.effects, params)) {
      if (rootEffectCleanups.has(effectName)) continue
      const cleanup = machine.implementations?.effects?.[effectName]?.(params())
      if (typeof cleanup === "function") rootEffectCleanups.set(effectName, cleanup)
    }
  }

  function startStateEffects(stateName: string) {
    for (const effectName of resolveList(machine.states[stateName]?.effects, params)) {
      if (stateEffectCleanups.has(effectName)) continue
      const cleanup = machine.implementations?.effects?.[effectName]?.(params())
      if (typeof cleanup === "function") stateEffectCleanups.set(effectName, cleanup)
    }
  }

  function stopRootEffects() {
    for (const cleanup of rootEffectCleanups.values()) cleanup()
    rootEffectCleanups.clear()
  }

  function stopStateEffects() {
    for (const cleanup of stateEffectCleanups.values()) cleanup()
    stateEffectCleanups.clear()
  }

  function syncTrackers() {
    for (const tracker of trackers) {
      const nextValues = tracker.reads.map((read) => read())
      const changed = nextValues.some((value, index) => !Object.is(value, tracker.values[index]))
      if (!changed) continue
      tracker.values = nextValues
      tracker.callback()
    }
  }

  function findTransition(eventType: string) {
    const stateTransition = machine.states[currentState]?.on?.[eventType]
    return chooseTransition(stateTransition ?? machine.on?.[eventType])
  }

  function send(event: ZagEvent) {
    if (!started) return
    previousEvent = currentEvent
    currentEvent = event
    const selectedTransition = findTransition(event.type)
    if (!selectedTransition) return
    if (selectedTransition.target && selectedTransition.target !== currentState) {
      runActionList(machine.states[currentState]?.exit)
      stopStateEffects()
      currentState = selectedTransition.target
      runActionList(machine.states[currentState]?.entry)
      startStateEffects(currentState)
    }
    runActions(selectedTransition.actions)
    syncTrackers()
  }

  runActionList(machine.entry)
  runActionList(machine.states[currentState]?.entry)
  startRootEffects()
  startStateEffects(currentState)
  machine.watch?.(params())

  return {
    computed,
    context,
    event: Object.assign(currentEvent, {
      current: () => currentEvent,
      previous: () => previousEvent,
    }),
    getStatus: () => (started ? "Started" : "Stopped"),
    prop,
    refs,
    scope,
    send,
    state,
    stop: () => {
      if (!started) return
      started = false
      runActionList(machine.states[currentState]?.exit)
      runActionList(machine.exit)
      stopStateEffects()
      stopRootEffects()
      for (const cleanup of cleanupCallbacks) cleanup()
    },
  }
}
