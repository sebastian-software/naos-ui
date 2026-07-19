import type { JSX, JsxChild } from "./jsx-runtime.js"

export type ComponentOptions = {
  styles?: readonly string[]
}

export type Accessor<T> = {
  (): T
}

export type WritableAccessor<T> = Accessor<T> & {
  set(value: T): void
  update(updater: (value: T) => T): void
}

export type StateAccessor<T> = WritableAccessor<T>

export type ComputedAccessor<T> = Accessor<T>

export type EffectCleanup = () => void

export type EffectCallback = () => void | EffectCleanup

export type ShowProps = {
  when: boolean
  fallback?: JsxChild
  children?: JsxChild
}

export type SwitchProps = {
  children?: JsxChild
}

export type MatchProps = {
  when?: boolean
  children?: JsxChild
}

export type ForProps<T> = {
  each: readonly T[] | null | undefined
  motion?: "flip"
  children: (item: T, index: number) => JSX.Element
}

export type IndexProps<T> = {
  each: readonly T[] | null | undefined
  children: (item: Accessor<T>, index: number) => JSX.Element
}

export type HostHandle<Props extends object = Record<string, unknown>> = {
  readonly id: string
  readonly element: HTMLElement
  readonly root: ParentNode
  readonly props: Readonly<Props>
  readonly signal: AbortSignal
  update(): Promise<AbortSignal>
  queueTask(task: () => void): void
  flushSync(): void
}

export type EventOptions = {
  bubbles?: boolean
  cancelable?: boolean
  composed?: boolean
}

export type ListenerOptions = AddEventListenerOptions

export type EventEmitter<Detail> = {
  readonly eventName: string
  emit: [Detail] extends [void] ? (detail?: void) => void : (detail: Detail) => void
}

export type FormControlOptions = {
  value(): FormDataEntryValue | FormData | null
  reset?(): void
  disabled?: boolean
}

export type FormControlHandle = {
  readonly formAssociated: true
}

export type NaosClassValue =
  | string
  | number
  | null
  | undefined
  | boolean
  | readonly NaosClassValue[]
  | Readonly<Record<string, unknown>>

export function clx(...inputs: NaosClassValue[]): string {
  const classes: string[] = []
  for (const input of inputs) {
    if (!input) continue
    if (typeof input === "string" || typeof input === "number") {
      classes.push(String(input))
      continue
    }
    if (Array.isArray(input)) {
      const nested = clx(...input)
      if (nested) classes.push(nested)
      continue
    }
    if (typeof input === "object") {
      for (const [name, active] of Object.entries(input)) {
        if (active) classes.push(name)
      }
    }
  }
  return classes.join(" ")
}

export function state<T>(_initialValue: T): StateAccessor<T> {
  return authoringRuntimeError("state")
}

export function computed<T>(_derive: () => T): ComputedAccessor<T> {
  return authoringRuntimeError("computed")
}

export function effect(_callback: EffectCallback): void {
  authoringRuntimeError("effect")
}

export function Show(_props: ShowProps): JSX.Element {
  return authoringRuntimeError("Show")
}

export function Switch(_props: SwitchProps): JSX.Element {
  return authoringRuntimeError("Switch")
}

export function Match(_props: MatchProps): JSX.Element {
  return authoringRuntimeError("Match")
}

export function For<T>(_props: ForProps<T>): JSX.Element {
  return authoringRuntimeError("For")
}

export function Index<T>(_props: IndexProps<T>): JSX.Element {
  return authoringRuntimeError("Index")
}

export function on<EventType extends Event = Event>(
  handler: (event: EventType, signal: AbortSignal) => void | Promise<void>,
  options?: ListenerOptions,
): (event: EventType & { currentTarget: EventTarget }) => void
export function on(): never {
  return authoringRuntimeError("on")
}

export function host<Props extends object = Record<string, unknown>>(): HostHandle<Props> {
  return authoringRuntimeError("host")
}

export function event<Detail = void>(_name: string, _options?: EventOptions): EventEmitter<Detail> {
  return authoringRuntimeError("event")
}

export function formControl(_options: FormControlOptions): FormControlHandle {
  return authoringRuntimeError("formControl")
}

export function onConnected(_callback: () => void): void {
  authoringRuntimeError("onConnected")
}

export function onDisconnected(_callback: () => void): void {
  authoringRuntimeError("onDisconnected")
}

function authoringRuntimeError(apiName: string): never {
  throw new Error(
    `Naos ${apiName}() can only be used in source files transformed by the Naos compiler.`,
  )
}

export type { ElementRef, JSX, NaosStyleValue } from "./jsx-runtime.js"
