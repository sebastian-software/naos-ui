export function nextDisclosureOpen(open: boolean): boolean {
  return !open
}

export function shouldCloseDisclosureForKey(key: string): boolean {
  return key === "Escape"
}

export function shouldIgnoreOutsidePointer(
  root: Node,
  eventTarget: EventTarget | null
): boolean {
  return eventTarget instanceof Node && root.contains(eventTarget)
}
