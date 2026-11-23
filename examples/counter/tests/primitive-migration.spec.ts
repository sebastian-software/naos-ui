import { expect, test, type Page } from "@playwright/test"

async function formRegions(page: Page) {
  return page
    .locator("form")
    .evaluate((form: HTMLFormElement) => new FormData(form).getAll("region"))
}

async function events(page: Page) {
  return JSON.parse((await page.locator("#primitive-events").textContent()) ?? "[]") as Array<{
    id: string
    type: string
    detail: unknown
    bubbles: boolean
    composed: boolean
  }>
}

test("packaged Popover consumer closes the active layer and focuses its trigger", async ({
  page,
}) => {
  await page.goto("/primitive-migration.html")
  const outer = page.locator("#outer")
  const inner = page.locator("#inner")
  const outerTrigger = outer.getByRole("button", { name: "Open outer", exact: true })
  const innerTrigger = inner.locator("[part~='trigger']")
  const outerContent = outer.getByRole("dialog", { name: "Outer details", exact: true })
  const innerContent = inner.getByRole("dialog", { name: "Inner details", exact: true })

  await outerTrigger.click()
  await expect(outerContent).toBeVisible()
  await innerTrigger.click()
  await expect(innerContent).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(innerContent).toBeHidden()
  await expect(outerContent).toBeVisible()
  await expect(innerTrigger).toBeFocused()
  await page.keyboard.press("Escape")
  await expect(outerContent).toBeHidden()
  await expect(outerTrigger).toBeFocused()

  expect(
    (await events(page)).map(({ id, type, detail, bubbles, composed }) => [
      id,
      type,
      detail,
      bubbles,
      composed,
    ]),
  ).toEqual([
    ["outer", "naos-open-change", { open: true }, true, true],
    ["inner", "naos-open-change", { open: true }, true, true],
    ["inner", "naos-open-change", { open: false }, true, true],
    ["outer", "naos-open-change", { open: false }, true, true],
  ])
})

test("packaged Select consumer keeps rich options and native form reset", async ({ page }) => {
  await page.goto("/primitive-migration.html")
  const trigger = page.getByRole("combobox", { name: "Region" })
  const select = page.locator("naos-select")
  await expect(trigger).toContainText("Europe")
  await expect.poll(() => formRegions(page)).toEqual(["eu"])
  await trigger.press("Space")
  await expect(select.locator("strong")).toBeVisible()
  await expect(select.locator("em")).toHaveText("Rich option")
  await expect(select.getByRole("option", { name: "Other" })).toHaveAttribute(
    "aria-disabled",
    "true",
  )
  await select.getByRole("option", { name: "North America" }).click()
  await expect(trigger).toContainText("North America")
  await expect.poll(() => formRegions(page)).toEqual(["na"])
  await expect(trigger).toBeFocused()
  await page.getByRole("button", { name: "Restore defaults" }).click()
  await expect.poll(() => formRegions(page)).toEqual(["eu"])
  await expect(trigger).toContainText("Europe")
  expect((await events(page)).find((event) => event.type === "naos-change")).toMatchObject({
    detail: { value: "na" },
    bubbles: true,
    composed: true,
  })
})
