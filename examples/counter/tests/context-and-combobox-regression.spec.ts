import { expect, test } from "@playwright/test"

test("context menu leaves a closed editable trigger's keys native", async ({ page }) => {
  await page.goto("/")
  await page.evaluate(() => {
    document.body.insertAdjacentHTML(
      "afterbegin",
      `<naos-context-menu id="editable-context">
        <input slot="trigger" aria-label="Editable trigger" value="notes">
        <naos-menu-item value="copy">Copy</naos-menu-item>
      </naos-context-menu>`,
    )
    const context = document.querySelector("#editable-context")!
    const keys: Array<[string, boolean]> = []
    context.addEventListener("keydown", (event) => {
      if (!(event instanceof KeyboardEvent)) return
      keys.push([event.key, event.defaultPrevented])
      context.setAttribute("data-key-log", JSON.stringify(keys))
    })
  })
  const context = page.locator("#editable-context")
  const input = context.getByRole("textbox", { name: "Editable trigger" })
  const menu = context.getByRole("menu")
  await input.press("End")
  await input.evaluate((node: HTMLInputElement) => node.setSelectionRange(5, 5))
  await input.press("Space")
  await expect(input).toHaveValue("notes ")
  await input.press("Home")
  await input.press("ArrowDown")
  await input.press("Enter")
  await expect(context).toHaveAttribute(
    "data-key-log",
    '[["End",false],[" ",false],["Home",false],["ArrowDown",false],["Enter",false]]',
  )
  await expect(menu).toBeHidden()
  await input.press("Shift+F10")
  await expect(menu).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(menu).toBeHidden()
})

test("a real context click anchors the menu at the pointer", async ({ page }) => {
  await page.goto("/")
  await page.evaluate(() => {
    document.body.insertAdjacentHTML(
      "afterbegin",
      `<naos-context-menu id="pointer-context" style="position:fixed;left:48px;top:48px;width:520px;z-index:1000">
        <span slot="trigger">Right click area</span>
        <naos-menu-item value="copy">Copy</naos-menu-item>
      </naos-context-menu>`,
    )
  })
  const context = page.locator("#pointer-context")
  const trigger = context.locator("[part~='trigger']")
  const menu = context.getByRole("menu")
  const triggerBox = await trigger.boundingBox()
  if (!triggerBox) throw new Error("Missing context trigger")
  const x = triggerBox.x + 250
  const y = triggerBox.y + 20
  await page.mouse.click(x, y, { button: "right" })
  await expect(menu).toBeVisible()
  await expect.poll(async () => Math.abs((await menu.boundingBox())!.x - x)).toBeLessThan(3)
  await expect.poll(async () => Math.abs((await menu.boundingBox())!.y - y)).toBeLessThan(12)
})

for (const dismiss of ["Tab", "Escape", "outside"] as const) {
  test(`combobox reverts unmatched input and emits the restored value on ${dismiss}`, async ({
    page,
  }) => {
    await page.goto("/")
    await page.evaluate(() => {
      document.body.insertAdjacentHTML(
        "afterbegin",
        `<naos-combobox id="revert-combo" label="Team" value="docs">
          <naos-combobox-item value="docs" label="Docs team">Docs team</naos-combobox-item>
          <naos-combobox-item value="ops" label="Operations">Operations</naos-combobox-item>
        </naos-combobox>
        <button id="combo-outside" type="button" style="position:fixed;right:24px;top:24px">Outside the combobox</button>`,
      )
      const combo = document.querySelector("#revert-combo")!
      const values: string[] = []
      combo.addEventListener("naos-input", (event) => {
        values.push((event as CustomEvent<{ inputValue: string }>).detail.inputValue)
        combo.setAttribute("data-input-log", JSON.stringify(values))
      })
    })
    const combo = page.locator("#revert-combo")
    const input = combo.getByRole("combobox", { name: "Team" })
    await expect(input).toHaveValue("Docs team")
    await input.fill("missing team")
    await expect(input).toHaveAttribute("aria-expanded", "true")
    if (dismiss === "outside") await page.locator("#combo-outside").click()
    else await input.press(dismiss)
    await expect(input).toHaveAttribute("aria-expanded", "false")
    await expect(input).toHaveValue("Docs team")
    await expect(combo).toHaveAttribute("data-input-log", '["missing team","Docs team"]')
    if (dismiss === "Tab") await expect(combo.locator("[part~='trigger']")).not.toBeFocused()
  })
}

test("closed Select ArrowDown starts on its selected option", async ({ page }) => {
  await page.goto("/primitive-migration.html")
  const trigger = page.getByRole("combobox", { name: "Region" })
  await trigger.press("ArrowDown")
  const europe = page.locator('naos-select-item[value="eu"]')
  const northAmerica = page.locator('naos-select-item[value="na"]')
  await expect(europe).toHaveAttribute("data-highlighted", "")
  await expect(northAmerica).not.toHaveAttribute("data-highlighted")
})
