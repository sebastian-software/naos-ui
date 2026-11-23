import { expect, test } from "@playwright/test"

for (const tag of ["naos-menu", "naos-context-menu"]) {
  test(`${tag} keeps authored items, keyboard selection and reconnect`, async ({ page }) => {
    await page.goto("/")
    await page.evaluate((name) => {
      const element = document.createElement(name) as HTMLElement & { selections: string[] }
      element.id = "migration-menu"
      element.innerHTML = `<naos-menu-item value="one"><strong>First</strong></naos-menu-item><naos-menu-item value="skip" disabled>Skip</naos-menu-item><naos-menu-item value="two">Second</naos-menu-item>`
      element.selections = []
      element.addEventListener("naos-select", (event) =>
        element.selections.push((event as CustomEvent<{ value: string }>).detail.value),
      )
      document.body.append(element)
    }, tag)
    const menu = page.locator("#migration-menu")
    const trigger = menu.locator("[part~='trigger']")
    const content = menu.locator("[part~='content']")
    if (tag === "naos-menu") await trigger.click()
    else await trigger.click({ button: "right" })
    await expect(content).toBeVisible()
    await expect(menu.locator("naos-menu-item").first()).toHaveAttribute("role", "menuitem")
    await expect(menu.locator("naos-menu-item strong")).toHaveText("First")
    await content.press("ArrowDown")
    await content.press("Enter")
    await expect(content).toBeHidden()
    expect(
      await menu.evaluate(
        (element) => (element as HTMLElement & { selections: string[] }).selections,
      ),
    ).toEqual(["one"])
    await menu.evaluate((element) => {
      const parent = element.parentElement!
      element.remove()
      parent.append(element)
    })
    if (tag === "naos-menu") await trigger.click()
    else await trigger.click({ button: "right" })
    await expect(content).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(content).toBeHidden()
  })
}

test("menu reacts to dynamic items and disabled changes", async ({ page }) => {
  await page.goto("/")
  await page.evaluate(() => {
    const menu = document.createElement("naos-menu") as HTMLElement & { selections: string[] }
    menu.id = "dynamic-menu"
    menu.innerHTML = `<naos-menu-item value="first">First</naos-menu-item>`
    menu.selections = []
    menu.addEventListener("naos-select", (event) =>
      menu.selections.push((event as CustomEvent<{ value: string }>).detail.value),
    )
    document.body.append(menu)
  })
  const menu = page.locator("#dynamic-menu")
  const trigger = menu.locator("[part~='trigger']")
  const content = menu.locator("[part~='content']")
  await menu.evaluate((element) =>
    element.insertAdjacentHTML(
      "beforeend",
      '<naos-menu-item value="second">Second</naos-menu-item>',
    ),
  )
  await trigger.click()
  await menu.locator('naos-menu-item[value="second"]').click()
  expect(
    await menu.evaluate(
      (element) => (element as HTMLElement & { selections: string[] }).selections,
    ),
  ).toEqual(["second"])
  await expect(content).toBeHidden()
  await menu.evaluate((element) => element.setAttribute("disabled", ""))
  await expect(trigger).toBeDisabled()
  await expect(menu.locator("naos-menu-item").first()).toHaveAttribute("aria-disabled", "true")
  await menu.evaluate((element) => element.removeAttribute("disabled"))
  await expect(trigger).toBeEnabled()
  await trigger.click()
  await expect(content).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(content).toBeHidden()
})
