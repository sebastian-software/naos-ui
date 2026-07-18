import { defineConfig } from "vite"
import { naos } from "@naos-ui/vite"

function demoBasePath(): string {
  if (process.env.NAOS_DEMO_BASE) {
    return process.env.NAOS_DEMO_BASE
  }

  if (process.env.NAOS_GITHUB_PAGES !== "true") {
    return "/"
  }

  const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1]
  return repositoryName ? `/${repositoryName}/tasks/` : "/tasks/"
}

export default defineConfig({
  base: demoBasePath(),
  plugins: [naos()],
})
