import type { JSX } from "./jsx-runtime.js"

export type ComponentOptions = {
  shadow?: boolean
  styles?: readonly string[]
  define?: boolean
}

export type ComponentRender = () => JSX.Element

export type ComponentDefinition<TagName extends string = string> = {
  readonly kind: "lean-wc.component"
  readonly tagName: TagName
}

export type PropOptions = {
  attribute?: string | false
}

export type Accessor<T> = {
  (): T
}

export type WritableAccessor<T> = Accessor<T> & {
  set(value: T): void
  update(updater: (value: T) => T): void
}

export type PropAccessor<T> = WritableAccessor<T> & {
  readonly propName: string
}

export type StateAccessor<T> = WritableAccessor<T>

export type EventOptions = {
  bubbles?: boolean
  cancelable?: boolean
  composed?: boolean
}

export type EventEmitter<Detail> = {
  readonly eventName: string
  emit: Detail extends void ? (detail?: void) => void : (detail: Detail) => void
}

export type PropFactory = {
  <T>(name: string, defaultValue: T, options?: PropOptions): PropAccessor<T>
  string(name: string, defaultValue?: string, options?: PropOptions): PropAccessor<string>
  boolean(name: string, defaultValue?: boolean, options?: PropOptions): PropAccessor<boolean>
  number(name: string, defaultValue?: number, options?: PropOptions): PropAccessor<number>
}

export function component<TagName extends string>(
  tagName: TagName,
  render: ComponentRender
): ComponentDefinition<TagName>
export function component<TagName extends string>(
  tagName: TagName,
  options: ComponentOptions,
  render: ComponentRender
): ComponentDefinition<TagName>
export function component(
  tagName: string,
  optionsOrRender?: ComponentOptions | ComponentRender,
  render?: ComponentRender
): never {
  return authoringRuntimeError("component")
}

export const prop: PropFactory = Object.assign(
  function genericProp<T>(
    name: string,
    defaultValue: T,
    options?: PropOptions
  ): PropAccessor<T> {
    return authoringRuntimeError("prop")
  },
  {
    string(
      name: string,
      defaultValue = "",
      options?: PropOptions
    ): PropAccessor<string> {
      return authoringRuntimeError("prop")
    },
    boolean(
      name: string,
      defaultValue = false,
      options?: PropOptions
    ): PropAccessor<boolean> {
      return authoringRuntimeError("prop")
    },
    number(
      name: string,
      defaultValue = 0,
      options?: PropOptions
    ): PropAccessor<number> {
      return authoringRuntimeError("prop")
    },
  }
)

export function state<T>(initialValue: T): StateAccessor<T> {
  return authoringRuntimeError("state")
}

export function event<Detail = void>(
  name: string,
  options?: EventOptions
): EventEmitter<Detail> {
  return authoringRuntimeError("event")
}

export function onConnected(callback: () => void): void {
  authoringRuntimeError("onConnected")
}

export function onDisconnected(callback: () => void): void {
  authoringRuntimeError("onDisconnected")
}

function authoringRuntimeError(apiName: string): never {
  throw new Error(
    `lean-wc ${apiName}() can only be used in source files transformed by the lean-wc compiler.`
  )
}

export { createLeanEvent } from "./runtime.js"
export type { EventInitOptions } from "./runtime.js"
export type { JSX } from "./jsx-runtime.js"
