import { expect, test } from "@playwright/test"

test("dialog preserves modal dismissal, focus and reconnect", async ({ page }) => {
  await page.goto("/")
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.evaluate(() => {
    const container = document.createElement("div")
    container.innerHTML = `<naos-dialog id="migration-dialog"><button>Inside</button></naos-dialog>`
    document.body.append(container)
    const dialog = container.firstElementChild as HTMLElement & { changes: boolean[] }
    dialog.changes = []
    dialog.addEventListener("naos-open-change", (event) => {
      if (event.target === dialog)
        dialog.changes.push((event as CustomEvent<{ open: boolean }>).detail.open)
    })
  })
  const dialog = page.locator("#migration-dialog")
  const trigger = dialog.locator("[part~='trigger']")
  const content = dialog.locator("[part~='content']")
  await trigger.click()
  await expect(content).toBeVisible()
  await expect(content).toHaveAttribute("role", "dialog")
  await expect(content).toHaveAttribute("aria-modal", "true")
  await page.keyboard.press("Escape")
  await expect(content).toBeHidden()
  await expect(trigger).toBeFocused()
  expect(
    await dialog.evaluate((element) => (element as HTMLElement & { changes: boolean[] }).changes),
  ).toEqual([true, false])
  await trigger.click()
  await expect(content).toBeVisible()
  await dialog.evaluate((element) => {
    const parent = element.parentElement!
    element.remove()
    parent.append(element)
  })
  await expect(content).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(content).toBeHidden()
})
