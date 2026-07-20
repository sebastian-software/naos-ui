import { describe, expect, it } from "vitest"

import { createNaosManifest, serializeNaosManifest } from "./manifest.js"
import type { NaosPackageContext } from "./package-context.js"

const packageContext: NaosPackageContext = {
  name: "@acme/design-system",
  packageJsonPath: "/workspace/package.json",
  tagPrefix: "acme",
  version: "2.3.0",
}

describe("Naos manifests", () => {
  it("sorts components and serializes one deterministic trailing newline", () => {
    const manifest = createNaosManifest([
      component("/workspace/src/zeta.wc.tsx", "acme-zeta"),
      component("/workspace/src/alpha.wc.tsx", "acme-alpha"),
    ])

    expect(manifest.components.map((entry) => entry.tagName)).toEqual(["acme-alpha", "acme-zeta"])
    expect(manifest.components[0]?.importPath).toBe("src/alpha.wc.tsx")
    expect(serializeNaosManifest(manifest)).toMatch(/^\{[\s\S]*\}\n$/)
  })

  it("rejects duplicate tags with both source paths", () => {
    expect(() =>
      createNaosManifest([
        component("/workspace/src/one.wc.tsx", "acme-button"),
        component("/workspace/src/two.wc.tsx", "acme-button"),
      ]),
    ).toThrow("src/one.wc.tsx and src/two.wc.tsx")
  })
})

function component(filename: string, tagName: string) {
  return {
    className: "FixtureElement",
    exportName: "Fixture",
    filename,
    package: packageContext,
    shadow: true,
    tagName,
    usesDeclarativeShadowDom: false,
  }
}
