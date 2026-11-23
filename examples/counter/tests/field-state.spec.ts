import { expect, test } from "@playwright/test"

test("a profile field distinguishes edits, blur, local validation, server errors and reset", async ({
  page,
}) => {
  await page.goto("/field-state.html")
  const form = page.locator("#profile")
  const name = form.getByRole("textbox", { name: "Display name" })
  const field = form.locator("#name-field")
  const checkbox = form.getByRole("checkbox", { name: "Receive updates" })
  const updates = form.locator("naos-checkbox")
  const save = form.getByRole("button", { name: "Save profile" })
  let requests = 0
  await page.route("**/api/profile", (route) => {
    requests++
    return route.fulfill({ status: 422, json: { name: "That name is taken." } })
  })

  await expect(name).toHaveAccessibleDescription("Choose a public name.")
  await expect(field).toHaveAttribute("data-touched", "false")
  await name.fill("")
  await expect(field).toHaveAttribute("data-dirty", "true")
  await expect(name).toHaveAttribute("aria-invalid", "false")
  await save.click()
  await expect(name).toHaveAttribute("aria-invalid", "true")
  await expect(name).toHaveAccessibleDescription(
    await name.evaluate((node: HTMLInputElement) => node.validationMessage),
  )
  expect(requests).toBe(0)

  await name.fill("Ada")
  await expect(field).toHaveAttribute("data-dirty", "false")
  await save.click()
  await expect(name).toHaveAccessibleDescription("That name is taken.")
  await save.click()
  await expect.poll(() => requests).toBe(2)
  await expect(name).toHaveAccessibleDescription("That name is taken.")
  await name.fill("Grace")
  await expect(name).toHaveAttribute("aria-invalid", "false")
  await expect(name).toHaveAccessibleDescription("Choose a public name.")

  await checkbox.focus()
  await checkbox.click()
  await expect(updates).toHaveAttribute("data-dirty", "true")
  await save.focus()
  await expect(updates).toHaveAttribute("data-touched", "true")
  const reset = form.getByRole("button", { name: "Reset profile" })
  await form.evaluate((el) =>
    el.addEventListener("reset", (event) => event.preventDefault(), { once: true }),
  )
  await reset.click()
  await expect(name).toHaveValue("Grace")
  await expect(field).toHaveAttribute("data-dirty", "true")
  await reset.click()
  await expect(name).toHaveValue("Ada")
  await expect(checkbox).toBeChecked()
  for (const control of [field, updates]) {
    await expect(control).toHaveAttribute("data-touched", "false")
    await expect(control).toHaveAttribute("data-dirty", "false")
  }
})

test("late field errors do not reappear after editing back to the submitted value", async ({
  page,
}) => {
  await page.goto("/field-state.html")
  const form = page.locator("#profile")
  const name = form.getByRole("textbox", { name: "Display name" })
  let finishResponse!: () => void
  const response = new Promise<void>((resolve) => {
    finishResponse = resolve
  })
  await page.route("**/api/profile", async (route) => {
    await response
    await route.fulfill({ status: 422, json: { name: "Obsolete error" } })
  })
  await form.getByRole("button", { name: "Save profile" }).click()
  await expect(form).toHaveAttribute("aria-busy", "true")
  await name.fill("Grace")
  await name.fill("Ada")
  finishResponse()
  await expect(form).toHaveAttribute("aria-busy", "false")
  await expect(name).toHaveAttribute("aria-invalid", "false")
  await expect(name).toHaveAccessibleDescription("Choose a public name.")
})
