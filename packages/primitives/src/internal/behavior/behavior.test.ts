import { describe, expect, it } from "vitest"

import { nextCheckboxState } from "./checkbox.js"
import {
  nextDisclosureOpen,
  shouldCloseDisclosureForKey,
} from "./disclosure.js"
import { tabsValueForKey } from "./tabs.js"
import { nextTogglePressed, toggleFormValue } from "./toggle.js"

describe("primitive behavior kernels", () => {
  it("toggles pressed state and form value", () => {
    expect(nextTogglePressed(false)).toBe(true)
    expect(nextTogglePressed(true)).toBe(false)
    expect(toggleFormValue(true, "on")).toBe("on")
    expect(toggleFormValue(false, "on")).toBeNull()
  })

  it("clears checkbox indeterminate state before toggling normally", () => {
    expect(nextCheckboxState({ checked: false, indeterminate: true })).toEqual({
      checked: true,
      indeterminate: false,
    })
    expect(nextCheckboxState({ checked: true, indeterminate: false })).toEqual({
      checked: false,
      indeterminate: false,
    })
  })

  it("maps disclosure transitions", () => {
    expect(nextDisclosureOpen(false)).toBe(true)
    expect(shouldCloseDisclosureForKey("Escape")).toBe(true)
    expect(shouldCloseDisclosureForKey("Enter")).toBe(false)
  })

  it("maps tab keyboard movement", () => {
    const values = ["first", "second", "third"]

    expect(tabsValueForKey("first", "ArrowRight", values)).toBe("second")
    expect(tabsValueForKey("first", "ArrowLeft", values)).toBe("third")
    expect(tabsValueForKey("second", "Home", values)).toBe("first")
    expect(tabsValueForKey("second", "End", values)).toBe("third")
    expect(tabsValueForKey("second", "ArrowDown", values)).toBeNull()
    expect(tabsValueForKey("second", "ArrowDown", values, "vertical")).toBe("third")
  })
})
