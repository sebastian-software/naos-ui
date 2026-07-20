import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { build as esbuildBuild } from "esbuild"
import { rollup } from "rollup"
import { afterEach, describe, expect, it } from "vitest"

import { naosPlugin } from "./index.js"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
const counterEntry = join(repoRoot, "examples", "counter", "src", "counter.wc.tsx")

let outDir: string | null = null

afterEach(async () => {
  if (outDir) {
    await rm(outDir, { force: true, recursive: true })
    outDir = null
  }
})

function assertCompiledCounter(output: string) {
  expect(output).toMatch(/(?:__naos)?[Dd]efineComponent\("demo-counter"/)
  expect(output).toMatch(/(?:__naos)?[Ee]mitter\(/)
  expect(output).toContain("data-count")
  // The ?inline CSS import is inlined as a string for the shared stylesheet.
  expect(output).toContain("--naos-control-border")
}

describe("naosPlugin", () => {
  it("builds the counter component with esbuild", async () => {
    outDir = await mkdtemp(join(tmpdir(), "naos-unplugin-esbuild-"))
    const outfile = join(outDir, "counter.js")

    await esbuildBuild({
      bundle: true,
      entryPoints: [counterEntry],
      external: ["@naos-ui/*"],
      format: "esm",
      outfile,
      plugins: [naosPlugin.esbuild()],
    })

    assertCompiledCounter(await readFile(outfile, "utf8"))
  })

  it("builds the counter component with Rollup", async () => {
    outDir = await mkdtemp(join(tmpdir(), "naos-unplugin-rollup-"))

    const bundle = await rollup({
      external: (id) => id.startsWith("@naos-ui/"),
      input: counterEntry,
      plugins: [naosPlugin.rollup()],
    })
    try {
      const { output } = await bundle.generate({ format: "esm" })
      const chunk = output.find((entry) => entry.type === "chunk")
      if (chunk?.type !== "chunk") {
        throw new Error("Rollup produced no chunk output.")
      }
      assertCompiledCounter(chunk.code)
    } finally {
      await bundle.close()
    }
  })

  it("surfaces compiler diagnostics with code frames", async () => {
    await expect(
      rollup({
        input: "broken.wc.tsx",
        plugins: [
          {
            name: "virtual-broken",
            resolveId: (id) => (id === "broken.wc.tsx" ? id : null),
            load: (id) =>
              id === "broken.wc.tsx"
                ? "export function Broken() {\n  return <p>{flag ? <b>yes</b> : <i>no</i>}</p>\n}\n"
                : null,
          },
          naosPlugin.rollup(),
        ],
      }),
    ).rejects.toThrow(/NAOS_UNSUPPORTED_CONDITIONAL_JSX/)
  })

  it("leaves non-component modules untouched", async () => {
    outDir = await mkdtemp(join(tmpdir(), "naos-unplugin-plain-"))
    const outfile = join(outDir, "plain.js")

    await esbuildBuild({
      bundle: true,
      entryPoints: [join(repoRoot, "packages", "unplugin", "src", "fixtures", "plain.ts")],
      format: "esm",
      outfile,
      plugins: [naosPlugin.esbuild()],
    })

    expect(await readFile(outfile, "utf8")).toContain("plain module")
  })
})
