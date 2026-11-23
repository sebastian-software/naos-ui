import { expect, test } from "@playwright/test"

test("select tracks rich option edits, skips disabled options and releases its layer", async ({
  page,
}) => {
  await page.goto("/primitive-migration.html")
  const select = page.locator("naos-select")
  const trigger = select.getByRole("combobox")
  await select.evaluate((element) => {
    const item = document.createElement("naos-select-item")
    item.setAttribute("value", "ie")
    item.innerHTML = "<strong>Ireland</strong>"
    element.append(item)
  })
  await trigger.focus()
  await trigger.press("i")
  await expect(trigger).toContainText("Ireland")
  await select
    .locator("strong")
    .filter({ hasText: "Ireland" })
    .evaluate((el) => {
      el.textContent = "Éire"
    })
  await expect(trigger).toContainText("Éire")
  await trigger.press("Space")
  await trigger.press("End")
  await trigger.press("Enter")
  await expect(trigger).toBeFocused()
  await trigger.press("Space")
  await select.evaluate((el) => {
    const parent = el.parentElement!
    el.remove()
    parent.append(el)
  })
  await expect(trigger).toHaveAttribute("aria-expanded", "false")
  await trigger.click()
  await trigger.press("Escape")
  await expect(trigger).toHaveAttribute("aria-expanded", "false")
})

test("file upload rejects mismatched types, submits File objects, removes and resets", async ({
  page,
}) => {
  await page.goto("/")
  const form = page.locator("#migration-files")
  await page.evaluate(() => {
    const form = document.createElement("form")
    form.id = "migration-files"
    form.innerHTML =
      '<naos-file-upload multiple max-files="2" accept=".txt" name="attachments"></naos-file-upload>'
    document.body.prepend(form)
  })
  const picker = form.locator("input[type=file]")
  const selection = [
    { name: "a.txt", mimeType: "text/plain", buffer: Buffer.from("a") },
    { name: "b.png", mimeType: "image/png", buffer: Buffer.from("b") },
  ]
  await picker.setInputFiles(selection)
  await expect(form.locator("[part=item-name]")).toHaveText("a.txt")
  await expect(form.locator("[part=rejected]")).toHaveText("b.png")
  const submitted = () =>
    form.evaluate((element: HTMLFormElement) =>
      new FormData(element)
        .getAll("attachments")
        .map((file) => (file instanceof File ? file.name : file)),
    )
  await expect.poll(submitted).toEqual(["a.txt"])
  await form.locator("[part=item-delete]").click()
  await expect.poll(submitted).toEqual([])
  await picker.setInputFiles(selection[0]!)
  await form.evaluate((el: HTMLFormElement) => el.reset())
  await expect.poll(submitted).toEqual([])
  await expect(form.locator("[part=item-name]")).toHaveCount(0)
})
