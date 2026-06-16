import { setNativeBindingsForTesting } from "@lean-wc/core-node"
import { afterEach, describe, expect, it } from "vitest"

import { leanWebComponents } from "./vite.js"

describe("leanWebComponents", () => {
  afterEach(() => {
    setNativeBindingsForTesting(null)
  })

  it("passes through files outside the include filter", async () => {
    const plugin = leanWebComponents()
    const transform = plugin.transform
    if (typeof transform !== "function") {
      throw new Error("Expected transform hook")
    }

    const result = await transform.call(mockPluginContext(), "source", "/src/plain.ts")

    expect(result).toBeNull()
  })

  it("transforms wc tsx modules through the native wrapper", async () => {
    setNativeBindingsForTesting({
      getNativeInfo: () => ({ coreVersion: "test" }),
      transformComponent: (request) => ({
        code: `compiled:${request.filename}:${request.source}`,
        hasChanged: true,
      }),
    })

    const plugin = leanWebComponents()
    const transform = plugin.transform
    if (typeof transform !== "function") {
      throw new Error("Expected transform hook")
    }

    const result = await transform.call(mockPluginContext(), "source", "/src/counter.wc.tsx?raw")

    expect(result).toEqual({
      code: "compiled:/src/counter.wc.tsx:source",
      map: null,
    })
  })
})

function mockPluginContext() {
  return {
    error(error: string): never {
      throw new Error(error)
    },
  } as never
}

