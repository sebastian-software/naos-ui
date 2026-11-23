import { expect, test } from "@playwright/test"

test("board lists loader-backed tasks with filters and live activity", async ({ page }) => {
  await page.goto("/")

  const board = page.locator("tasks-board")
  await expect(board).toBeVisible()

  const rows = page.locator("tasks-task-list li[data-task-row]")
  await expect(rows).toHaveCount(4)

  await page.locator('tasks-task-list button[data-filter="open"]').click()
  await expect(rows).toHaveCount(2)
  await page.locator('tasks-task-list button[data-filter="all"]').click()
  await expect(rows).toHaveCount(4)

  await expect
    .poll(async () =>
      Number(await page.locator("tasks-activity-feed aside").getAttribute("data-entry-count")),
    )
    .toBeGreaterThan(0)
})

test("task navigation resolves the route loader into detail props", async ({ page }) => {
  await page.goto("/")

  await page
    .locator('tasks-task-list li[data-task-id="testing-harness"] button[part~="task-link"]')
    .click()

  await expect(page).toHaveURL(/\/tasks\/testing-harness$/)
  const detail = page.locator("tasks-task-detail")
  await expect(detail).toBeVisible()
  await expect(detail.locator('h2[part~="title"]')).toHaveText("Adopt the component test harness")
  await expect(detail.locator('p[part~="owner"]')).toHaveText("Owner: Aylin")
  await expect(detail.locator('tasks-status-badge span[part~="badge"]')).toHaveText("Open")

  await detail.locator('button[part~="back-link"]').click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.locator("tasks-task-list li[data-task-row]")).toHaveCount(4)
})

test("deep link renders detail from the loader directly", async ({ page }) => {
  await page.goto("/tasks/motion-pass")

  const detail = page.locator("tasks-task-detail")
  await expect(detail.locator('h2[part~="title"]')).toHaveText("Motion pass over list surfaces")
  await expect(page).toHaveTitle("Task motion-pass – Task board")
})

for (const { mode, origin } of [
  { mode: "development", origin: "http://127.0.0.1:4176" },
  { mode: "production", origin: "http://127.0.0.1:4177" },
]) {
  test(`${mode} reports a failing task resource only in development`, async ({ page }) => {
    const diagnostics: unknown[] = []
    const messages: string[] = []
    page.on("console", async (message) => {
      if (message.text().startsWith("[Tasks] Navigation failed")) {
        messages.push(message.text())
        const args = message.args()
        diagnostics.push(
          await args[1]!.evaluate((value) => ({
            ...value,
            error: { message: value.error.message },
          })),
        )
      }
    })
    await page.goto(origin)
    await expect(page.locator("tasks-board")).toBeVisible()
    const failure = page.waitForEvent("pageerror")
    await page.locator("[data-app-outlet]").evaluate((outlet) => {
      outlet.dispatchEvent(new CustomEvent("naos-open-task", { detail: { id: "missing" } }))
    })
    // The thrown navigation error confirms the resource and router both settled.
    await failure
    if (mode === "development") {
      await expect.poll(() => diagnostics.length).toBe(1)
      expect(diagnostics[0]).toMatchObject({
        error: { message: 'Unknown task "missing".' },
        navigationId: expect.any(Number),
        routeResource: ["task", "missing"],
        route: "/tasks/:id",
        url: `${origin}/tasks/missing`,
      })
    } else {
      expect(messages).toEqual([])
    }
  })
}

for (const { mode, origin } of [
  { mode: "development", origin: "http://127.0.0.1:4176" },
  { mode: "production", origin: "http://127.0.0.1:4177" },
]) {
  test(`${mode} falls back from a mismatched hydration snapshot`, async ({ page }) => {
    const messages: string[] = []
    const diagnostics: unknown[] = []
    page.on("console", async (message) => {
      if (message.text().startsWith("[Tasks] Snapshot mismatch")) {
        messages.push(message.text())
        diagnostics.push(await message.args()[1]!.jsonValue())
      }
    })
    await page.route(`${origin}/`, async (route) => {
      const response = await route.fetch()
      const html = await response.text()
      const snapshot = JSON.stringify({
        version: 1,
        url: `${origin}/different`,
        route: "/",
        expiresAt: Date.now() + 60_000,
        data: null,
        actionData: null,
        resources: [],
      })
      await route.fulfill({
        response,
        body: html.replace(
          "</head>",
          `<script id="naos-snapshot" type="application/json">${snapshot}</script></head>`,
        ),
      })
    })
    await page.goto(origin)
    await expect(page.locator("tasks-task-list li[data-task-row]")).toHaveCount(4)
    if (mode === "development") {
      await expect.poll(() => diagnostics.length).toBe(1)
      expect(diagnostics[0]).toEqual({ reason: "url", url: `${origin}/` })
    } else {
      expect(messages).toEqual([])
    }
  })
}
