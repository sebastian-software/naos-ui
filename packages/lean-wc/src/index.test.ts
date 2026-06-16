import { describe, expect, it } from "vitest"

import { component, createLeanEvent, event, prop, state } from "./index.js"

describe("authoring runtime stubs", () => {
  it("throw clear errors outside compiler transforms", () => {
    expect(() => component("x-test", () => ({ kind: "lean-wc.jsx" }))).toThrow(
      "lean-wc component() can only be used"
    )
  })

  it("creates runtime custom events with lean defaults", () => {
    const customEvent = createLeanEvent("change", 1)

    expect(customEvent.type).toBe("change")
    expect(customEvent.detail).toBe(1)
    expect(customEvent.bubbles).toBe(true)
    expect(customEvent.composed).toBe(true)
    expect(customEvent.cancelable).toBe(false)
  })

  it("keeps prop state and event stubs compiler-only", () => {
    expect(() => prop.string("label", "Label")).toThrow("lean-wc prop()")
    expect(() => state(false)).toThrow("lean-wc state()")
    expect(() => event<number>("change")).toThrow("lean-wc event()")
  })
})

