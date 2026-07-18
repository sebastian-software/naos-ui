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
