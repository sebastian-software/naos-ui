import { describe, expect, it } from "vitest"

import { packageName } from "./index.js"

describe("packageName", () => {
  it("identifies the package", () => {
    expect(packageName).toBe("lean-wc")
  })
})
