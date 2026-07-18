import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"

import { NaosCompilerError } from "./index.js"
import { normalizePackageName, resolveNaosPackageContext } from "./package-context.js"

const temporaryRoots: string[] = []

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true })
  }
})

describe("Naos package context", () => {
  it("normalizes the complete scoped package name", () => {
    expect(normalizePackageName("@Acme/designSystem")).toBe("acme-design-system")
  })

  it("resolves the nearest package and its explicit prefix", () => {
    const root = temporaryRoot()
    const sourceDirectory = join(root, "src", "components")
    mkdirSync(sourceDirectory, { recursive: true })
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({
        name: "@acme/design-system",
        naos: { tagPrefix: "acme" },
        version: "2.3.0",
      }),
    )

    expect(resolveNaosPackageContext(join(sourceDirectory, "button.wc.tsx"))).toEqual({
      name: "@acme/design-system",
      packageJsonPath: join(root, "package.json"),
      tagPrefix: "acme",
      version: "2.3.0",
    })
  })

  it("reports reserved prefixes as structured diagnostics", () => {
    const root = temporaryRoot()
    const packageJsonPath = join(root, "package.json")
    writeFileSync(
      packageJsonPath,
      JSON.stringify({ name: "widgets", naos: { tagPrefix: "xml-widgets" } }),
    )

    expect(() => resolveNaosPackageContext("virtual.wc.tsx", packageJsonPath)).toThrow(
      NaosCompilerError,
    )
    try {
      resolveNaosPackageContext("virtual.wc.tsx", packageJsonPath)
    } catch (error) {
      expect((error as NaosCompilerError).diagnostics[0]?.code).toBe("NAOS_TAG_PREFIX_INVALID")
    }
  })
})

function temporaryRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "naos-package-context-"))
  temporaryRoots.push(root)
  return root
}
