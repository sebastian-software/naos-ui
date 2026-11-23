import { readFileSync } from "node:fs"
import { expect, type Locator } from "@playwright/test"

const baseline = JSON.parse(
  readFileSync(
    new URL("../../../packages/primitives/fixtures/public-contract-baseline.json", import.meta.url),
    "utf8",
  ),
) as {
  contracts: Array<{ tag: string; parts: string[] }>
}
export async function expectBaselineParts(root: Locator, tag: string) {
  const contract = baseline.contracts.find((item) => item.tag === tag)
  if (!contract) throw new Error(`Missing baseline for ${tag}`)
  for (const part of contract.parts) {
    await expect(
      root.locator(`[part~="${part}"]`),
      `${tag} is missing part ${part}`,
    ).not.toHaveCount(0)
  }
}
