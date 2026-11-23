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
