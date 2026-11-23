import { resolve } from "node:path"
import { expect, test } from "@playwright/test"

test("checkbox separates live checkedness from reset default", async ({ page }) => {
  await page.goto("/")
  await page.evaluate(() => {
    const form = document.createElement("form")
    form.id = "checkbox-owner"
    form.innerHTML = '<naos-checkbox name="choice" value="yes" checked></naos-checkbox>'
    document.body.append(form)
    const checkbox = form.querySelector("naos-checkbox")!
    ;(checkbox as unknown as HTMLElement & { changes: unknown[] }).changes = []
    checkbox.addEventListener("naos-change", (event) => {
      ;(checkbox as unknown as HTMLElement & { changes: unknown[] }).changes.push(
        (event as CustomEvent).detail,
      )
    })
  })
  const checkbox = page.locator("#checkbox-owner naos-checkbox")
  const button = checkbox.locator("[part~='control']")
  const checked = () =>
    checkbox.evaluate((el) => (el as HTMLElement & { checked: boolean }).checked)
  const changes = () =>
    checkbox.evaluate((el) => (el as HTMLElement & { changes: unknown[] }).changes)
  const submitted = () =>
    page
      .locator("#checkbox-owner")
      .evaluate((el) => new FormData(el as HTMLFormElement).get("choice"))
  await expect(button).toHaveAttribute("aria-checked", "true")
  expect(await checked()).toBe(true)
  expect(await submitted()).toBe("yes")
  expect(
    await checkbox.evaluate((el) => {
      ;(el as HTMLElement & { value: string }).value = "updated"
      return new FormData(el.closest("form")!).get("choice")
    }),
  ).toBe("updated")
  await checkbox.evaluate((el) => {
    ;(el as HTMLElement & { value: string }).value = "yes"
  })
  await button.click()
  await expect(button).toHaveAttribute("aria-checked", "false")
  expect(await checked()).toBe(false)
  expect(await submitted()).toBeNull()
  expect(await changes()).toEqual([{ checked: false, indeterminate: false }])
  await checkbox.evaluate((el) => {
    ;(el as HTMLElement & { checked: boolean }).checked = true
  })
  await expect(button).toHaveAttribute("aria-checked", "true")
  expect(await submitted()).toBe("yes")
  expect(await changes()).toHaveLength(1)
  await checkbox.evaluate((el) => {
    ;(el as HTMLElement & { checked: boolean }).checked = false
  })
  expect(await submitted()).toBeNull()
  await checkbox.evaluate((el) => {
    el.remove()
    document.querySelector("#checkbox-owner")!.append(el)
  })
  await expect(button).toHaveAttribute("aria-checked", "false")
  expect(await checked()).toBe(false)
  await page.locator("#checkbox-owner").evaluate((el) => (el as HTMLFormElement).reset())
  await expect(button).toHaveAttribute("aria-checked", "true")
  expect(await checked()).toBe(true)
  expect(await submitted()).toBe("yes")
  expect(await changes()).toHaveLength(1)
})

test("checkbox preserves a property assigned before custom-element upgrade", async ({ page }) => {
  await page.goto("/")
  const iframe = await page.evaluateHandle(() => {
    const frame = document.createElement("iframe")
    document.body.append(frame)
    return frame
  })
  const frame = await iframe.asElement()!.contentFrame()
  if (!frame) throw new Error("Missing test frame")
  await frame.evaluate(() => {
    const form = document.createElement("form")
    form.innerHTML = '<naos-checkbox name="late" checked></naos-checkbox>'
    const element = form.firstElementChild as HTMLElement & { checked: boolean }
    element.checked = false
    document.body.append(form)
  })
  const entry =
    "/@fs" + resolve(import.meta.dirname, "../../../packages/primitives/dist/checkbox.mjs")
  await frame.evaluate(async (url) => {
    await import(url)
  }, entry)
  const box = frame.locator("naos-checkbox")
  await expect(box.locator("[part~='control']")).toHaveAttribute("aria-checked", "false")
  expect(await box.evaluate((el) => (el as HTMLElement & { checked: boolean }).checked)).toBe(false)
  expect(
    await frame.locator("form").evaluate((el) => new FormData(el as HTMLFormElement).get("late")),
  ).toBeNull()
  await frame.locator("form").evaluate((el) => (el as HTMLFormElement).reset())
  await expect(box.locator("[part~='control']")).toHaveAttribute("aria-checked", "true")
})

test("checkbox keeps defaults, indeterminate state and disconnected writes separate", async ({
  page,
}) => {
  await page.goto("/")
  await page.evaluate(() => {
    const form = document.createElement("form")
    form.id = "checkbox-matrix"
    form.innerHTML = '<naos-checkbox name="item" value="a"></naos-checkbox>'
    document.body.append(form)
    const checkbox = form.firstElementChild as HTMLElement & {
      changes: unknown[]
      snapshots: unknown[]
    }
    checkbox.changes = []
    checkbox.snapshots = []
    checkbox.addEventListener("naos-change", (event) => {
      checkbox.changes.push((event as CustomEvent).detail)
      checkbox.snapshots.push(new FormData(form).get("item"))
    })
  })
  const box = page.locator("#checkbox-matrix naos-checkbox")
  const control = box.locator("[part~='control']")
  const form = page.locator("#checkbox-matrix")
  await box.evaluate((el) => el.setAttribute("checked", ""))
  await expect(control).toHaveAttribute("aria-checked", "true")
  await box.evaluate((el) => el.removeAttribute("checked"))
  await expect(control).toHaveAttribute("aria-checked", "false")
  const immediate = await box.evaluate((el) => {
    const checkbox = el as HTMLElement & { checked: boolean; indeterminate: boolean }
    checkbox.checked = true
    checkbox.indeterminate = true
    return {
      checked: checkbox.checked,
      indeterminate: checkbox.indeterminate,
      value: new FormData(el.closest("form")!).get("item"),
    }
  })
  expect(immediate).toEqual({ checked: true, indeterminate: true, value: "a" })
  await expect(control).toHaveAttribute("aria-checked", "mixed")
  await control.click()
  await expect(control).toHaveAttribute("aria-checked", "false")
  expect(await box.evaluate((el) => (el as HTMLElement & { changes: unknown[] }).changes)).toEqual([
    { checked: false, indeterminate: false },
  ])
  expect(
    await box.evaluate((el) => (el as HTMLElement & { snapshots: unknown[] }).snapshots),
  ).toEqual([null])
  await box.evaluate((el) => {
    el.setAttribute("checked", "")
    el.remove()
    ;(el as HTMLElement & { checked: boolean }).checked = false
    document.querySelector("#checkbox-matrix")!.append(el)
  })
  await expect(control).toHaveAttribute("aria-checked", "false")
  await box.evaluate((el) => {
    ;(el as HTMLElement & { indeterminate: boolean }).indeterminate = true
  })
  await form.evaluate((el) => (el as HTMLFormElement).reset())
  await expect(control).toHaveAttribute("aria-checked", "mixed")
  expect(await box.evaluate((el) => (el as HTMLElement & { checked: boolean }).checked)).toBe(true)
  expect(await form.evaluate((el) => new FormData(el as HTMLFormElement).get("item"))).toBe("a")
  expect(
    await box.evaluate((el) => (el as HTMLElement & { changes: unknown[] }).changes),
  ).toHaveLength(1)
})

test("checkbox consumes a pending default before same-task input and reset", async ({ page }) => {
  await page.goto("/")
  const result = await page.evaluate(async () => {
    const form = document.createElement("form")
    form.innerHTML = '<naos-checkbox name="same-task" value="x"></naos-checkbox>'
    document.body.append(form)
    const box = form.firstElementChild as HTMLElement & { checked: boolean }
    const changes: unknown[] = []
    box.addEventListener("naos-change", (event) => changes.push((event as CustomEvent).detail))
    box.setAttribute("checked", "")
    box.shadowRoot!.querySelector<HTMLButtonElement>("[part~='control']")!.click()
    const afterClick = { checked: box.checked, value: new FormData(form).get("same-task") }
    box.removeAttribute("checked")
    form.reset()
    const afterReset = { checked: box.checked, value: new FormData(form).get("same-task") }
    box.setAttribute("checked", "")
    form.reset()
    const afterCheckedReset = { checked: box.checked, value: new FormData(form).get("same-task") }
    await Promise.resolve()
    return { afterClick, afterReset, afterCheckedReset, changes }
  })
  expect(result).toEqual({
    afterClick: { checked: false, value: null },
    afterReset: { checked: false, value: null },
    afterCheckedReset: { checked: true, value: "x" },
    changes: [{ checked: false, indeterminate: false }],
  })
})

test("checkbox disconnects its default observer on every removal", async ({ page }) => {
  await page.goto("/")
  const counts = await page.evaluate(() => {
    const NativeObserver = window.MutationObserver
    let attached = 0
    let detached = 0
    window.MutationObserver = class extends NativeObserver {
      private tracked = false
      override observe(target: Node, options?: MutationObserverInit) {
        if (
          options?.attributeFilter?.includes("checked") &&
          options.attributeFilter.includes("indeterminate")
        ) {
          this.tracked = true
          attached++
        }
        super.observe(target, options)
      }
      override disconnect() {
        if (this.tracked) {
          detached++
          this.tracked = false
        }
        super.disconnect()
      }
    }
    try {
      const box = document.createElement("naos-checkbox")
      document.body.append(box)
      box.remove()
      document.body.append(box)
      box.remove()
      return { attached, detached }
    } finally {
      window.MutationObserver = NativeObserver
    }
  })
  expect(counts).toEqual({ attached: 2, detached: 2 })
})
