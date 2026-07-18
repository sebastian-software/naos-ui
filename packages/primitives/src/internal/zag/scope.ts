type ZagScopeOptions = {
  host: HTMLElement
  id?: string
  root?: Document | ShadowRoot
}

function activeElementFor(root: Document | ShadowRoot) {
  const isElement = (value: unknown): value is HTMLElement =>
    typeof HTMLElement !== "undefined" && value instanceof HTMLElement

  if (typeof ShadowRoot !== "undefined" && root instanceof ShadowRoot) {
    return isElement(root.activeElement) ? root.activeElement : null
  }
  return isElement(root.activeElement) ? root.activeElement : null
}

export function createZagScope({ host, id = host.id, root }: ZagScopeOptions) {
  const getRootNode = () => root ?? host.getRootNode()
  const getDoc = () => host.ownerDocument
  const getWin = () => getDoc().defaultView ?? globalThis.window

  return {
    id,
    getActiveElement: () => activeElementFor(getRootNode() as Document | ShadowRoot),
    getById: (elementId: string) => {
      const currentRoot = getRootNode()
      const isDocument = typeof Document !== "undefined" && currentRoot instanceof Document
      const isShadowRoot = typeof ShadowRoot !== "undefined" && currentRoot instanceof ShadowRoot
      return isDocument || isShadowRoot ? currentRoot.getElementById(elementId) : null
    },
    getDoc,
    getRootNode,
    getWin,
    isActiveElement: (element: HTMLElement | null) =>
      activeElementFor(getRootNode() as Document | ShadowRoot) === element,
  }
}
