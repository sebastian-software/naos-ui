#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises"
import { basename, dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import {
  getNativeInfo,
  isIktiaCompilerError,
  renderDeclarativeShadowDom,
  transformComponent,
  type IktiaDiagnostic,
} from "@iktia/compiler"

export type CliIo = {
  cwd?: string
  stderr: { write(chunk: string): unknown }
  stdout: { write(chunk: string): unknown }
}

type ParsedArgs = {
  input?: string
  output?: string
  props?: string
  stdout: boolean
}

const helpText = `Usage:
  iktia compile <input> [-o output] [--stdout]
  iktia prerender <input> [-o output] [--props json]
  iktia info
`

export async function runCli(
  argv = process.argv.slice(2),
  io: CliIo = {
    stderr: process.stderr,
    stdout: process.stdout,
  }
): Promise<number> {
  const cwd = io.cwd ?? process.cwd()
  const [command, ...args] = argv

  try {
    switch (command) {
      case "compile":
        return await compileCommand(args, cwd, io)
      case "prerender":
        return await prerenderCommand(args, cwd, io)
      case "info":
        return infoCommand(io)
      case "-h":
      case "--help":
      case undefined:
        io.stdout.write(helpText)
        return 0
      default:
        io.stderr.write(`Unknown Iktia command: ${command}\n${helpText}`)
        return 1
    }
  } catch (error) {
    if (isIktiaCompilerError(error)) {
      io.stderr.write(`${formatDiagnostics(error.diagnostics)}\n`)
      return 1
    }

    const message = error instanceof Error ? error.message : String(error)
    io.stderr.write(`${message}\n`)
    return 1
  }
}

async function compileCommand(
  args: readonly string[],
  cwd: string,
  io: CliIo
): Promise<number> {
  const parsed = parseArgs(args, { props: false })
  const input = requireInput(parsed, "compile")
  const filename = resolve(cwd, input)
  const source = await readFile(filename, "utf8")
  const result = transformComponent({ filename, source })

  if (parsed.output && !parsed.stdout) {
    const outputPath = resolve(cwd, parsed.output)
    const code = result.map
      ? `${result.code}\n//# sourceMappingURL=${basename(outputPath)}.map\n`
      : result.code
    await writeFile(outputPath, code)
    if (result.map) {
      await writeFile(`${outputPath}.map`, `${JSON.stringify(result.map, null, 2)}\n`)
    }
    return 0
  }

  io.stdout.write(result.code)
  if (!result.code.endsWith("\n")) {
    io.stdout.write("\n")
  }
  return 0
}

async function prerenderCommand(
  args: readonly string[],
  cwd: string,
  io: CliIo
): Promise<number> {
  const parsed = parseArgs(args, { props: true })
  const input = requireInput(parsed, "prerender")
  const filename = resolve(cwd, input)
  const source = await readFile(filename, "utf8")
  const props = parsed.props ? parseProps(parsed.props) : undefined
  const inlineStyles = await resolveInlineStyles(source, filename)
  const result = renderDeclarativeShadowDom({
    filename,
    inlineStyles,
    props,
    source,
  })

  if (parsed.output && !parsed.stdout) {
    await writeFile(resolve(cwd, parsed.output), `${result.html}\n`)
    return 0
  }

  io.stdout.write(`${result.html}\n`)
  return 0
}

function infoCommand(io: CliIo): number {
  const native = getNativeInfo()
  io.stdout.write(
    `${JSON.stringify(
      {
        arch: process.arch,
        native,
        node: process.versions.node,
        platform: process.platform,
      },
      null,
      2
    )}\n`
  )
  return 0
}

function parseArgs(
  args: readonly string[],
  options: { props: boolean }
): ParsedArgs {
  const parsed: ParsedArgs = { stdout: false }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === "-o" || arg === "--out" || arg === "--output") {
      parsed.output = readOptionValue(args, index, arg)
      index += 1
      continue
    }
    if (arg === "--stdout") {
      parsed.stdout = true
      continue
    }
    if (arg === "--props" && options.props) {
      parsed.props = readOptionValue(args, index, arg)
      index += 1
      continue
    }
    if (arg?.startsWith("-")) {
      throw new Error(`Unsupported option: ${arg}`)
    }
    if (parsed.input) {
      throw new Error(`Unexpected extra input: ${arg}`)
    }
    parsed.input = arg
  }

  return parsed
}

function readOptionValue(args: readonly string[], index: number, option: string): string {
  const value = args[index + 1]
  if (!value || value.startsWith("-")) {
    throw new Error(`Missing value for ${option}`)
  }
  return value
}

function requireInput(parsed: ParsedArgs, command: string): string {
  if (!parsed.input) {
    throw new Error(`iktia ${command} requires an input file`)
  }
  return parsed.input
}

function parseProps(source: string): Record<string, unknown> {
  const value = JSON.parse(source) as unknown
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("--props must be a JSON object")
  }
  return value as Record<string, unknown>
}

async function resolveInlineStyles(
  source: string,
  filename: string
): Promise<Record<string, string> | undefined> {
  const imports = inlineCssImports(source)
  if (imports.length === 0) {
    return undefined
  }

  const inlineStyles: Record<string, string> = {}
  for (const styleImport of imports) {
    const cssPath = resolve(dirname(filename), stripQuery(styleImport.source))
    inlineStyles[styleImport.localName] = await readFile(cssPath, "utf8")
  }
  return inlineStyles
}

type InlineCssImport = {
  localName: string
  source: string
}

function inlineCssImports(source: string): InlineCssImport[] {
  const imports: InlineCssImport[] = []
  const regex =
    /import\s+([A-Za-z_$][A-Za-z0-9_$]*)\s+from\s+["']([^"']+\.css\?inline(?:&[^"']*)?)["']/g
  for (const match of source.matchAll(regex)) {
    const [, localName, importSource] = match
    if (localName && importSource) {
      imports.push({ localName, source: importSource })
    }
  }
  return imports
}

function stripQuery(id: string): string {
  return id.split("?")[0] ?? id
}

function formatDiagnostics(diagnostics: readonly IktiaDiagnostic[]): string {
  return diagnostics
    .map((diagnostic) => {
      const span = diagnostic.span
        ? `:${diagnostic.span.start}-${diagnostic.span.end}`
        : ""
      const hint = diagnostic.hint ? `\nhint: ${diagnostic.hint}` : ""
      return `${diagnostic.filename}${span} ${diagnostic.severity} ${diagnostic.code}: ${diagnostic.message}${hint}`
    })
    .join("\n")
}

const currentFile = fileURLToPath(import.meta.url)
if (process.argv[1] && resolve(process.argv[1]) === currentFile) {
  runCli().then((exitCode) => {
    process.exitCode = exitCode
  })
}
