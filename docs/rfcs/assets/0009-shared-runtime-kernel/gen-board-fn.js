// Static component (board.wc.tsx) under variant B — imports only what it needs.
import {
  K,
  attrChanged,
  connect,
  createKernel,
  defineComponent,
  disconnect,
  lazySheet,
} from "./runtime-fn.js"

const css = ""

const SPEC = {
  defaults: {},
  props: {},
  attrs: {},
  styles: lazySheet([css]),
  mount(k) {
    const node0 = document.createElement("div")
    node0.setAttribute("part", "root")
    const node1 = document.createElement("naos-task-list")
    node0.append(node1)
    const node2 = document.createElement("naos-activity-feed")
    node0.append(node2)
    k.root.append(node0)
  },
  update(_k, _dirty) {},
}

class BoardElement extends HTMLElement {
  constructor() {
    super()
    this[K] = createKernel(this, SPEC)
  }
  connectedCallback() {
    connect(this[K])
  }
  disconnectedCallback() {
    disconnect(this[K])
  }
  attributeChangedCallback(name, oldValue, newValue) {
    attrChanged(this[K], name, oldValue, newValue)
  }
}
defineComponent("naos-board", BoardElement, {
  packageName: "@naos-ui/example",
  packageVersion: "1.0.0",
  tagName: "naos-board",
})
export { BoardElement as Board }
export default BoardElement
