import { readFileSync } from "node:fs"
import { expect, test } from "@playwright/test"

const baseline = JSON.parse(
  readFileSync(
    new URL("../../../packages/primitives/fixtures/public-contract-baseline.json", import.meta.url),
    "utf8",
  ),
) as { contracts: Array<{ tag: string; parts: string[] }> }

test("date picker exposes calendar parts and preserves its seven-column grid", async ({ page }) => {
  await page.goto("/")
  await page.evaluate(() => {
    const picker = document.createElement("naos-date-picker")
    picker.id = "parts-date"
    picker.setAttribute("value", "2026-06-18")
    document.body.append(picker)
    const style = document.createElement("style")
    style.textContent = `
      #parts-date::part(table-header) { color: rgb(1, 2, 3); }
      #parts-date::part(table-cell) { background: rgb(10, 20, 30); }
      #parts-date::part(cell-trigger) { background: rgb(40, 50, 60); }
      #parts-date::part(positioner) { outline: 3px solid rgb(70, 80, 90); }
      #parts-date::part(content) { border-color: rgb(100, 110, 120); }
    `
    document.head.append(style)
  })
  const picker = page.locator("#parts-date")
  await picker.locator("[part~='trigger']").click()
  const content = picker.locator("[part~='content']")
  await expect(content).toBeVisible()
  const contract = baseline.contracts.find((entry) => entry.tag === "naos-date-picker")
  if (!contract) throw new Error("Missing date picker contract baseline")
  for (const part of contract.parts) {
    expect(
      await picker.locator(`[part~='${part}']`).count(),
      `missing part: ${part}`,
    ).toBeGreaterThan(0)
  }
  await expect(picker.locator("[part~='table-header']")).toHaveCount(7)
  await expect(picker.locator("[part~='table-cell']")).toHaveCount(42)
  await expect(picker.locator("[part~='cell-trigger']")).toHaveCount(42)
  await expect(picker.locator("[part~='table-header']").first()).toHaveCSS("color", "rgb(1, 2, 3)")
  await expect(picker.locator("[part~='table-cell']").first()).toHaveCSS(
    "background-color",
    "rgb(10, 20, 30)",
  )
  await expect(picker.locator("[part~='cell-trigger']").first()).toHaveCSS(
    "background-color",
    "rgb(40, 50, 60)",
  )
  await expect(picker.locator("[part~='positioner']")).toHaveCSS("outline-color", "rgb(70, 80, 90)")
  await expect(content).toHaveCSS("border-top-color", "rgb(100, 110, 120)")
  expect(
    await picker
      .locator("[part~='table-cell']")
      .first()
      .evaluate((el) => el.querySelector("[part~='cell-trigger']") !== null),
  ).toBe(true)
  expect(await content.evaluate((el) => el.parentElement?.getAttribute("part"))).toBe("positioner")
  const day = picker.locator("[part~='cell-trigger'][data-value='2026-06-18']")
  await expect(day).toHaveText("18")
  await day.focus()
  await page.keyboard.press("ArrowRight")
  await expect(picker.locator("[part~='cell-trigger'][data-value='2026-06-19']")).toBeFocused()
  await expect(picker.locator("[part~='root']")).toHaveAttribute("data-focused-value", "2026-06-19")
  await page.keyboard.press("Enter")
  await expect(picker.locator("[part~='root']")).toHaveAttribute("data-value", "2026-06-19")
  await picker.locator("[part~='trigger']").click()
  const positions = await picker.locator("[part~='cell-trigger']").evaluateAll((cells) =>
    cells.slice(0, 8).map((cell) => {
      const rect = cell.getBoundingClientRect()
      return { x: rect.x, y: rect.y }
    }),
  )
  expect(new Set(positions.slice(0, 7).map((position) => position.y)).size).toBe(1)
  expect(new Set(positions.slice(0, 7).map((position) => position.x)).size).toBe(7)
  expect(positions[7]!.y).toBeGreaterThan(positions[0]!.y)
  await picker.locator("[part~='next']").click()
  await expect(picker.locator("[part~='table-header']")).toHaveCount(7)
  await expect(picker.locator("[part~='table-cell']")).toHaveCount(42)
  await expect(picker.locator("[part~='cell-trigger']")).toHaveCount(42)
  await picker.evaluate((element) => {
    const parent = element.parentElement!
    element.remove()
    parent.append(element)
  })
  await expect(picker.locator("[part~='cell-trigger']")).toHaveCount(42)
  await expect(picker.locator("[part~='table-cell']").first()).toHaveCSS(
    "background-color",
    "rgb(10, 20, 30)",
  )
})

test("slider shows its thumb and number controls have action names", async ({ page }) => {
  await page.goto("/")
  await page.evaluate(() => {
    const slider = document.createElement("naos-slider")
    slider.id = "parts-slider"
    slider.setAttribute("value", "40")
    const number = document.createElement("naos-number-input")
    number.id = "parts-number"
    document.body.append(slider, number)
    const style = document.createElement("style")
    style.textContent = "#parts-slider::part(thumb) { background-color: rgb(3, 4, 5); }"
    document.head.append(style)
  })
  const slider = page.locator("#parts-slider")
  const thumb = slider.locator("[part~='thumb']")
  await expect(thumb).toHaveCSS("opacity", "1")
  await expect(thumb).toHaveCSS("background-color", "rgb(3, 4, 5)")
  expect((await thumb.boundingBox())?.width).toBeGreaterThan(10)
  await expect(thumb).toHaveAttribute("role", "slider")
  await thumb.focus()
  await page.keyboard.press("ArrowRight")
  await expect(thumb).toHaveAttribute("aria-valuenow", "41")
  const track = slider.locator("[part~='track']")
  const rect = await track.boundingBox()
  if (!rect) throw new Error("Slider track has no layout box")
  await page.mouse.click(rect.x + rect.width * 0.8, rect.y + rect.height / 2)
  await expect(thumb).toHaveAttribute("aria-valuenow", "80")
  await expect(thumb).toHaveCSS("background-color", "rgb(3, 4, 5)")
  await slider.evaluate((element) => {
    const parent = element.parentElement!
    element.remove()
    parent.append(element)
  })
  await expect(thumb).toHaveCSS("background-color", "rgb(3, 4, 5)")
  await expect(
    page.locator("#parts-number").getByRole("button", { name: "Increase Number" }),
  ).toHaveCount(1)
  await expect(
    page.locator("#parts-number").getByRole("button", { name: "Decrease Number" }),
  ).toHaveCount(1)
  await page.locator("#parts-number").evaluate((element) => element.setAttribute("label", "Guests"))
  await expect(
    page.locator("#parts-number").getByRole("button", { name: "Increase Guests" }),
  ).toHaveCount(1)
})
