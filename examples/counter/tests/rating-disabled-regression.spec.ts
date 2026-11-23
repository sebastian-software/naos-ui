import { expect, test } from "@playwright/test"

test("rating previews and selects cumulative half steps", async ({ page }) => {
  await page.goto("/")
  await page.evaluate(() => {
    const area = document.createElement("div")
    area.id = "rating-disabled-regression"
    area.style.cssText = "position: fixed; top: 0; left: 0; z-index: 99999; background: white"
    area.innerHTML = '<naos-rating-group allow-half value="2.5" label="Rating"></naos-rating-group>'
    document.body.append(area)
    ;(window as unknown as { ratingHover: number[] }).ratingHover = []
    area.addEventListener("naos-hover-change", (event) => {
      ;(window as unknown as { ratingHover: number[] }).ratingHover.push(
        (event as CustomEvent).detail.hoveredValue,
      )
    })
  })
  const rating = page.locator("#rating-disabled-regression naos-rating-group")
  const items = rating.locator('[part~="item"]')
  await expect(items.nth(0)).toHaveAttribute("data-checked", "")
  await expect(items.nth(1)).toHaveAttribute("data-checked", "")
  await expect(items.nth(2)).toHaveAttribute("data-half", "")
  const third = items.nth(2)
  const box = await third.boundingBox()
  if (!box) throw new Error("Rating item is not laid out")
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height / 2)
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height / 2)
  await expect(items.nth(0)).toHaveAttribute("data-highlighted", "")
  await expect(items.nth(2)).toHaveAttribute("data-half", "")
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height / 2)
  await expect(items.nth(2)).toHaveAttribute("data-highlighted", "")
  await expect(items.nth(2)).not.toHaveAttribute("data-half")
  await page.mouse.move(0, 0)
  expect(
    await page.evaluate(() => (window as unknown as { ratingHover: number[] }).ratingHover),
  ).toEqual([2.5, 3, -1])
  await items.nth(3).click({ position: { x: box.width * 0.25, y: box.height / 2 } })
  await expect(rating.locator('[part~="root"]')).toHaveAttribute("data-value", "3.5")
  await expect(items.nth(3)).toHaveAttribute("aria-label", "3.5 of 5")
  await expect(items.nth(3)).toHaveAttribute("data-state", "checked")
  await items.nth(3).press("ArrowLeft")
  await expect(rating.locator('[part~="root"]')).toHaveAttribute("data-value", "3")
  await items.nth(2).press("Home")
  await expect(rating.locator('[part~="root"]')).toHaveAttribute("data-value", "0.5")
  await expect(items.nth(0)).toHaveAttribute("data-half", "")
})

test("fieldset disabled blocks editable and tag interaction until re-enabled", async ({ page }) => {
  await page.goto("/")
  await page.evaluate(() => {
    const form = document.createElement("form")
    form.id = "disabled-edit-regression"
    form.style.cssText = "position: fixed; top: 0; left: 0; z-index: 99999; background: white"
    form.innerHTML =
      '<fieldset disabled><naos-editable value="Original" label="Note"></naos-editable><naos-tags-input value="one,two" label="Tags"></naos-tags-input></fieldset>'
    document.body.append(form)
  })
  const fieldset = page.locator("#disabled-edit-regression fieldset")
  const editable = fieldset.locator("naos-editable")
  const tags = fieldset.locator("naos-tags-input")
  await editable.locator('[part~="label"]').click({ force: true })
  await expect(editable.locator('[part~="root"]')).toHaveAttribute("data-state", "preview")
  await tags.locator('[part~="item-preview"]').first().dblclick({ force: true })
  await expect(tags.locator('[part~="item-input"]').first()).toBeHidden()
  await fieldset.evaluate((element: HTMLFieldSetElement) => {
    element.disabled = false
  })
  await editable.locator('[part~="label"]').click()
  await expect(editable.locator('[part~="root"]')).toHaveAttribute("data-state", "edit")
  await tags.locator('[part~="item-preview"]').first().dblclick()
  await expect(tags.locator('[part~="item-input"]').first()).toBeVisible()
})
