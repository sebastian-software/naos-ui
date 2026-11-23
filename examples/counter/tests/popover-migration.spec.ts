import { expect, test } from "@playwright/test"

test("popover isolates nested dismissal and reconnects while open", async ({ page }) => {
  await page.goto("/")
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.evaluate(() => {
    const container = document.createElement("div")
    container.innerHTML = `<naos-popover id="overlay-parent" modal><naos-popover id="overlay-child">Child content</naos-popover></naos-popover>`
    document.body.append(container)
    for (const element of container.querySelectorAll("naos-popover")) {
      ;(element as unknown as HTMLElement & { changes: boolean[] }).changes = []
      element.addEventListener("naos-open-change", (event) => {
        if (event.target === element) {
          ;(element as unknown as HTMLElement & { changes: boolean[] }).changes.push(
            (event as CustomEvent<{ open: boolean }>).detail.open,
          )
        }
      })
    }
  })
  const parent = page.locator("#overlay-parent")
  const child = page.locator("#overlay-child")
  const parentTrigger = parent.locator("[part~='trigger']").first()
  const childTrigger = child.locator("[part~='trigger']").first()
  const parentContent = parent.locator("[part~='content']").first()
  const childContent = child.locator("[part~='content']").first()
  const changes = (locator: typeof parent) =>
    locator.evaluate(
      (element) => (element as unknown as HTMLElement & { changes: boolean[] }).changes,
    )

  await parentTrigger.click()
  await childTrigger.click()
  await expect(childContent).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(childContent).toBeHidden()
  await expect(parentContent).toBeVisible()
  expect(await changes(parent)).toEqual([true])
  expect(await changes(child)).toEqual([true, false])
  await page.keyboard.press("Escape")
  await expect(parentContent).toBeHidden()
  await expect(parentTrigger).toBeFocused()
  expect(await changes(parent)).toEqual([true, false])

  await parentTrigger.click()
  await expect(parentContent).toBeVisible()
  await parent.evaluate((element) => {
    const container = element.parentElement!
    element.remove()
    container.append(element)
  })
  await parentTrigger.click()
  await page.keyboard.press("Escape")
  await expect(parentContent).toBeHidden()
})

test("initially open popover restores focus after outside press", async ({ page }) => {
  await page.goto("/")
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.evaluate(() => {
    const outside = document.createElement("button")
    outside.id = "overlay-outside"
    outside.textContent = "Outside"
    const popover = document.createElement("naos-popover")
    popover.id = "initial-overlay"
    popover.setAttribute("open", "")
    document.body.append(outside, popover)
  })
  const popover = page.locator("#initial-overlay")
  const content = popover.locator("[part~='content']")
  const trigger = popover.locator("[part~='trigger']")
  await expect(content).toBeVisible()
  await page.locator("#overlay-outside").click()
  await expect(content).toBeHidden()
  await expect(trigger).toBeFocused()
})
