import { expect, test } from "@playwright/test"

for (const tag of ["naos-tooltip", "naos-hover-card"]) {
  test(`${tag} opens on focus and dismisses on Escape`, async ({ page }) => {
    await page.goto("/")
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.evaluate((name) => {
      const element = document.createElement(name)
      element.id = "hover-overlay"
      element.textContent = "Description"
      document.body.append(element)
    }, tag)
    const overlay = page.locator("#hover-overlay")
    const trigger = overlay.locator("[part~='trigger']")
    const content = overlay.locator("[part~='content']")
    await trigger.focus()
    await expect(content).toBeVisible()
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
        ),
    )
    await page.keyboard.press("Escape")
    await expect(content).toBeHidden()
  })
}

for (const tag of ["naos-tooltip", "naos-hover-card"]) {
  test(`${tag} opens on pointer hover and respects disabled`, async ({ page }) => {
    await page.goto("/")
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.evaluate((name) => {
      const element = document.createElement(name)
      element.id = "hover-overlay"
      element.textContent = "Description"
      document.body.append(element)
    }, tag)
    const overlay = page.locator("#hover-overlay")
    const trigger = overlay.locator("[part~='trigger']")
    const content = overlay.locator("[part~='content']")
    await trigger.hover()
    await expect(content).toBeVisible()
    await page.mouse.move(600, 600)
    await expect(content).toBeHidden()
    await overlay.evaluate((element) => element.setAttribute("disabled", ""))
    await expect(trigger).toBeDisabled()
    await trigger.dispatchEvent("pointerenter", { pointerType: "mouse" })
    await expect(content).toBeHidden()
  })
}

for (const tag of ["naos-tooltip", "naos-hover-card"]) {
  test(`${tag} preserves initial open and reconnect`, async ({ page }) => {
    await page.goto("/")
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.evaluate((name) => {
      const element = document.createElement(name)
      element.id = "hover-overlay"
      element.setAttribute("open", "")
      document.body.append(element)
    }, tag)
    const overlay = page.locator("#hover-overlay")
    const content = overlay.locator("[part~='content']")
    await expect(content).toBeVisible()
    await overlay.evaluate((element) => {
      const parent = element.parentElement!
      element.remove()
      parent.append(element)
    })
    await expect(content).toBeVisible()
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
        ),
    )
    await page.keyboard.press("Escape")
    await expect(content).toBeHidden()
  })
}
