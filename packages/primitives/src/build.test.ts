import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const distRoot = join(import.meta.dirname, "..", "dist")

describe("@iktia/primitives build output", () => {
  it("ships compiled component modules without Vite-only CSS imports", () => {
    const button = readFileSync(join(distRoot, "button.mjs"), "utf8")

    expect(button).toContain("customElements.define(\"iktia-button\"")
    expect(button).toContain("const css =")
    expect(button).not.toContain("?inline")
  })

  it("exports every first-version primitive from the package entry", () => {
    const index = readFileSync(join(distRoot, "index.mjs"), "utf8")

    expect(index).toContain("export * from \"./button.mjs\"")
    expect(index).toContain("export * from \"./button-group.mjs\"")
    expect(index).toContain("export * from \"./checkbox.mjs\"")
    expect(index).toContain("export * from \"./dropdown.mjs\"")
    expect(index).toContain("export * from \"./field.mjs\"")
    expect(index).toContain("export * from \"./tabs.mjs\"")
    expect(index).toContain("export * from \"./toggle.mjs\"")
  })

  it("keeps primitive behavior kernels private but available to compiled components", () => {
    const checkbox = readFileSync(join(distRoot, "checkbox.mjs"), "utf8")
    const dropdown = readFileSync(join(distRoot, "dropdown.mjs"), "utf8")
    const tabs = readFileSync(join(distRoot, "tabs.mjs"), "utf8")

    expect(checkbox).toContain("from \"./internal/behavior/checkbox.js\"")
    expect(dropdown).toContain("from \"./internal/behavior/disclosure.js\"")
    expect(tabs).toContain("from \"./internal/behavior/tabs.js\"")
    expect(checkbox).not.toContain("@iktia/core")
  })

  it("emits form-associated checkbox and toggle output", () => {
    const checkbox = readFileSync(join(distRoot, "checkbox.mjs"), "utf8")
    const toggle = readFileSync(join(distRoot, "toggle.mjs"), "utf8")

    for (const source of [checkbox, toggle]) {
      expect(source).toContain("static formAssociated = true")
      expect(source).toContain("this.#internals = this.attachInternals()")
      expect(source).toContain("this.#internals.setFormValue")
      expect(source).toContain("formResetCallback()")
      expect(source).toContain("formDisabledCallback(disabled)")
    }
  })

  it("maps common DOM listener attribute names in package output", () => {
    const dropdown = readFileSync(join(distRoot, "dropdown.mjs"), "utf8")
    const tabs = readFileSync(join(distRoot, "tabs.mjs"), "utf8")

    expect(dropdown).toContain("addEventListener(\"keydown\"")
    expect(tabs).toContain("addEventListener(\"keydown\"")
    expect(dropdown).not.toContain("addEventListener(\"key-down\"")
    expect(tabs).not.toContain("addEventListener(\"key-down\"")
  })
})
