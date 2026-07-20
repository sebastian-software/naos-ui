import type { NativeEventDefinition, NativePropDefinition } from "./generated/naos-node-types.js"

/**
 * Canonical prop conversion kinds emitted by the compiler. The generated
 * NAPI surface types `NativePropDefinition.kind` as plain `string`; this
 * union is the authoritative value set.
 */
export type NaosPropKind = "boolean" | "number" | "rich" | "string"

export type NaosElementDeclarationInput = {
  className: string
  exportName?: string | null
  tagName: string
  props?: readonly NativePropDefinition[]
  events?: readonly NativeEventDefinition[]
}

const PROP_TYPE_BY_KIND: Partial<Record<NaosPropKind, string>> = {
  boolean: "boolean",
  number: "number",
  string: "string",
}

function propType(prop: NativePropDefinition): string {
  // Rich props keep their authored TypeScript type only in the source module;
  // the standalone declaration cannot reference module-local names, so they
  // surface as `unknown` and consumers narrow at the call site.
  return PROP_TYPE_BY_KIND[prop.kind as NaosPropKind] ?? "unknown"
}

function eventDetailType(event: NativeEventDefinition): string {
  return event.detailType?.trim() || "unknown"
}

/**
 * Renders a standalone `.d.ts`/`.d.mts` module declaration for one compiled
 * Naos component: the element class with typed properties, typed
 * `addEventListener`/`removeEventListener` overloads for the component's
 * `event()` declarations, the module exports matching the generated
 * JavaScript, and the global `HTMLElementTagNameMap` augmentation.
 */
export function renderNaosElementDeclaration(input: NaosElementDeclarationInput): string {
  const { className, tagName } = input
  const props = input.props ?? []
  const events = input.events ?? []
  const eventMapName = `${className}EventMap`
  const lines: string[] = []

  lines.push(`export declare class ${className} extends HTMLElement {`)
  for (const prop of props) {
    lines.push(`  ${prop.propName}: ${propType(prop)};`)
  }
  if (events.length > 0) {
    lines.push(
      `  addEventListener<Type extends keyof ${eventMapName}>(type: Type, listener: (this: ${className}, event: ${eventMapName}[Type]) => void, options?: boolean | AddEventListenerOptions): void;`,
      `  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;`,
      `  removeEventListener<Type extends keyof ${eventMapName}>(type: Type, listener: (this: ${className}, event: ${eventMapName}[Type]) => void, options?: boolean | EventListenerOptions): void;`,
      `  removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;`,
    )
  }
  lines.push(`}`)

  if (events.length > 0) {
    lines.push(``, `export interface ${eventMapName} extends HTMLElementEventMap {`)
    for (const event of events) {
      lines.push(`  ${JSON.stringify(event.eventName)}: CustomEvent<${eventDetailType(event)}>;`)
    }
    lines.push(`}`)
  }

  lines.push(``)
  if (input.exportName && input.exportName !== className) {
    lines.push(`export { ${className} as ${input.exportName} };`)
  }
  lines.push(`export default ${className};`, ``)

  lines.push(
    `declare global {`,
    `  interface HTMLElementTagNameMap {`,
    `    ${JSON.stringify(tagName)}: ${className};`,
    `  }`,
    `}`,
    ``,
  )

  return lines.join("\n")
}
