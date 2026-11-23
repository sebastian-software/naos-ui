import { describe, expect, it } from "vitest"

import primitives from "../../../packages/primitives/package.json"
import { componentExamples } from "../../shared/component-examples"
import { examples } from "./examples"

describe("playground catalogue", () => {
  it("includes every public primitive in an editable example", () => {
    const tags = new Set(componentExamples.flatMap((example) => example.tags))
    const entries = Object.keys(primitives.exports).filter((entry) => entry !== ".")
    expect([...tags].sort()).toEqual(entries.map((entry) => "naos-" + entry.slice(2)).sort())
  })

  it("has a unique link for every example", () => {
    expect(new Set(examples.map((example) => example.id)).size).toBe(examples.length)
  })
})
