import { defineConfig } from "vite"

// The playground deploys as a standalone page next to the docs site at
// /playground/ (see .github/workflows/pages.yml).
export default defineConfig({
  base: process.env.NAOS_PLAYGROUND_BASE ?? "/playground/",
})
