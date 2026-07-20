import { flipMovedElements } from "@naos-ui/motion"

export function captureRects(root: ParentNode, selector: string): Map<Element, DOMRectReadOnly> {
  const rects = new Map<Element, DOMRectReadOnly>()
  for (const element of root.querySelectorAll(selector)) {
    rects.set(element, element.getBoundingClientRect())
  }
  return rects
}

export function flipAfterUpdate(rects: ReadonlyMap<Element, DOMRectReadOnly>): void {
  requestAnimationFrame(() => flipMovedElements(rects))
}
