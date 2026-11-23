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
    const menu = Object.assign(document.createElement("naos-menu"), { selections: Array<string>() })
    menu.id = "dynamic-menu"
    menu.innerHTML = `<naos-menu-item value="first">First</naos-menu-item>`
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

test("context menu opens from the keyboard", async ({ page }) => {
  await page.goto("/")
  await page.evaluate(() => {
    const menu = document.createElement("naos-context-menu")
    menu.id = "keyboard-context"
    menu.innerHTML = '<naos-menu-item value="copy">Copy</naos-menu-item>'
    document.body.append(menu)
  })
  const trigger = page.locator("#keyboard-context [part~='trigger']")
  const content = page.locator("#keyboard-context [part~='content']")
  await trigger.focus()
  await page.keyboard.press("Shift+F10")
  await expect(content).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(content).toBeHidden()
  await expect(trigger).toBeFocused()
})

for (const tag of ["naos-menu", "naos-context-menu"]) {
  test(`${tag} supports checked items with pointer and keyboard`, async ({ page }) => {
    await page.goto("/")
    await page.evaluate((name) => {
      const menu = Object.assign(document.createElement(name), { events: [] as unknown[] })
      menu.id = "checked-menu"
      menu.innerHTML = `<naos-menu-item type="checkbox" value="grid">Grid</naos-menu-item>
        <naos-menu-item type="checkbox" value="disabled" disabled>Disabled</naos-menu-item>
        <naos-menu-item type="radio" name="size" value="small" checked>Small</naos-menu-item>
        <naos-menu-item type="radio" name="size" value="large">Large</naos-menu-item>
        <naos-menu-item type="radio" name="other" value="other" checked>Other</naos-menu-item>
        <naos-menu-item value="action">Action</naos-menu-item>`
      for (const event of ["naos-select", "naos-checked-change"]) {
        menu.addEventListener(event, (e) =>
          menu.events.push({ type: e.type, detail: (e as CustomEvent).detail }),
        )
      }
      document.body.append(menu)
    }, tag)
    const menu = page.locator("#checked-menu")
    const trigger = menu.locator("[part~='trigger']")
    const content = menu.locator("[part~='content']")
    const item = (value: string) => menu.locator(`naos-menu-item[value="${value}"]`)
    if (tag === "naos-menu") await trigger.click()
    else await trigger.click({ button: "right" })
    await expect(item("grid")).toHaveAttribute("role", "menuitemcheckbox")
    await expect(item("small")).toHaveAttribute("role", "menuitemradio")
    await expect(item("grid")).toHaveAttribute("aria-checked", "false")
    await item("grid").click()
    await expect(item("grid")).toHaveAttribute("aria-checked", "true")
    await expect(content).toBeVisible()
    await item("disabled").click({ force: true })
    await expect(item("disabled")).toHaveAttribute("aria-checked", "false")
    await item("large").click()
    await expect(item("small")).toHaveAttribute("aria-checked", "false")
    await expect(item("large")).toHaveAttribute("aria-checked", "true")
    await expect(item("other")).toHaveAttribute("aria-checked", "true")
    await content.press("Home")
    await content.press("Space")
    await expect(item("grid")).toHaveAttribute("aria-checked", "false")
    await content.press("ArrowDown")
    await content.press("Enter")
    await expect(item("small")).toHaveAttribute("aria-checked", "true")
    await expect(item("large")).toHaveAttribute("aria-checked", "false")
    await item("action").click()
    await expect(content).toBeHidden()
    expect(await menu.evaluate((el) => (el as HTMLElement & { events: unknown[] }).events)).toEqual(
      [
        { type: "naos-checked-change", detail: { value: "grid", checked: true } },
        { type: "naos-checked-change", detail: { value: "large", checked: true } },
        { type: "naos-checked-change", detail: { value: "grid", checked: false } },
        { type: "naos-checked-change", detail: { value: "small", checked: true } },
        { type: "naos-select", detail: { value: "action" } },
      ],
    )
  })
}

test("radio groups reconcile authored and programmatic checked state", async ({ page }) => {
  await page.goto("/")
  await page.evaluate(() => {
    const menu = Object.assign(document.createElement("naos-menu"), { changes: 0 })
    menu.id = "radio-reconcile"
    menu.innerHTML = `<naos-menu-item type="radio" name="a" value="one" checked>One</naos-menu-item>
      <naos-menu-item type="radio" name="a" value="two" checked>Two</naos-menu-item>
      <naos-menu-item type="radio" name="b" value="three" checked>Three</naos-menu-item>`
    menu.addEventListener("naos-checked-change", () => menu.changes++)
    document.body.append(menu)
  })
  const menu = page.locator("#radio-reconcile")
  const item = (value: string) => menu.locator(`naos-menu-item[value="${value}"]`)
  await expect(item("one")).toHaveAttribute("aria-checked", "true")
  await expect(item("two")).toHaveAttribute("aria-checked", "false")
  await item("two").evaluate((el) => ((el as HTMLElement & { checked: boolean }).checked = true))
  await expect(item("one")).toHaveAttribute("aria-checked", "false")
  await expect(item("two")).toHaveAttribute("aria-checked", "true")
  await item("three").evaluate((el) => el.setAttribute("name", "a"))
  await expect(item("two")).toHaveAttribute("aria-checked", "false")
  await expect(item("three")).toHaveAttribute("aria-checked", "true")
  await menu.evaluate((el) =>
    el.insertAdjacentHTML(
      "beforeend",
      '<naos-menu-item type="radio" name="a" value="four" checked>Four</naos-menu-item>',
    ),
  )
  await expect(item("three")).toHaveAttribute("aria-checked", "false")
  await expect(item("four")).toHaveAttribute("aria-checked", "true")
  await menu.locator("[part~='trigger']").click()
  await item("four").click()
  expect(await menu.evaluate((el) => (el as HTMLElement & { changes: number }).changes)).toBe(0)
})
