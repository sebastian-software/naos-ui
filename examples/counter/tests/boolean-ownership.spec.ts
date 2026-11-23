import { expect, test } from "@playwright/test"

const controls = [
  { tag: "naos-switch", property: "checked", role: "switch", on: "checked", off: "unchecked" },
  { tag: "naos-toggle", property: "pressed", role: "button", on: "on", off: "off" },
] as const

for (const { tag, property, role, on, off } of controls) {
  test(`${tag} separates live state, submitted value, and the reset default`, async ({ page }) => {
    await page.goto("/")
    await page.evaluate(
      ({ tag, property }) => {
        const form = document.createElement("form")
        form.id = "boolean-owner"
        form.innerHTML = `<fieldset><${tag} ${property} name="choice" value="yes" label="Choice"></${tag}></fieldset>`
        document.body.append(form)
        const element = form.querySelector(tag)!
        const changes: unknown[] = []
        element.setAttribute("data-change-log", "[]")
        element.addEventListener("naos-change", (event) => {
          changes.push({
            detail: (event as CustomEvent).detail,
            live: (element as unknown as Record<string, boolean>)[property],
            submitted: new FormData(form).getAll("choice"),
          })
          element.setAttribute("data-change-log", JSON.stringify(changes))
        })
      },
      { tag, property },
    )

    const form = page.locator("#boolean-owner")
    const element = form.locator(tag)
    const control = form.getByRole(role, { name: /Choice/ })
    const read = async () =>
      element.evaluate(
        (node, key) => ({
          live: (node as unknown as Record<string, boolean>)[key],
          defaultValue: node.hasAttribute(key),
          submitted: new FormData(node.closest("form")!).getAll("choice"),
        }),
        property,
      )
    const setLive = async (live: boolean) =>
      element.evaluate(
        (node, { key, live }) => {
          const host = node as unknown as Record<string, boolean>
          host[key] = live
          return {
            live: host[key],
            defaultValue: node.hasAttribute(key),
            submitted: new FormData(node.closest("form")!).getAll("choice"),
          }
        },
        { key: property, live },
      )
    const expectVisual = async (active: boolean) => {
      await expect(control).toHaveAttribute(`aria-${property}`, String(active))
      await expect(control).toHaveAttribute("data-state", active ? on : off)
    }

    await expectVisual(true)
    expect(await read()).toEqual({ live: true, defaultValue: true, submitted: ["yes"] })
    expect(await setLive(false)).toEqual({ live: false, defaultValue: true, submitted: [] })
    await expectVisual(false)
    await expect(element).toHaveAttribute("data-change-log", "[]")

    await control.click()
    await expectVisual(true)
    expect(await read()).toEqual({ live: true, defaultValue: true, submitted: ["yes"] })
    await control.press("Space")
    await expectVisual(false)
    expect(await read()).toEqual({ live: false, defaultValue: true, submitted: [] })
    const activationLog = [
      { detail: { [property]: true }, live: true, submitted: ["yes"] },
      { detail: { [property]: false }, live: false, submitted: [] },
    ]
    await expect(element).toHaveAttribute("data-change-log", JSON.stringify(activationLog))

    await setLive(true)
    await element.evaluate((node, key) => node.removeAttribute(key), property)
    expect(await read()).toEqual({ live: true, defaultValue: false, submitted: ["yes"] })
    await expectVisual(true)
    await form.evaluate((node: HTMLFormElement) => node.reset())
    expect(await read()).toEqual({ live: false, defaultValue: false, submitted: [] })
    await expectVisual(false)
    expect(
      await element.evaluate((node, key) => {
        node.setAttribute(key, "")
        const owner = node.closest("form")!
        owner.reset()
        return {
          live: (node as unknown as Record<string, boolean>)[key],
          submitted: new FormData(owner).getAll("choice"),
        }
      }, property),
    ).toEqual({ live: true, submitted: ["yes"] })
    await element.evaluate((node, key) => node.removeAttribute(key), property)
    await expectVisual(false)

    await setLive(true)
    await form.locator("fieldset").evaluate((node: HTMLFieldSetElement) => {
      node.disabled = true
    })
    await expect(control).toBeDisabled()
    await control.click({ force: true })
    expect(await read()).toEqual({ live: true, defaultValue: false, submitted: [] })
    await form.locator("fieldset").evaluate((node: HTMLFieldSetElement) => {
      node.disabled = false
    })
    expect(await read()).toEqual({ live: true, defaultValue: false, submitted: ["yes"] })
    await expectVisual(true)

    await setLive(false)
    await element.evaluate((node, key) => {
      const fieldset = node.parentElement!
      const detached = node as unknown as Record<string, boolean>
      node.remove()
      detached[key] = true
      fieldset.append(node)
    }, property)
    await expectVisual(true)
    expect(await read()).toEqual({ live: true, defaultValue: false, submitted: ["yes"] })
    await expect(element).toHaveAttribute("data-change-log", JSON.stringify(activationLog))
    await control.click()
    await expectVisual(false)
    await expect(element).toHaveAttribute(
      "data-change-log",
      JSON.stringify([
        ...activationLog,
        { detail: { [property]: false }, live: false, submitted: [] },
      ]),
    )
  })
}
