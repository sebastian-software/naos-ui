import { expect, test } from "@playwright/test"

test("form status follows the associated action and respects native form boundaries", async ({
  page,
}) => {
  await page.goto("/form-status.html")
  const light = page.locator("#light-status")
  const external = page.locator("#external")
  const shadow = page.locator("#shadow-host")
  const other = page.locator("#secondary-status")
  const slotted = page.locator("#slotted-status")
  await expect(light).toHaveAttribute("data-status", "idle")
  await expect(external).toHaveAttribute("data-status", "idle")
  await expect(shadow).toHaveAttribute("data-nested-status", "idle")
  await expect(shadow).toHaveAttribute("data-native-status", "absent")
  await expect(slotted).toHaveAttribute("data-status", "idle")
  await expect(page.locator("#outside-status")).toHaveAttribute("data-status", "absent")

  await external.click()
  await expect(light).toHaveAttribute("data-status", "pending")
  await expect(external).toHaveAttribute("data-status", "pending")
  await expect(shadow).toHaveAttribute("data-nested-status", "pending")
  await expect(shadow).toHaveAttribute("data-native-status", "absent")
  await expect(other).toHaveAttribute("data-status", "idle")
  await expect(slotted).toHaveAttribute("data-status", "idle")

  await page.getByRole("button", { name: "Move and rebind status observer" }).click()
  await expect(light).toHaveAttribute("data-status", "idle")
  await page.getByRole("button", { name: "Finish submission" }).click()
  await expect(external).toHaveAttribute("data-status", "idle")
  await page.getByRole("button", { name: "Remove primary enhancement" }).click()
  await expect(external).toHaveAttribute("data-status", "absent")
  await expect(shadow).toHaveAttribute("data-nested-status", "absent")
  await expect(light).toHaveAttribute("data-status", "idle")
})

test("a compiled form removes enhancement while detached and reinstalls it on reconnect", async ({
  page,
}) => {
  await page.goto("/form-status.html")
  const host = page.locator("#compiled-form-container demo-note-form")
  const status = page.locator("#compiled-form-status")
  await expect(status).toHaveAttribute("data-status", "idle")
  await host.getByRole("textbox", { name: "Note" }).fill("Saved after reconnect")

  await page.getByRole("button", { name: "Disconnect compiled form" }).click()
  await expect(host).toHaveCount(0)
  await expect(status).toHaveAttribute("data-status", "absent")
  await expect(status).toHaveAttribute("data-detached-submit-prevented", "false")

  await page.getByRole("button", { name: "Reconnect compiled form" }).click()
  await expect(status).toHaveAttribute("data-status", "idle")
  const submit = host.getByRole("button", { name: "Save note" })
  await submit.click()
  await expect(status).toHaveAttribute("data-status", "pending")
  await expect(host.locator("[data-note-count]")).toHaveText("1")
  await expect(status).toHaveAttribute("data-status", "idle")
})

test("a prerendered note form keeps its DOM and enhances on hydration", async ({ page }) => {
  await page.goto("/dsd.html?delayUpgrade=1")
  const host = page.locator("#dsd-note-form-case demo-note-form")
  const status = page.locator("#dsd-note-status")
  const form = host.locator("form")
  const prerendered = await form.elementHandle()
  if (!prerendered) throw new Error("Missing prerendered form")
  expect(
    await host.evaluate((element) => customElements.get(element.localName) === undefined),
  ).toBe(true)
  await expect(status).toHaveAttribute("data-status", "absent")
  await expect(form).toHaveAttribute("data-naos-root", "")
  const input = form.getByRole("textbox", { name: "Note" })
  await input.fill("A prerendered note")

  await page.evaluate(() =>
    (window as unknown as Window & { __naosUpgrade(): Promise<unknown> }).__naosUpgrade(),
  )
  await expect(status).toHaveAttribute("data-status", "idle")
  expect(await prerendered.evaluate((element) => element.isConnected)).toBe(true)
  await expect(input).toHaveValue("A prerendered note")
  await form.getByRole("button", { name: "Save note" }).click()
  await expect(status).toHaveAttribute("data-status", "pending")
  await expect(form.locator("[data-note-count]")).toHaveText("1")
  await expect(status).toHaveAttribute("data-status", "idle")
})
