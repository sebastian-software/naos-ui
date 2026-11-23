import { defineConfig } from "@playwright/test"

const publishedOrigin = process.env.NAOS_PLAYGROUND_TEST_ORIGIN
const origin = publishedOrigin ?? "http://127.0.0.1:4198"

export default defineConfig({
  testDir: "./tests",
  use: { baseURL: origin },
  webServer: publishedOrigin
    ? undefined
    : {
        command: "pnpm exec vite preview --host 127.0.0.1 --port 4198 --strictPort",
        url: origin + "/playground/",
      },
})
