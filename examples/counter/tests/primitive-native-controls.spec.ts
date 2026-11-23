import { expect, test } from "@playwright/test"

test("feedback parts expose image fallback and determinate state", async ({ page }) => {
  await page.goto("/")
  await page.evaluate(() => {
    document.body.insertAdjacentHTML(
      "afterbegin",
      `
      <section id="feedback-probe">
        <naos-avatar alt="Ada" fallback="AL"></naos-avatar>
        <naos-progress label="Import" min="20" max="70" value="45" orientation="vertical"></naos-progress>
      </section>
    `,
    )
  })
  const probe = page.locator("#feedback-probe")
  const avatar = probe.locator("naos-avatar")
  const fallback = avatar.locator("[part~='fallback']")
  await expect(fallback).toBeVisible()
  await expect(fallback).toHaveText("AL")
  await avatar.evaluate((element) => {
    element.setAttribute(
      "src",
      `data:image/svg+xml,${encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
      )}`,
    )
  })
  await expect(avatar.getByRole("img", { name: "Ada" })).toBeVisible()
  await expect(fallback).toBeHidden()
  await avatar.evaluate((element) => element.setAttribute("src", "data:image/png,broken"))
  await expect(fallback).toBeVisible()

  const progress = probe.locator("naos-progress")
  const progressbar = progress.getByRole("progressbar")
  await expect(progressbar).toHaveAccessibleName("Import: 50%")
  await expect(progressbar).toHaveAttribute("aria-valuenow", "45")
  await expect(progress.locator("[part~='range']")).toHaveAttribute("style", /height:\s*50%/)
  await progress.evaluate((element) => element.setAttribute("indeterminate", ""))
  await expect(progressbar).toHaveAccessibleName("Import: in progress")
  await expect(progressbar).not.toHaveAttribute("aria-valuenow")
})

test("disclosure and toggle keep native activation, disabled state, and form reset", async ({
  page,
}) => {
  await page.goto("/")
  await page.evaluate(() => {
    document.body.insertAdjacentHTML(
      "afterbegin",
      `
      <form id="controls-probe">
        <naos-collapsible disabled>
          <span slot="trigger">Reveal notes</span>
          <p>Secret notes</p>
        </naos-collapsible>
        <naos-toggle name="choice" value="yes" label="Allow choice"></naos-toggle>
      </form>
    `,
    )
  })
  const form = page.locator("#controls-probe")
  const disclosure = form.getByRole("button", { name: "Reveal notes" })
  await expect(disclosure).toBeDisabled()
  await disclosure.evaluate((button: HTMLButtonElement) => button.click())
  await expect(disclosure).toHaveAttribute("aria-expanded", "false")
  await form.locator("naos-collapsible").evaluate((element) => element.removeAttribute("disabled"))
  await disclosure.press("Space")
  await expect(disclosure).toHaveAttribute("aria-expanded", "true")
  await expect(form.getByText("Secret notes")).toBeVisible()

  const button = form.getByRole("button", { name: /Allow choice/ })
  await button.press("Space")
  await expect(button).toHaveAttribute("aria-pressed", "true")
  const entries = () =>
    form.evaluate((element: HTMLFormElement) => new FormData(element).getAll("choice"))
  await expect.poll(entries).toEqual(["yes"])
  await form.evaluate((element: HTMLFormElement) => element.reset())
  await expect(button).toHaveAttribute("aria-pressed", "false")
  await expect.poll(entries).toEqual([])
})

test("legacy tabs still switch their named panels with arrows and wrap", async ({ page }) => {
  await page.goto("/")
  await page.evaluate(() => {
    document.body.insertAdjacentHTML(
      "afterbegin",
      `
      <naos-tabs id="legacy-tabs" first-label="Overview" second-label="Details" third-label="Results">
        <p slot="first">Overview panel</p>
        <p slot="second">Details panel</p>
        <p slot="third">Results panel</p>
      </naos-tabs>
    `,
    )
  })
  const tabs = page.locator("#legacy-tabs")
  const overview = tabs.getByRole("tab", { name: "Overview" })
  const results = tabs.getByRole("tab", { name: "Results" })
  await expect(overview).toHaveAttribute("aria-selected", "true")
  await overview.press("ArrowLeft")
  await expect(results).toHaveAttribute("aria-selected", "true")
  await expect(results).toBeFocused()
  await expect(tabs.getByRole("tabpanel", { name: "Results" })).toBeVisible()
  await expect(tabs.getByText("Results panel", { exact: true })).toBeVisible()
  await results.press("Home")
  await expect(overview).toHaveAttribute("aria-selected", "true")
})

test("editable saves or reverts text and preserves the native form value", async ({ page }) => {
  await page.goto("/")
  await page.evaluate(() => {
    document.body.insertAdjacentHTML(
      "afterbegin",
      `
      <form id="editable-probe"><naos-editable label="Title" name="title" value="Initial"></naos-editable></form>
    `,
    )
  })
  const form = page.locator("#editable-probe")
  const input = form.getByRole("textbox", { name: "Title" })
  await form.getByRole("button", { name: "Edit Title" }).click()
  await expect(input).toBeFocused()
  await input.fill("Draft")
  await input.press("Escape")
  await expect(form.locator("[part~='preview']")).toHaveText("Initial")
  await form.getByRole("button", { name: "Edit Title" }).click()
  await input.fill("Revised")
  await form.getByRole("button", { name: "Save Title" }).click()
  await expect(form.locator("[part~='preview']")).toHaveText("Revised")
  const submitted = () =>
    form.evaluate((element: HTMLFormElement) => new FormData(element).get("title"))
  await expect.poll(submitted).toBe("Revised")
  await form.evaluate((element: HTMLFormElement) => element.reset())
  await expect.poll(submitted).toBe("Initial")
})

test("tags enter, paste, edit, remove, and reset a comma-serialized form value", async ({
  page,
}) => {
  await page.goto("/")
  await page.evaluate(() => {
    document.body.insertAdjacentHTML(
      "afterbegin",
      `
      <form id="tags-probe"><naos-tags-input label="Topics" name="topics" value="initial" delimiter=";"></naos-tags-input></form>
    `,
    )
  })
  const form = page.locator("#tags-probe")
  const tags = form.locator("naos-tags-input")
  const input = tags.locator("[part~='input']")
  await input.fill("draft;")
  await expect(tags.locator("[part~='item']")).toHaveCount(2)
  await input.press("ArrowLeft")
  await input.press("Enter")
  const editor = tags.getByRole("textbox", { name: "Edit tag draft" })
  await expect(editor).toBeFocused()
  await editor.fill("revised")
  await editor.press("Enter")
  await expect(tags.getByText("revised")).toBeVisible()
  await input.evaluate((element: HTMLInputElement) => {
    element.value = "extra;more"
    element.dispatchEvent(new InputEvent("input", { inputType: "insertFromPaste", bubbles: true }))
  })
  const submitted = () =>
    form.evaluate((element: HTMLFormElement) => new FormData(element).get("topics"))
  await expect.poll(submitted).toBe("initial,revised,extra,more")
  await tags.getByRole("button", { name: "Delete tag extra" }).click()
  await expect.poll(submitted).toBe("initial,revised,more")
  await form.evaluate((element: HTMLFormElement) => element.reset())
  await expect.poll(submitted).toBe("initial")
})

test("accordion arrows skip disabled authored items and selection preserves their content", async ({
  page,
}) => {
  await page.goto("/")
  await page.evaluate(() => {
    document.body.insertAdjacentHTML(
      "afterbegin",
      `<naos-accordion id="accordion-probe" value="first">
        <naos-accordion-item value="first" label="First">First contents</naos-accordion-item>
        <naos-accordion-item value="blocked" label="Blocked" disabled>Hidden contents</naos-accordion-item>
        <naos-accordion-item value="last" label="Last"><span slot="trigger">Last section</span>Last contents</naos-accordion-item>
      </naos-accordion>`,
    )
  })
  const accordion = page.locator("#accordion-probe")
  const first = accordion.getByRole("button", { name: "First" })
  const last = accordion.getByRole("button", { name: "Last section" })
  await expect(first).toHaveAttribute("aria-expanded", "true")
  await expect(accordion.getByRole("button", { name: "Blocked" })).toBeDisabled()
  await first.press("ArrowDown")
  await expect(last).toBeFocused()
  await last.press("Space")
  await expect(last).toHaveAttribute("aria-expanded", "true")
  await expect(first).toHaveAttribute("aria-expanded", "false")
  await expect(accordion.getByText("Last contents")).toBeVisible()
})
