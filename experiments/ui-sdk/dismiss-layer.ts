import { bindLayer } from "@ui-sdk/core"

// A composed pointer event may originate in a slotted child's shadow root.
function belongsTo(host: HTMLElement, target: Node) {
  let node: Node | null = target
  while (node) {
    if (host.contains(node)) return true
    const root: Node = node.getRootNode()
    node = root instanceof ShadowRoot ? root.host : null
  }
  return false
}

export function bindDismissLayer(host: HTMLElement, modal: boolean, close: () => void) {
  return bindLayer(host, {
    modal,
    contains: (target) => belongsTo(host, target),
    onDismiss: close,
  })
}
