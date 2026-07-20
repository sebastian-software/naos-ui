// What the compiler would emit for toggle.wc.tsx under variant B (functional kernel).
import {
  K,
  attrChanged,
  computedAccessor,
  connect,
  createKernel,
  defineComponent,
  defineProps,
  disconnect,
  emitter,
  hostApi,
  lazySheet,
  listen,
  reconcileKeyed,
  runEffect,
  setAttr,
  shouldUpdate,
  stateAccessor,
} from "./runtime-fn.js"

const css = ""

const SPEC = {
  defaults: { disabled: false, label: "Toggle" },
  props: {
    disabled: {
      coerce: (value) => Boolean(value),
      reflect: (el, value) => {
        if (value) el.setAttribute("disabled", "")
        else el.removeAttribute("disabled")
      },
    },
    label: {
      coerce: (value) => (value == null ? "" : String(value)),
      reflect: (el, value) => {
        if (el.getAttribute("label") !== String(value)) el.setAttribute("label", String(value))
      },
    },
  },
  attrs: {
    disabled: { prop: "disabled", parse: (value) => value !== null },
    label: { prop: "label", parse: (value) => value ?? "Toggle" },
  },
  styles: lazySheet([css]),
  initState(k) {
    k.state.pressed = false
  },
  mount(k) {
    const n = (k.nodes = {})
    n.listRecords = new Map()
    const node0 = document.createElement("button")
    n.node0 = node0
    node0.setAttribute("part", "root control")
    const node1 = document.createElement("span")
    n.node1 = node1
    node1.setAttribute("part", "label")
    const text0 = document.createTextNode("")
    n.text0 = text0
    node1.append(text0)
    node0.append(node1)
    const node2 = document.createElement("span")
    node2.style.display = "contents"
    node2.setAttribute("data-naos-control", "show")
    n.node2 = node2
    const node2Content = document.createElement("span")
    node2Content.style.display = "contents"
    n.node2Content = node2Content
    const node2Fallback = document.createElement("span")
    node2Fallback.style.display = "contents"
    n.node2Fallback = node2Fallback
    node2.append(node2Content, node2Fallback)
    const node3 = document.createElement("span")
    n.node3 = node3
    node3.setAttribute("part", "indicator")
    const text1 = document.createTextNode("")
    n.text1 = text1
    node3.append(text1)
    node2Content.append(node3)
    const node4 = document.createElement("span")
    n.node4 = node4
    node4.setAttribute("part", "indicator")
    const text2 = document.createTextNode("")
    n.text2 = text2
    node4.append(text2)
    node2Fallback.append(node4)
    node0.append(node2)
    const node5 = document.createElement("span")
    node5.style.display = "contents"
    node5.setAttribute("data-naos-control", "for")
    n.node5 = node5
    node0.append(node5)
    const node6 = document.createElement("slot")
    n.node6 = node6
    node0.append(node6)
    k.root.append(node0)
    listen(k, node0, "click", (_event, _signal) => {
      const { disabled, pressed, changed } = bindings(k)
      if (disabled) return
      pressed.update((value) => !value)
      changed.emit(pressed())
    })
  },
  update(k, dirty) {
    const n = k.nodes
    const { disabled, label, pressed, stateLabel, indicators } = bindings(k)
    if (shouldUpdate(["pressed"], dirty)) {
      setAttr(n.node0, "data-state", pressed() ? "on" : "off")
    }
    if (shouldUpdate(["disabled"], dirty)) {
      setAttr(n.node0, "data-disabled", disabled || undefined)
    }
    if (shouldUpdate(["pressed"], dirty)) {
      setAttr(n.node0, "aria-pressed", pressed())
    }
    if (shouldUpdate(["disabled"], dirty)) {
      n.node0.toggleAttribute("disabled", Boolean(disabled))
      n.node0.disabled = Boolean(disabled)
    }
    if (shouldUpdate(["label"], dirty)) {
      n.text0.data = String(label)
    }
    if (shouldUpdate(["pressed"], dirty)) {
      n.text1.data = String(stateLabel())
    }
    if (shouldUpdate([], dirty)) {
      n.text2.data = "Off"
    }
    if (shouldUpdate(["pressed"], dirty)) {
      const node2When = Boolean(pressed())
      n.node2Content.hidden = !node2When
      n.node2Fallback.hidden = node2When
    }
    if (shouldUpdate(["pressed"], dirty)) {
      n.listRecords = reconcileKeyed(
        n.node5,
        n.listRecords,
        Array.from(indicators() ?? []),
        (item) => item,
        () => {
          const forNode0 = document.createElement("span")
          forNode0.setAttribute("part", "indicator")
          const forText1 = document.createTextNode("")
          forNode0.append(forText1)
          return { node: forNode0, forNode0, forText1 }
        },
        (record, item, index) => {
          setAttr(record.forNode0, "data-index", index)
          record.forText1.data = String(item)
        },
      )
    }
  },
  effects(k, dirty) {
    const { host } = bindings(k)
    runEffect(k, 0, dirty, null, () => {
      const { element, signal } = host()
      element.setAttribute("data-effect", "mounted")
      signal.addEventListener(
        "abort",
        () => {
          element.setAttribute("data-effect", "aborted")
        },
        { once: true },
      )
      return () => {
        element.removeAttribute("data-effect")
      }
    })
  },
}

function bindings(k) {
  const disabled = k.props.disabled
  const label = k.props.label
  const pressed = stateAccessor(k, "pressed")
  const stateLabel = computedAccessor(k, "stateLabel", () => (pressed() ? "On" : "Off"))
  const indicators = computedAccessor(k, "indicators", () =>
    pressed() ? ["Pressed", "Active"] : ["Idle"],
  )
  const changed = emitter(k, "toggle-change")
  const host = hostApi(k)
  return { disabled, label, pressed, stateLabel, indicators, changed, host }
}

class ToggleElement extends HTMLElement {
  static observedAttributes = ["disabled", "label"]
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
defineProps(ToggleElement, SPEC)
defineComponent("naos-toggle", ToggleElement, {
  packageName: "@naos-ui/example",
  packageVersion: "1.0.0",
  tagName: "naos-toggle",
})
export { ToggleElement as Toggle }
export default ToggleElement
