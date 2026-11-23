import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { after, before, describe, test } from "node:test"
import { chromium, firefox, webkit } from "playwright"
import { selectMarkup, jumpMarkup, splitMarkup, popoverMarkup, pageMarkup } from "./fixtures.mjs"

const dist = join(import.meta.dirname, "dist")
const engines = { chromium, firefox, webkit }
const selected = (process.env.LAB_BROWSERS ?? "chromium,webkit").split(",")
const requireAll = process.env.LAB_STRICT === "1"
function knownLimitation(reason) {
  return { todo: requireAll ? false : reason }
}

async function fixture(browser, variant, markup) {
  const page = await browser.newPage({ reducedMotion: "reduce" })
  const errors = []
  page.on("pageerror", (error) => errors.push(error.message))
  page.setDefaultTimeout(2500)
  await page.setContent(pageMarkup(markup))
  await page.addScriptTag({ content: await readFile(join(dist, variant + ".js"), "utf8") })
  await page.evaluate(() => {
    window.changes = []
    for (const host of document.querySelectorAll("[data-record]")) {
      for (const type of ["naos-open-change", "naos-layout-change", "layoutchange"]) {
        host.addEventListener(type, (event) => {
          if (event.target === host)
            window.changes.push([
              host.id,
              type === "layoutchange" ? event.detail.value : event.detail,
            ])
        })
      }
    }
  })
  return { page, errors }
}

const openEvent = (id, open) => [id, { open }]
const log = (page) => page.evaluate(() => window.changes)
const rootPart = (page, id, part) =>
  page
    .locator("#" + id)
    .locator('[part~="' + part + '"]')
    .first()
// Allow the two libraries' deferred layer listeners to attach before input.
const settle = (page) =>
  page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      ),
  )

const activeTrigger = (page) =>
  page.locator("#outer").evaluate((el) => el.shadowRoot.activeElement?.getAttribute("part"))

for (const engine of selected) {
  const browserType = engines[engine]
  if (!browserType) throw new Error("Unknown browser: " + engine)
  describe(engine, () => {
    let browser
    before(async () => {
      browser = await browserType.launch({ timeout: 20000 })
    })
    after(async () => {
      await browser?.close()
    })

    for (const variant of ["zagSelect", "sdkSelect"]) {
      test(
        variant + " • re-enabled fieldset submits its value",
        knownLimitation("Naos reflects inherited disabled onto the host"),
        async () => {
          const { page, errors } = await fixture(browser, variant, selectMarkup(variant))
          try {
            const value = () =>
              page.locator("form").evaluate((el) => new FormData(el).getAll("city"))
            assert.deepEqual(await value(), ["berlin"])
            await page.locator("fieldset").evaluate((el) => {
              el.disabled = true
            })
            assert.deepEqual(await value(), [])
            await page.locator("fieldset").evaluate((el) => {
              el.disabled = false
            })
            await settle(page)
            assert.deepEqual(await value(), ["berlin"])
            assert.deepEqual(errors, [])
          } finally {
            await page.close()
          }
        },
      )
      for (const method of ["mouse", "keyboard"]) {
        test(variant + " • form, " + method + ", reset", async () => {
          const { page, errors } = await fixture(browser, variant, selectMarkup(variant))
          try {
            const value = () =>
              page.locator("form").evaluate((el) => new FormData(el).getAll("city"))
            const trigger = page.locator('[part="trigger"]')
            assert.deepEqual(await value(), ["berlin"])
            if (method === "keyboard") await trigger.press("Enter")
            else await trigger.click()
            const option = page.getByRole("option", { name: "Essen" })
            await option.waitFor()
            await settle(page)
            if (method === "mouse") {
              await option.click()
            } else {
              await page.keyboard.press("Home")
              await page.keyboard.press("ArrowDown")
              await page.keyboard.press("Enter")
            }
            await page.waitForFunction(
              () => new FormData(document.querySelector("form")).get("city") === "essen",
            )
            assert.deepEqual(await value(), ["essen"])
            assert.match(await trigger.innerText(), /Essen/)
            await page.locator("form").evaluate((el) => el.reset())
            await page.waitForFunction(
              () => new FormData(document.querySelector("form")).get("city") === "berlin",
            )
            assert.match(await trigger.innerText(), /Berlin/)
            assert.deepEqual(errors, [])
          } finally {
            await page.close()
          }
        })
      }
    }

    for (const variant of ["baseline", "hybrid", "popover"]) {
      const tag = variant === "popover" ? "lab-popover" : "naos-popover"
      const outer = (children) => popoverMarkup(tag, children)

      async function check(markup, run) {
        const { page, errors } = await fixture(browser, variant, markup)
        try {
          await run(page)
          assert.deepEqual(errors, [], "browser exceptions")
        } finally {
          await page.close()
        }
      }

      for (const action of ["Escape", "outside", "close"]) {
        test(
          variant + " • " + action,
          knownLimitation(
            variant === "hybrid" &&
              action === "Escape" &&
              "Zag cancels Escape before the SDK dismisses the layer",
          ),
          () =>
            check(outer("<span>Content</span>"), async (page) => {
              const content = rootPart(page, "outer", "content")
              await rootPart(page, "outer", "trigger").click()
              await content.waitFor({ state: "visible" })
              await settle(page)
              if (action === "Escape") await page.keyboard.press("Escape")
              if (action === "outside") await page.locator("#outside").click()
              if (action === "close") await rootPart(page, "outer", "close").click()
              await content.waitFor({ state: "hidden" })
              assert.deepEqual(await log(page), [
                openEvent("outer", true),
                openEvent("outer", false),
              ])
              // Outside presses on a focusable button may transfer focus there.
              if (action !== "outside") {
                await page.waitForFunction(
                  () =>
                    document
                      .querySelector("#outer")
                      .shadowRoot.activeElement?.getAttribute("part") === "trigger",
                )
                assert.equal(await activeTrigger(page), "trigger")
              }
            }),
        )
      }

      test(
        variant + " • nested Escape",
        knownLimitation(variant === "hybrid" && "Nested layer shares the Escape conflict"),
        () =>
          check(outer("<" + tag + ' id="inner" data-record>Inner</' + tag + ">"), async (page) => {
            await rootPart(page, "outer", "trigger").click()
            await settle(page)
            await rootPart(page, "inner", "trigger").click()
            await rootPart(page, "inner", "content").waitFor({ state: "visible" })
            await settle(page)
            await page.keyboard.press("Escape")
            await rootPart(page, "inner", "content").waitFor({ state: "hidden" })
            assert.equal(
              await rootPart(page, "outer", "content").isVisible(),
              true,
              "parent stays open",
            )
            assert.deepEqual(await log(page), [
              openEvent("outer", true),
              openEvent("inner", true),
              openEvent("inner", false),
            ])
            await page.keyboard.press("Escape")
            await rootPart(page, "outer", "content").waitFor({ state: "hidden" })
          }),
      )

      test(
        variant + " • reconnect",
        knownLimitation(variant === "hybrid" && "Escape remains canceled after reconnect"),
        () =>
          check(outer("Content"), async (page) => {
            await rootPart(page, "outer", "trigger").click()
            await rootPart(page, "outer", "content").waitFor({ state: "visible" })
            await page.evaluate(() => {
              window.detached = document.querySelector("#outer")
              window.detached.remove()
            })
            await page.keyboard.press("Escape")
            assert.deepEqual(
              await log(page),
              [openEvent("outer", true)],
              "detached element ignores Escape",
            )
            await page.evaluate(() => {
              document.body.prepend(window.detached)
            })
            const trigger = rootPart(page, "outer", "trigger")
            await trigger.waitFor()
            if ((await trigger.getAttribute("aria-expanded")) === "true") await trigger.click()
            await rootPart(page, "outer", "content").waitFor({ state: "hidden" })
            await page.evaluate(() => {
              window.changes = []
            })
            await trigger.click()
            await rootPart(page, "outer", "content").waitFor({ state: "visible" })
            await settle(page)
            await page.keyboard.press("Escape")
            await rootPart(page, "outer", "content").waitFor({ state: "hidden" })
            assert.deepEqual(await log(page), [openEvent("outer", true), openEvent("outer", false)])
          }),
      )
    }

    test("jump • accent folding, repeated letters, disabled and inserted buttons", async () => {
      const { page, errors } = await fixture(browser, "jump", jumpMarkup)
      try {
        await page.getByRole("button", { name: "Rome" }).focus()
        await page.keyboard.press("e")
        const focused = () => page.evaluate(() => document.activeElement.textContent)
        assert.equal(await focused(), "Évian")
        await page.keyboard.press("e")
        assert.equal(await focused(), "Essen")
        await page.locator("lab-jump-list").evaluate((el) => {
          el.insertAdjacentHTML("beforeend", "<button>Eichstätt</button>")
        })
        await page.keyboard.press("e")
        assert.equal(await focused(), "Eichstätt")
        await page.locator("lab-jump-list").evaluate((el) => {
          el.remove()
          document.body.prepend(el)
        })
        await page.getByRole("button", { name: "Rome" }).focus()
        await page.keyboard.press("b")
        assert.equal(await focused(), "Berlin")
        assert.deepEqual(errors, [])
      } finally {
        await page.close()
      }
    })

    for (const variant of ["split", "splitProbe", "namedSplit", "bareSplit"]) {
      const markup = splitMarkup(variant)
      for (const action of ["keyboard and events", "drag"]) {
        test(
          variant + " • " + action,
          knownLimitation(
            variant === "split" && action === "drag" && "Pointer hit testing sees the shadow host",
          ),
          async () => {
            const { page, errors } = await fixture(browser, variant, markup)
            try {
              const handle = page.getByRole("separator", { name: "Resize sidebar" })
              await handle.waitFor()
              assert.equal(await page.getByRole("button", { name: "Files" }).isVisible(), true)
              const panel = page.locator("ui-resizable-panel, lab-pane").first()
              const width = async () => (await panel.boundingBox())?.width ?? 0
              const start = await width()
              assert.ok(start > 150 && start < 300, "30% sidebar")
              if (action === "keyboard and events") {
                await handle.press("ArrowRight")
                assert.ok((await width()) > start, "ArrowRight grows the sidebar")
                await handle.press("Enter")
                assert.ok((await width()) < 3, "Enter collapses it")
                await handle.press("Enter")
                assert.ok((await width()) >= start, "second Enter restores it")
              } else {
                const box = await handle.boundingBox()
                await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
                await page.mouse.down()
                await page.mouse.move(box.x + 85, box.y + box.height / 2, { steps: 4 })
                await page.mouse.up()
                await settle(page)
                assert.ok((await width()) > start + 35, "drag grows the sidebar")
              }
              const changes = await log(page)
              assert.ok(changes.length >= (action === "drag" ? 1 : 3))
              for (const [id, sizes] of changes) {
                assert.equal(id, "split")
                assert.equal(sizes.length, 2)
                assert.ok(Math.abs(sizes[0] + sizes[1] - 100) < 0.01)
              }
              assert.deepEqual(errors, [])
            } finally {
              await page.close()
            }
          },
        )
      }
    }
  })
}
