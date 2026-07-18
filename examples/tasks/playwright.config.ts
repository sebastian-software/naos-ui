import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],
  testDir: "./tests",
  use: {
    baseURL: "http://127.0.0.1:4176",
  },
  webServer: {
    command: "pnpm vite --host 127.0.0.1 --port 4176",
    reuseExistingServer: true,
    url: "http://127.0.0.1:4176",
  },
})
