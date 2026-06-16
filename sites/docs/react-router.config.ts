import type { Config } from "@react-router/dev/config"
import { detectGitHubBasename } from "ardo/vite"

export default {
  basename: process.env.IKTIA_GITHUB_PAGES === "true" ? detectGitHubBasename() : "/",
  prerender: true,
  ssr: false,
} satisfies Config
