import { expect, test } from "@playwright/test"
import { examples } from "../src/examples"
import { componentExamples } from "../../shared/component-examples"

test("every example compiles and mounts its registered elements from the production build", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.goto("/playground/")
  const picker = page.getByRole("combobox", { name: "Choose an example" })
  const preview = page.locator("#preview")
  for (const example of examples) {
    await test.step(example.label, async () => {
      const previous = await preview.evaluate((el) => el.firstElementChild?.localName)
      if ((await picker.inputValue()) !== example.id) await picker.selectOption(example.id)
      else await page.getByRole("button", { name: "Run", exact: true }).click()
      await expect
        .poll(() =>
          preview.evaluate((el, previous) => {
            const host = el.firstElementChild
            return !!host?.shadowRoot?.childElementCount && host.localName !== previous
          }, previous),
        )
        .toBe(true)
      await expect(page.locator("#preview-error")).toBeHidden()
      await expect(page.locator("#diagnostics")).toBeHidden()
      const recipe = componentExamples.find(({ id }) => id === example.id)
      for (const tag of recipe?.tags ?? []) {
        await expect(preview.locator(tag).first()).toHaveJSProperty("localName", tag)
        expect(
          await preview
            .locator(tag)
            .first()
            .evaluate((el) => el.matches(":defined") && !!el.shadowRoot),
        ).toBe(true)
      }
    })
  }
  expect(errors).toEqual([])
})

test("opens a linked example, updates the preview, and recovers after an invalid edit", async ({
  page,
}) => {
  await page.goto("/playground/?example=feedback")
  const preview = page.locator("#preview")
  const advance = preview.getByRole("button", { name: "Advance" })
  await advance.click()
  await expect(preview.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50")
  await page.locator(".cm-content").fill("export function Broken( {")
  await page.getByRole("button", { name: "Run", exact: true }).click()
  await expect(page.locator("#diagnostics")).toBeVisible()
  await page.getByRole("combobox", { name: "Choose an example" }).selectOption("counter")
  await preview.getByRole("button", { name: /Count/ }).click()
  await expect(preview.getByRole("button", { name: /Count/ })).toContainText("1")
  await expect(page.locator("#diagnostics")).toBeHidden()
})
