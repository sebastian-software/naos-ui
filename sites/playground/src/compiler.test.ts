import { describe, expect, it } from "vitest"

import { rewriteRuntimeImports } from "./compiler"

describe("rewriteRuntimeImports", () => {
  it("maps generated package imports to browser-resolvable playground assets", () => {
    const code = [
      'import { createKernel } from "@naos-ui/runtime/internal";',
      "import { scheduleNaosUpdate } from '@naos-ui/runtime';",
      'import { flipMovedElements } from "@naos-ui/motion";',
    ].join("\n")

    const rewritten = rewriteRuntimeImports(code, {
      runtime: "https://example.test/playground/naos-runtime/runtime.mjs",
      runtimeInternal: "https://example.test/playground/naos-runtime/internal.mjs",
      motion: "https://example.test/playground/naos-motion.js",
    })

    expect(rewritten).toBe(
      [
        'import { createKernel } from "https://example.test/playground/naos-runtime/internal.mjs";',
        'import { scheduleNaosUpdate } from "https://example.test/playground/naos-runtime/runtime.mjs";',
        'import { flipMovedElements } from "https://example.test/playground/naos-motion.js";',
      ].join("\n"),
    )
    expect(rewritten).not.toContain('from "@naos-ui/')
  })
})
