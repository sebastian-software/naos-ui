import { createNaosEvent, scheduleNaosUpdate } from "@naos-ui/runtime"
import { afterEach, describe, expect, it } from "vitest"

import { captureEvents, flush, mount, nextTick } from "./index.js"

class ProbeCounterElement extends HTMLElement {
  static observedAttributes = ["label"]

  #count = 0
  #flushScheduled = false
  #labelText: Element | null = null
  #valueText: Element | null = null

  connectedCallback() {
    if (!this.shadowRoot) {
      const root = this.attachShadow({ mode: "open" })
      const label = document.createElement("span")
      label.setAttribute("part", "label")
      const value = document.createElement("span")
      value.setAttribute("part", "value")
      root.append(label, value)
      this.#labelText = label
      this.#valueText = value
    }
    this.#scheduleUpdate()
  }

  attributeChangedCallback() {
    this.#scheduleUpdate()
  }

  get count() {
    return this.#count
  }

  set count(next: number) {
    this.#count = next
    this.dispatchEvent(createNaosEvent("naos-change", { count: next }))
    this.#scheduleUpdate()
  }

  #scheduleUpdate() {
    if (this.#flushScheduled) {
      return
    }
    this.#flushScheduled = true
    scheduleNaosUpdate(() => {
      this.#flushScheduled = false
      if (this.#labelText) {
        this.#labelText.textContent = this.getAttribute("label") ?? ""
      }
      if (this.#valueText) {
        this.#valueText.textContent = String(this.#count)
      }
    })
  }
}

class ProbeShellElement extends HTMLElement {
  connectedCallback() {
    if (!this.shadowRoot) {
      const root = this.attachShadow({ mode: "open" })
      root.append(document.createElement("probe-counter"))
    }
  }
}

if (!customElements.get("probe-counter")) {
  customElements.define("probe-counter", ProbeCounterElement)
}
if (!customElements.get("probe-shell")) {
  customElements.define("probe-shell", ProbeShellElement)
}

describe("mount", () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it("mounts a tag with initial props and attrs and awaits the flush", async () => {
    const component = await mount("probe-counter", {
      attrs: { label: "Count" },
      props: { count: 3 },
    })

    expect(component.queryPart("label")?.textContent).toBe("Count")
    expect(component.queryPart("value")?.textContent).toBe("3")
    component.unmount()
    expect(document.body.childElementCount).toBe(0)
  })

  it("updates through setProps and setAttrs", async () => {
    const component = await mount("probe-counter")

    await component.setAttrs({ label: "Total" })
    await component.setProps({ count: 7 })

    expect(component.queryPart("label")?.textContent).toBe("Total")
    expect(component.queryPart("value")?.textContent).toBe("7")

    await component.setAttrs({ label: null })
    expect(component.queryPart("label")?.textContent).toBe("")
    component.unmount()
  })

  it("queries inside the shadow root by default", async () => {
    const component = await mount("probe-counter")

    expect(component.shadow()).toBeInstanceOf(ShadowRoot)
    expect(component.query("[part~='value']")).not.toBeNull()
    expect(component.queryAll("span")).toHaveLength(2)
    component.unmount()
  })

  it("pierces nested shadow roots when resolving parts", async () => {
    const component = await mount("probe-shell")

    const value = component.queryPart("value")
    expect(value?.textContent).toBe("0")
    component.unmount()
  })

  it("captures typed events and disposes them on unmount", async () => {
    const component = await mount("probe-counter")
    const changes = component.capture<{ count: number }>("naos-change")

    await component.setProps({ count: 1 })
    await component.setProps({ count: 2 })

    expect(changes.count).toBe(2)
    expect(changes.details).toEqual([{ count: 1 }, { count: 2 }])
    expect(changes.last?.detail.count).toBe(2)

    changes.clear()
    expect(changes.count).toBe(0)

    const element = component.element
    component.unmount()
    element.dispatchEvent(createNaosEvent("naos-change", { count: 9 }))
    expect(changes.count).toBe(0)
  })

  it("mounts an existing element into a provided container", async () => {
    const container = document.createElement("main")
    document.body.append(container)
    const element = document.createElement("probe-counter")

    const component = await mount(element, { container, props: { count: 5 } })

    expect(component.element).toBe(element)
    expect(element.parentElement).toBe(container)
    component.unmount()
    expect(container.isConnected).toBe(true)
    container.remove()
  })

  it("throws a clear error for light-DOM elements without a shadow root", async () => {
    const component = await mount(document.createElement("div"))
    expect(() => component.shadow()).toThrow("has no shadow root")
    component.unmount()
  })
})

describe("scheduling", () => {
  it("nextTick waits exactly one runtime scheduler turn", async () => {
    let ran = false
    scheduleNaosUpdate(() => {
      ran = true
    })
    expect(ran).toBe(false)
    await nextTick()
    expect(ran).toBe(true)
  })

  it("flush drains cascaded updates", async () => {
    let cascades = 0
    const cascade = () => {
      cascades += 1
      if (cascades < 5) {
        scheduleNaosUpdate(cascade)
      }
    }
    scheduleNaosUpdate(cascade)

    await flush()
    expect(cascades).toBe(5)
  })
})

describe("captureEvents", () => {
  it("captures events from arbitrary targets until disposed", () => {
    const target = new EventTarget()
    const capture = captureEvents<string>(target, "message")

    target.dispatchEvent(new CustomEvent("message", { detail: "one" }))
    expect(capture.details).toEqual(["one"])

    capture.dispose()
    target.dispatchEvent(new CustomEvent("message", { detail: "two" }))
    expect(capture.count).toBe(1)
  })
})
