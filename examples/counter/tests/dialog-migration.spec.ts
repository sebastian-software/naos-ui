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

test("alert dialog names and describes its prompt, focuses cancel and restores nested focus", async ({
  page,
}) => {
  await page.goto("/")
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.evaluate(() => {
    const outer = document.createElement("naos-dialog")
    outer.id = "outer-dialog"
    outer.innerHTML = `<naos-dialog id="alert-dialog" alert title="Delete project?" description="This cannot be undone."><span slot="trigger">Delete</span><span slot="close">Cancel</span><button slot="actions" id="confirm">Delete project</button></naos-dialog>`
    document.body.append(outer)
  })
  const outer = page.locator("#outer-dialog")
  const alert = page.locator("#alert-dialog")
  const outerTrigger = outer.locator("[part~='trigger']").first()
  await outerTrigger.click()
  const trigger = alert.locator("[part~='trigger']")
  await trigger.click()
  const content = alert.locator("[part~='content']")
  const cancel = alert.locator("[part~='close']")
  await expect(content).toHaveRole("alertdialog")
  await expect(content).toHaveAccessibleName("Delete project?")
  await expect(content).toHaveAccessibleDescription("This cannot be undone.")
  await expect(cancel).toBeFocused()
  await page.keyboard.press("Tab")
  await expect(alert.locator("#confirm")).toBeFocused()
  await page.keyboard.press("Shift+Tab")
  await expect(cancel).toBeFocused()
  await page.mouse.click(2, 2)
  await page.waitForTimeout(100)
  await expect(content).toBeVisible()
  await expect(outer.locator("[part~=content]").first()).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(content).toBeHidden()
  await expect(trigger).toBeFocused()
  await page.keyboard.press("Escape")
  await expect(outerTrigger).toBeFocused()
})

test("alert dialog ignores outside presses", async ({ page }) => {
  await page.goto("/")
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.evaluate(() => {
    const dialog = document.createElement("naos-dialog")
    dialog.id = "outside-alert"
    dialog.setAttribute("alert", "")
    document.body.append(dialog)
  })
  const dialog = page.locator("#outside-alert")
  await dialog.locator("[part~='trigger']").click()
  const content = dialog.locator("[part~='content']")
  await expect(content).toBeVisible()
  await page.mouse.click(2, 2)
  await expect(content).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(content).toBeHidden()
})

test("initially open alert reconnects and can return to ordinary dialog semantics", async ({
  page,
}) => {
  await page.goto("/")
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.evaluate(() => {
    const dialog = document.createElement("naos-dialog")
    dialog.id = "initial-alert"
    dialog.setAttribute("alert", "")
    dialog.setAttribute("open", "")
    document.body.append(dialog)
  })
  const dialog = page.locator("#initial-alert")
  const content = dialog.locator("[part~='content']")
  const cancel = dialog.locator("[part~='close']")
  await expect(content).toHaveRole("alertdialog")
  await expect(cancel).toBeFocused()
  await dialog.evaluate((el) => {
    const parent = el.parentElement!
    el.remove()
    parent.append(el)
  })
  await expect(content).toBeVisible()
  await expect(cancel).toBeFocused()
  await dialog.evaluate((el) => el.removeAttribute("alert"))
  await expect(content).toHaveRole("dialog")
})

test("removing an open nested dialog leaves ordinary outside dismissal enabled", async ({
  page,
}) => {
  await page.goto("/")
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.evaluate(() => {
    const outer = document.createElement("naos-dialog")
    outer.id = "remove-outer"
    outer.innerHTML = '<naos-dialog id="remove-inner" alert></naos-dialog>'
    document.body.append(outer)
  })
  const outer = page.locator("#remove-outer")
  const inner = page.locator("#remove-inner")
  await outer.locator("[part~='trigger']").first().click()
  await inner.locator("[part~='trigger']").click()
  await expect(inner.locator("[part~='content']")).toBeVisible()
  await inner.evaluate((el) => el.remove())
  await page.mouse.click(2, 2)
  await expect(outer.locator("[part~='content']")).toBeHidden()
})
