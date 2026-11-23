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

for (const tag of ["naos-tooltip", "naos-hover-card"]) {
  test(`${tag} delays and cancels pointer and focus transitions`, async ({ page }) => {
    await page.goto("/")
    await page.mouse.move(0, 0)
    await page.clock.install()
    await page.clock.pauseAt(Date.now())
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.evaluate((name) => {
      const element = document.createElement(name) as HTMLElement & { changes: boolean[] }
      element.id = "delayed-hover"
      element.setAttribute("open-delay", "200")
      element.setAttribute("close-delay", "200")
      element.changes = []
      element.addEventListener("naos-open-change", (event) => {
        element.changes.push((event as CustomEvent<{ open: boolean }>).detail.open)
      })
      document.body.append(element)
    }, tag)
    const overlay = page.locator("#delayed-hover")
    const trigger = overlay.locator("[part~='trigger']")
    const content = overlay.locator("[part~='content']")
    const changes = () =>
      overlay.evaluate((el) => (el as HTMLElement & { changes: boolean[] }).changes)
    await trigger.dispatchEvent("pointerenter", { pointerType: "mouse" })
    await page.clock.runFor(50)
    await trigger.dispatchEvent("pointerleave", { pointerType: "mouse" })
    await page.clock.runFor(250)
    await expect(content).toBeHidden()
    expect(await changes()).toEqual([])
    await trigger.focus()
    await page.clock.runFor(50)
    await expect(content).toBeHidden()
    await page.clock.runFor(150)
    await expect(content).toBeVisible()
    expect(await changes()).toEqual([true])
    await trigger.evaluate((el: HTMLElement) => el.blur())
    await page.clock.runFor(50)
    await expect(content).toBeVisible()
    await trigger.focus()
    await page.clock.runFor(250)
    await expect(content).toBeVisible()
    expect(await changes()).toEqual([true])
    await trigger.evaluate((el: HTMLElement) => el.blur())
    await page.clock.runFor(200)
    // Allow the presence exit frame scheduled by the close update to run.
    await page.clock.runFor(100)
    await expect(content).toBeHidden()
    expect(await changes()).toEqual([true, false])
    await trigger.dispatchEvent("pointerenter", { pointerType: "mouse" })
    await overlay.evaluate((el) => {
      ;(window as unknown as { removedHover: Element }).removedHover = el
      el.remove()
    })
    await page.clock.runFor(250)
    expect(
      await page.evaluate(
        () =>
          (window as unknown as { removedHover: HTMLElement & { changes: boolean[] } }).removedHover
            .changes,
      ),
    ).toEqual([true, false])
  })
}
