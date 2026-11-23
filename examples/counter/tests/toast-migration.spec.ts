import { expect, test } from "@playwright/test"

test("toast creation, status, close, timeout, pause and reconnect", async ({ page }) => {
  await page.goto("/")
  await page.evaluate(() => {
    document.querySelectorAll("naos-toast-root").forEach((root) => root.remove())
    const area = document.createElement("div")
    area.id = "toast-regression"
    area.innerHTML = `<naos-toast-root label="Test notifications"></naos-toast-root>
      <naos-toast label="Open" title="First" description="Details" type="success" duration="60000"></naos-toast>
      <naos-toast label="Timed" title="Timed" duration="600"></naos-toast>
      <naos-toast label="Locked" title="Locked" duration="60000"></naos-toast>`
    ;(area.querySelectorAll("naos-toast")[2] as HTMLElement & { closable: boolean }).closable =
      false
    document.body.append(area)
    const root = area.querySelector("naos-toast-root")!
    ;(window as unknown as { toastStatuses: string[] }).toastStatuses = []
    root.addEventListener("naos-status-change", (event) => {
      ;(window as unknown as { toastStatuses: string[] }).toastStatuses.push(
        (event as CustomEvent).detail.status,
      )
    })
  })
  const area = page.locator("#toast-regression")
  const root = area.locator("naos-toast-root")
  const region = root.locator('[part~="root"]')
  const toasts = root.locator('[part~="toast"]')
  await area.locator("naos-toast").nth(0).locator("button").click()
  await expect(region).toHaveAttribute("data-count", "1")
  await expect(toasts).toHaveCount(1)
  await expect(toasts.first()).toHaveAttribute("data-type", "success")
  await expect(toasts.first().locator('[part~="title"]')).toHaveText("First")
  await expect(toasts.first().locator('[part~="description"]')).toHaveText("Details")
  await toasts.first().locator('[part~="close"]').click()
  await expect(region).toHaveAttribute("data-count", "0")
  const statuses = await page.evaluate(
    () => (window as unknown as { toastStatuses: string[] }).toastStatuses,
  )
  expect(statuses).toEqual(["visible", "dismissing", "unmounted"])
  await area.locator("naos-toast").nth(2).locator("button").click()
  await expect(region).toHaveAttribute("data-count", "1")
  await expect(toasts.first().locator('[part~="close"]')).toBeHidden()
  await area.locator("naos-toast").nth(1).locator("button").click()
  await expect(region).toHaveAttribute("data-count", "2")
  const timed = toasts.filter({ hasText: "Timed" })
  await timed.hover()
  await page.waitForTimeout(900)
  await expect(timed).toBeVisible()
  await timed.locator('[part~="close"]').focus()
  await page.mouse.move(0, 0)
  await page.waitForTimeout(900)
  await expect(timed).toBeVisible()
  await area.locator("naos-toast").nth(0).locator("button").focus()
  await expect(region).toHaveAttribute("data-count", "1", { timeout: 3000 })
  await expect(timed).toHaveCount(0, { timeout: 3000 })
  await expect(region).toHaveAttribute("data-count", "1")
  await root.evaluate((element) => {
    element.remove()
    document.querySelector("#toast-regression")?.append(element)
  })
  await expect(region).toHaveAttribute("data-count", "1")
  await expect(toasts).toHaveCount(1)
})
