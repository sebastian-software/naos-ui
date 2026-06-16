import { defineConfig } from "vite"
import tailwindcss from "@tailwindcss/vite"
import { ardo, detectGitHubBasename } from "ardo/vite"

function docsBasePath(): string {
  return process.env.IKTIA_GITHUB_PAGES === "true" ? detectGitHubBasename() : "/"
}

export default defineConfig({
  base: docsBasePath(),
  plugins: [
    tailwindcss(),
    ardo({
      base: docsBasePath(),
      title: "Iktia",
      description:
        "React-like TSX authoring for native Custom Elements without a framework runtime.",
      githubPages: process.env.IKTIA_GITHUB_PAGES === "true",
      markdown: {
        lineNumbers: true,
      },
      project: {
        name: "Iktia",
        repository: "https://github.com/sebastian-software/iktia",
        license: "Apache-2.0",
      },
      sidebar: {
        sectionOrder: ["guide", "reference"],
      },
    }),
  ],
})
