import { describe, expect, it } from "vitest"

import { getNativeInfo } from "./index.js"

describe("getNativeInfo", () => {
  it("returns core version metadata", () => {
    expect(getNativeInfo().coreVersion).toBe("0.0.0")
  })
})
