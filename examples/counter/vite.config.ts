import { resolve } from "node:path"

import { defineConfig } from "vite"
import { iktia } from "@iktia/vite"

function demoBasePath(): string {
  if (process.env.IKTIA_DEMO_BASE) {
    return process.env.IKTIA_DEMO_BASE
  }

  if (process.env.IKTIA_GITHUB_PAGES !== "true") {
    return "/"
  }

  const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1]
  return repositoryName ? `/${repositoryName}/demos/` : "/demos/"
}

export default defineConfig({
  base: demoBasePath(),
  build: {
    rollupOptions: {
      input: {
        dsd: resolve(__dirname, "dsd.html"),
        main: resolve(__dirname, "index.html"),
      },
    },
  },
  plugins: [iktia({ prerender: true })],
})
