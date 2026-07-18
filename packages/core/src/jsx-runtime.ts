type PrimitiveChild = string | number | boolean | null | undefined

export type JsxChild = JsxElement | PrimitiveChild | readonly JsxChild[]

export type JsxElement = {
  readonly kind: "naos.jsx"
}

export type AttributeValue = string | number | boolean | null | undefined

export type EventHandler<EventType extends Event = Event> = {
  bivarianceHack(event: EventType & { currentTarget: EventTarget }): void
}["bivarianceHack"]

export type ElementRef<ElementType extends Element = HTMLElement> =
  | ElementType
  | null
  | undefined
  | ((element: ElementType) => void)

/**
 * Structural shape of a Naos form action (`@naos-ui/actions`). Declared
 * structurally so `@naos-ui/core` stays dependency-free.
 */
export type FormActionLike = {
  enhance(form: HTMLFormElement): () => void
}

export type IntrinsicElementAttributes = {
  [attribute: `aria-${string}`]: AttributeValue
  [attribute: `data-${string}`]: AttributeValue
  [attribute: `on${string}`]: EventHandler | undefined
  action?: string | FormActionLike
  children?: JsxChild
  class?: string
  disabled?: boolean
  hidden?: boolean
  id?: string
  key?: string | number
  name?: string
  onBlur?: EventHandler<FocusEvent>
  onAnimationCancel?: EventHandler<AnimationEvent>
  onAnimationEnd?: EventHandler<AnimationEvent>
  onAnimationIteration?: EventHandler<AnimationEvent>
  onAnimationStart?: EventHandler<AnimationEvent>
  onAuxClick?: EventHandler<PointerEvent>
  onBeforeInput?: EventHandler<InputEvent>
  onClick?: EventHandler<PointerEvent>
  onCompositionEnd?: EventHandler<CompositionEvent>
  onCompositionStart?: EventHandler<CompositionEvent>
  onCompositionUpdate?: EventHandler<CompositionEvent>
  onContextMenu?: EventHandler<PointerEvent>
  onDblClick?: EventHandler<MouseEvent>
  onDragEnd?: EventHandler<DragEvent>
  onDragEnter?: EventHandler<DragEvent>
  onDragLeave?: EventHandler<DragEvent>
  onDragOver?: EventHandler<DragEvent>
  onDragStart?: EventHandler<DragEvent>
  onFocus?: EventHandler<FocusEvent>
  onFocusIn?: EventHandler<FocusEvent>
  onFocusOut?: EventHandler<FocusEvent>
  onGotPointerCapture?: EventHandler<PointerEvent>
  onInput?: EventHandler<InputEvent>
  onKeyDown?: EventHandler<KeyboardEvent>
  onKeyUp?: EventHandler<KeyboardEvent>
  onMouseDown?: EventHandler<MouseEvent>
  onMouseEnter?: EventHandler<MouseEvent>
  onMouseLeave?: EventHandler<MouseEvent>
  onMouseMove?: EventHandler<MouseEvent>
  onMouseOut?: EventHandler<MouseEvent>
  onMouseOver?: EventHandler<MouseEvent>
  onMouseUp?: EventHandler<MouseEvent>
  onLostPointerCapture?: EventHandler<PointerEvent>
  onPointerCancel?: EventHandler<PointerEvent>
  onPointerDown?: EventHandler<PointerEvent>
  onPointerEnter?: EventHandler<PointerEvent>
  onPointerLeave?: EventHandler<PointerEvent>
  onPointerMove?: EventHandler<PointerEvent>
  onPointerOut?: EventHandler<PointerEvent>
  onPointerOver?: EventHandler<PointerEvent>
  onPointerUp?: EventHandler<PointerEvent>
  onTouchCancel?: EventHandler<TouchEvent>
  onTouchEnd?: EventHandler<TouchEvent>
  onTouchMove?: EventHandler<TouchEvent>
  onTouchStart?: EventHandler<TouchEvent>
  onTransitionCancel?: EventHandler<TransitionEvent>
  onTransitionEnd?: EventHandler<TransitionEvent>
  onTransitionRun?: EventHandler<TransitionEvent>
  onTransitionStart?: EventHandler<TransitionEvent>
  part?: string
  required?: boolean
  ref?: ElementRef
  role?: string
  slot?: string
  tabindex?: number
  type?: string
  value?: string | number | readonly string[]
}

export namespace JSX {
  export type Element = JsxElement
  export type ElementChildrenAttribute = {
    children: Record<string, never>
  }
  export type IntrinsicElements = {
    [elementName: string]: IntrinsicElementAttributes
    slot: IntrinsicElementAttributes & {
      name?: string
    }
  }
}

export function jsx(): never {
  return jsxRuntimeError()
}

export function jsxs(): never {
  return jsxRuntimeError()
}

export function jsxDEV(): never {
  return jsxRuntimeError()
}

export function Fragment(): never {
  return jsxRuntimeError()
}

function jsxRuntimeError(): never {
  throw new Error("Naos JSX can only be used in source files transformed by the Naos compiler.")
}
