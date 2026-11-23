import { expect, test } from "@playwright/test"

test("a keyed slider releases its thumb observer while the list stays connected", async ({
  page,
}) => {
  await page.goto("/")
  await page.evaluate(async (modulePath) => {
    await import(modulePath)
    const NativeObserver = window.MutationObserver
    window.MutationObserver = class extends NativeObserver {
      private thumb?: HTMLInputElement
      override observe(target: Node, options?: MutationObserverInit) {
        if (
          target instanceof HTMLInputElement &&
          target.part.contains("thumb") &&
          options?.attributeFilter?.length === 1 &&
          options.attributeFilter[0] === "style"
        ) {
          this.thumb = target
          target.dataset.installs = String(Number(target.dataset.installs ?? 0) + 1)
        }
        super.observe(target, options)
      }
      override disconnect() {
        if (this.thumb) {
          this.thumb.dataset.cleanups = String(Number(this.thumb.dataset.cleanups ?? 0) + 1)
          this.thumb = undefined
        }
        super.disconnect()
      }
    }
    document.body.prepend(document.createElement("demo-slider-list"))
  }, "/fixtures/slider-list.wc.tsx")
  const list = page.locator("demo-slider-list")
  const toggle = list.getByRole("button", { name: "Toggle row" })
  const thumb = list.locator("input[part~=thumb]")
  await expect(thumb).toHaveAttribute("data-installs", "1")
  const first = await thumb.elementHandle()
  if (!first) throw new Error("Missing initial slider thumb")
  await first.evaluate((el) => el.style.setProperty("opacity", "0"))
  await expect.poll(() => first.evaluate((el) => el.style.opacity)).toBe("")
  await toggle.click()
  await expect(thumb).toHaveCount(0)
  expect(await first.evaluate((el) => el.dataset.cleanups)).toBe("1")
  expect(await list.evaluate((el) => el.isConnected)).toBe(true)
  await first.evaluate((el) => el.style.setProperty("opacity", "0"))
  await toggle.click()
  await expect(thumb).toHaveAttribute("data-installs", "1")
  expect(
    await first.evaluate((el) => ({ connected: el.isConnected, opacity: el.style.opacity })),
  ).toEqual({ connected: false, opacity: "0" })
  await first.dispose()
})
