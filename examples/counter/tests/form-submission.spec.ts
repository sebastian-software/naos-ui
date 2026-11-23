import { expect, test } from "@playwright/test"

test("the submit button selects the route, method and browsing context", async ({ page }) => {
  await page.goto("/")
  const section = page.locator("#router-case")
  await expect(section.locator("router-home-view")).toBeVisible()
  await section.evaluate((element) => {
    element.insertAdjacentHTML(
      "beforeend",
      `<form id="publish" data-naos-action action="/products/42" method="post">
         <button formaction="/products/17" formmethod="get" name="intent" value="preview">Preview</button>
         <button name="note" value="published">Publish</button>
         <button formaction="/native-preview" formmethod="get" formtarget="preview-frame">Separate preview</button>
       </form><iframe name="preview-frame" title="Preview result"></iframe>`,
    )
  })
  const form = section.locator("#publish")
  await form.getByRole("button", { name: "Preview", exact: true }).click()
  await expect(page).toHaveURL(/\/products\/17\?intent=preview$/)
  await form.getByRole("button", { name: "Publish" }).click()
  await expect(page.locator("body")).toHaveAttribute("data-last-router-action", "published")

  await page.route("**/native-preview*", (route) =>
    route.fulfill({ contentType: "text/html", body: "<p>Native preview</p>" }),
  )
  const mainUrl = page.url()
  await form.getByRole("button", { name: "Separate preview" }).click()
  await expect(
    page.frameLocator('iframe[name="preview-frame"]').getByText("Native preview"),
  ).toBeVisible()
  await expect(page).toHaveURL(mainUrl)
})

test("draft submissions bypass validation and keep running inside the enhanced action", async ({
  page,
}) => {
  await page.goto("/")
  const form = page.locator("#actions-case demo-note-form form")
  const count = form.locator("[data-note-count]")
  await expect(count).toHaveText("0")
  await form.evaluate((element) => {
    element.insertAdjacentHTML("beforeend", "<button formnovalidate>Save draft</button>")
  })
  await form.getByRole("button", { name: "Save note" }).click()
  await expect(count).toHaveText("0")
  await form.getByRole("button", { name: "Save draft" }).click()
  await expect(count).toHaveText("1")
  await form.evaluate((element) => element.setAttribute("novalidate", ""))
  await form.getByRole("button", { name: "Save note" }).click()
  await expect(count).toHaveText("2")
  await expect(page).toHaveURL(/\/$/)
})
