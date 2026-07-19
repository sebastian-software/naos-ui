import { describe, expect, it } from "vitest"

import { Show, clx, computed, effect, event, formControl, host, on, state } from "./index.js"

describe("authoring runtime stubs", () => {
  it("keeps authoring stubs compiler-only", () => {
    expect(() => state(false)).toThrow("Naos state()")
    expect(() => computed(() => true)).toThrow("Naos computed()")
    expect(() => effect(() => undefined)).toThrow("Naos effect()")
    expect(() => Show({ when: true })).toThrow("Naos Show()")
    expect(() => on(() => undefined)).toThrow("Naos on()")
    expect(() => host()).toThrow("Naos host()")
    expect(() => event<number>("change")).toThrow("Naos event()")
    expect(() => formControl({ value: () => null })).toThrow("Naos formControl()")
  })
})

describe("clx", () => {
  it("joins truthy string and number inputs", () => {
    expect(clx("card", "active", 0, 1)).toBe("card active 1")
  })

  it("skips falsy inputs from conditional expressions", () => {
    const active: boolean = false
    expect(clx("card", false, null, undefined, "")).toBe("card")
    expect(clx(active && "hidden", "shown")).toBe("shown")
  })

  it("maps object inputs by value truthiness", () => {
    expect(clx({ active: true, disabled: false, count: 3, empty: "" })).toBe("active count")
  })

  it("flattens nested arrays", () => {
    expect(clx(["a", ["b", false, ["c"]]], "d")).toBe("a b c d")
  })

  it("returns an empty string without inputs", () => {
    expect(clx()).toBe("")
    expect(clx(false, null, [])).toBe("")
  })
})
