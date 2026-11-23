import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

type ExportPaths = { types: string; import: string }
type ComponentContract = {
  tag: string
  subpath: string
  declarationSha256: string
  properties: Array<{ attributeName: string }>
  parts: string[]
  slots: string[]
  formAssociated: boolean
}

const packageRoot = join(import.meta.dirname, "..")
const read = (file: string) => readFileSync(join(packageRoot, file), "utf8")
const baseline = JSON.parse(read("fixtures/public-contract-baseline.json")) as {
  revision: string
  exports: Array<ExportPaths & { subpath: string }>
  manifest: { schemaVersion: number; package: { name: string; version: string; tagPrefix: string } }
  components: object[]
  contracts: ComponentContract[]
}

const metadata = JSON.parse(read("package.json")) as {
  exports: Record<string, ExportPaths>
  version: string
}

describe(`published primitives contract at ${baseline.revision.slice(0, 7)}`, () => {
  it("preserves package exports and manifest records", () => {
    expect(metadata.exports).toMatchObject(
      Object.fromEntries(baseline.exports.map(({ subpath, ...paths }) => [subpath, paths])),
    )
    expect(JSON.parse(read("dist/naos-manifest.json"))).toMatchObject({
      ...baseline.manifest,
      package: { ...baseline.manifest.package, version: metadata.version },
    })
    const manifest = JSON.parse(read("dist/naos-manifest.json")) as { components: object[] }
    expect(manifest.components).toEqual(expect.arrayContaining(baseline.components))
  })

  it("imports root and selective package entries in Node without DOM globals", () => {
    execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "--eval",
        `import assert from "node:assert/strict";
      assert.equal(globalThis.HTMLElement, undefined);
      assert.equal(globalThis.customElements, undefined);
      const selective = await import("@naos-ui/primitives/popover");
      const all = await import("@naos-ui/primitives");
      assert.equal(typeof selective.NaosPopover, "function");
      assert.equal(all.NaosPopover, selective.NaosPopover);
      assert.equal(typeof all.NaosSelect, "function");`,
      ],
      { cwd: packageRoot, stdio: "pipe" },
    )
  })

  it.each(baseline.contracts)("preserves $tag declarations and registration", (contract) => {
    const paths = metadata.exports[contract.subpath]
    if (!paths) throw new Error(`Missing primitive export ${contract.subpath}`)
    const declaration = read(paths.types)
    const compiled = read(paths.import)
    expect(createHash("sha256").update(declaration.trimEnd()).digest("hex")).toBe(
      contract.declarationSha256,
    )
    expect(compiled).toContain(`__naosDefineComponent("${contract.tag}"`)
    if (contract.formAssociated) expect(compiled).toMatch(/static formAssociated = true/)
  })
})
