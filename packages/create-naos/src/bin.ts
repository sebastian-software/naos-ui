#!/usr/bin/env node
import { scaffoldNaosProject } from "./index.js"

async function main(): Promise<void> {
  const target = process.argv[2] ?? "naos-app"
  const { projectName, targetDir } = await scaffoldNaosProject(target)
  console.log(`Scaffolded ${projectName} in ${targetDir}`)
  console.log("")
  console.log("Next steps:")
  console.log(`  cd ${target}`)
  console.log("  pnpm install   (or npm install)")
  console.log("  pnpm dev       start the Vite dev server")
  console.log("  pnpm build     production build")
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
