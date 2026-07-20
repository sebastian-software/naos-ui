import { existsSync } from "node:fs"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { getNativeInfo, renderDeclarativeShadowDom, transformComponent } from "./index.js"

const wasmModulePath = fileURLToPath(new URL("../native/naos-compiler.wasm", import.meta.url))
const wasmModuleAvailable = existsSync(wasmModulePath)
if (!wasmModuleAvailable) {
  console.warn(
    `[compiler-wasm] skipping binding tests - missing ${wasmModulePath}. Run \`pnpm --filter @naos-ui/compiler-wasm build\` with a Rust toolchain.`,
  )
}

const nativeBindingPath = fileURLToPath(
  new URL("../../compiler/native/naos-node.node", import.meta.url),
)
const nativeBindingAvailable = existsSync(nativeBindingPath)

const counterSource = `import { state } from "@naos-ui/core"

export function Counter({ label = "Count" }) {
  const count = state(0)

  return <button onClick={() => count.set(count() + 1)}>{label}: {count()}</button>
}
`

const baseRequest = {
  filename: "counter.wc.tsx",
  packageName: "@naos-ui/wasm-test",
  packageVersion: "1.2.3",
  tagPrefix: "wasm",
}

describe.skipIf(!wasmModuleAvailable)("@naos-ui/compiler-wasm", () => {
  it("reports the compiler core version", () => {
    expect(getNativeInfo().coreVersion).toMatch(/^\d+\.\d+\.\d+/)
  })

  it("transforms components with the N-API result shape", () => {
    const result = transformComponent({ ...baseRequest, source: counterSource })

    expect(result.code).toContain('__naosDefineComponent("wasm-counter"')
    expect(result.tagName).toBe("wasm-counter")
    expect(result.className).toBe("CounterElement")
    expect(result.exportName).toBe("Counter")
    expect(result.hasChanged).toBe(true)
    expect(result.props).toEqual([
      expect.objectContaining({ attributeName: "label", kind: "string", propName: "label" }),
    ])
    expect(result.packageName).toBe("@naos-ui/wasm-test")
    expect(result.packageVersion).toBe("1.2.3")
    expect(result.tagPrefix).toBe("wasm")
    expect(result.map?.mappings.length).toBeGreaterThan(0)
    expect(result.map?.sourcesContent).toEqual([counterSource])
  })

  it.skipIf(!nativeBindingAvailable)("matches the native binding output", () => {
    const nativeRequire = createRequire(import.meta.url)
    const native = nativeRequire(nativeBindingPath) as {
      transformComponent: (request: object) => { code: string }
    }
    const request = { ...baseRequest, source: counterSource }
    expect(transformComponent(request).code).toBe(native.transformComponent(request).code)
  })

  it("throws the shared diagnostics reason payload on compile errors", () => {
    let thrown: Error | null = null
    try {
      transformComponent({
        ...baseRequest,
        source: "export function Broken() {\n  return <p>{flag ? <b>yes</b> : <i>no</i>}</p>\n}\n",
        filename: "broken.wc.tsx",
      })
    } catch (error) {
      thrown = error as Error
    }

    expect(thrown?.message.startsWith("NAOS_COMPILER_DIAGNOSTICS:")).toBe(true)
    const payload = JSON.parse(
      thrown?.message.slice("NAOS_COMPILER_DIAGNOSTICS:".length) ?? "{}",
    ) as { diagnostics: Array<{ code: string }> }
    expect(payload.diagnostics[0]?.code).toBe("NAOS_UNSUPPORTED_CONDITIONAL_JSX")
  })

  it("prerenders Declarative Shadow DOM host HTML", () => {
    const result = renderDeclarativeShadowDom({
      ...baseRequest,
      source: counterSource,
      propsJson: '{"label":"Served"}',
    })

    expect(result.tagName).toBe("wasm-counter")
    expect(result.usesDeclarativeShadowDom).toBe(true)
    expect(result.html).toContain("<wasm-counter")
    expect(result.html).toContain("Served")
  })
})
