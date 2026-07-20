// Static component (board.wc.tsx) under variant A — drags the whole base class.
import { NaosElement, defineComponent, lazySheet } from "./runtime-class.js"

const css = ""

class BoardElement extends NaosElement {
  static _naosSpec = {
    defaults: {},
    props: {},
    attrs: {},
    styles: lazySheet([css]),
  }

  _naosMount() {
    const node0 = document.createElement("div")
    node0.setAttribute("part", "root")
    const node1 = document.createElement("naos-task-list")
    node0.append(node1)
    const node2 = document.createElement("naos-activity-feed")
    node0.append(node2)
    this._naosRoot.append(node0)
  }
}
defineComponent("naos-board", BoardElement, {
  packageName: "@naos-ui/example",
  packageVersion: "1.0.0",
  tagName: "naos-board",
})
export { BoardElement as Board }
export default BoardElement
