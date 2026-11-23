import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"
import ts from "typescript"

const distRoot = join(import.meta.dirname, "..", "dist")
const { version: packageVersion } = JSON.parse(
  readFileSync(join(import.meta.dirname, "..", "package.json"), "utf8"),
) as { version: string }

describe("@naos-ui/primitives build output", () => {
  it("ships compiled component modules without Vite-only CSS imports", () => {
    const button = readFileSync(join(distRoot, "button.mjs"), "utf8")

    expect(button).toContain('__naosDefineComponent("naos-button"')
    expect(button).toContain("const css =")
    expect(button).not.toContain("?inline")
  })

  it("ships a package-stable component manifest", () => {
    const manifest = JSON.parse(readFileSync(join(distRoot, "naos-manifest.json"), "utf8")) as {
      schemaVersion: number
      package: { name: string; tagPrefix: string; version: string | null }
      components: Array<{ importPath: string; tagName: string }>
    }

    expect(manifest.schemaVersion).toBe(1)
    expect(manifest.package).toEqual({
      name: "@naos-ui/primitives",
      tagPrefix: "naos",
      version: packageVersion,
    })
    expect(manifest.components).toContainEqual(
      expect.objectContaining({
        importPath: "src/button.wc.tsx",
        tagName: "naos-button",
      }),
    )
  })

  it("exports every first-version primitive from the package entry", () => {
    const index = readFileSync(join(distRoot, "index.mjs"), "utf8")

    expect(index).toContain('export * from "./accordion.mjs"')
    expect(index).toContain('export * from "./accordion-item.mjs"')
    expect(index).toContain('export * from "./avatar.mjs"')
    expect(index).toContain('export * from "./button.mjs"')
    expect(index).toContain('export * from "./button-group.mjs"')
    expect(index).toContain('export * from "./checkbox.mjs"')
    expect(index).toContain('export * from "./collapsible.mjs"')
    expect(index).toContain('export * from "./combobox.mjs"')
    expect(index).toContain('export * from "./combobox-item.mjs"')
    expect(index).toContain('export * from "./context-menu.mjs"')
    expect(index).toContain('export * from "./date-picker.mjs"')
    expect(index).toContain('export * from "./dialog.mjs"')
    expect(index).toContain('export * from "./editable.mjs"')
    expect(index).toContain('export * from "./dropdown.mjs"')
    expect(index).toContain('export * from "./field.mjs"')
    expect(index).toContain('export * from "./file-upload.mjs"')
    expect(index).toContain('export * from "./hover-card.mjs"')
    expect(index).toContain('export * from "./listbox.mjs"')
    expect(index).toContain('export * from "./listbox-item.mjs"')
    expect(index).toContain('export * from "./menu.mjs"')
    expect(index).toContain('export * from "./menu-item.mjs"')
    expect(index).toContain('export * from "./number-input.mjs"')
    expect(index).toContain('export * from "./pin-input.mjs"')
    expect(index).toContain('export * from "./popover.mjs"')
    expect(index).toContain('export * from "./progress.mjs"')
    expect(index).toContain('export * from "./radio.mjs"')
    expect(index).toContain('export * from "./radio-group.mjs"')
    expect(index).toContain('export * from "./rating-group.mjs"')
    expect(index).toContain('export * from "./segmented-control.mjs"')
    expect(index).toContain('export * from "./segmented-item.mjs"')
    expect(index).toContain('export * from "./select.mjs"')
    expect(index).toContain('export * from "./select-item.mjs"')
    expect(index).toContain('export * from "./slider.mjs"')
    expect(index).toContain('export * from "./switch.mjs"')
    expect(index).toContain('export * from "./tab.mjs"')
    expect(index).toContain('export * from "./tab-panel.mjs"')
    expect(index).toContain('export * from "./tabs.mjs"')
    expect(index).toContain('export * from "./tags-input.mjs"')
    expect(index).toContain('export * from "./tooltip.mjs"')
    expect(index).toContain('export * from "./toast.mjs"')
    expect(index).toContain('export * from "./toast-root.mjs"')
    expect(index).toContain('export * from "./toggle.mjs"')
    expect(index).toContain('export * from "./toggle-group.mjs"')
    expect(index).toContain('export * from "./toggle-item.mjs"')
  })

  it("keeps primitive behavior kernels private but available to compiled components", () => {
    const dialog = readFileSync(join(distRoot, "dialog.mjs"), "utf8")
    const dropdown = readFileSync(join(distRoot, "dropdown.mjs"), "utf8")
    const hoverCardComponent = readFileSync(join(distRoot, "hover-card.mjs"), "utf8")
    const index = readFileSync(join(distRoot, "index.mjs"), "utf8")
    const popover = readFileSync(join(distRoot, "popover.mjs"), "utf8")
    const tooltipComponent = readFileSync(join(distRoot, "tooltip.mjs"), "utf8")
    const context = readFileSync(join(distRoot, "internal", "behavior", "context.js"), "utf8")
    const overlay = readFileSync(join(distRoot, "internal", "behavior", "overlay.js"), "utf8")
    const presence = readFileSync(join(distRoot, "internal", "behavior", "presence.js"), "utf8")

    expect(dialog).toContain(".naos-motion-presence-spring-snappy")
    expect(dialog).toContain("--naos-presence-motion-duration: ")
    expect(dialog).toContain("--naos-presence-motion-easing: linear(")
    expect(dialog).not.toContain('style: "--naos-presence-motion-duration')
    expect(dropdown).toContain('from "./internal/behavior/disclosure.js"')
    expect(hoverCardComponent).toContain('from "./internal/behavior/presence.js"')
    expect(hoverCardComponent).toContain("getNaosPresenceMotionAttributes")
    expect(popover).toContain('from "./internal/behavior/overlay.js"')
    expect(popover).toContain('from "./internal/behavior/presence.js"')
    expect(tooltipComponent).toContain('from "./internal/behavior/presence.js"')
    expect(context).toContain("context-request")
    expect(context).toContain("createNaosContext")
    expect(overlay).toContain("getNaosOverlayStateAttributes")
    expect(presence).toContain('from "@naos-ui/motion"')
    expect(presence).toContain("springMotionTokenClassName")
    expect(presence).not.toContain("--naos-presence-motion-duration")
    expect(presence).not.toContain("--naos-presence-motion-easing")
    expect(presence).toContain("waitForNaosPresenceExit")
    expect(index).not.toContain("internal/behavior")
    expect(dropdown).not.toContain("@naos-ui/core")
  })

  it("keeps implementation modules behind the package export boundary", () => {
    const index = readFileSync(join(distRoot, "index.mjs"), "utf8")
    expect(index).not.toContain("./internal/")
  })

  it("keeps Zag out of published primitive modules and dependencies", () => {
    const distModules = readdirSync(distRoot, { encoding: "utf8", recursive: true }).filter(
      (path) => /\.m?js$/.test(path),
    )
    for (const path of distModules) {
      const compiled = readFileSync(join(distRoot, path), "utf8")
      expect(compiled, path).not.toMatch(/@zag-js\/|[./]internal\/zag\//)
    }
    const { dependencies } = JSON.parse(
      readFileSync(join(import.meta.dirname, "..", "package.json"), "utf8"),
    ) as { dependencies: Record<string, string> }
    expect(Object.keys(dependencies).filter((name) => name.startsWith("@zag-js/"))).toEqual([])
  })

  it("builds native feedback and UI SDK disclosure controls without the Zag adapters", () => {
    for (const name of ["avatar", "progress", "collapsible", "toggle"]) {
      const compiled = readFileSync(join(distRoot, `${name}.mjs`), "utf8")
      expect(compiled).toContain(`__naosDefineComponent("naos-${name}"`)
      expect(compiled).not.toContain("./internal/zag/")
      expect(compiled).not.toContain("@naos-ui/core")
      if (name === "collapsible" || name === "toggle") {
        expect(compiled).toContain(`from "@ui-sdk/core/${name}"`)
      }
    }
  })

  it("uses the SDK checkbox behavior in its private binding", () => {
    const binding = readFileSync(join(distRoot, "internal/ui-sdk/checkbox.js"), "utf8")
    expect(binding).toContain("@ui-sdk/core/checkbox")
    expect(binding).not.toContain("@zag-js/")
  })

  it("builds migrated controls through their SDK entry points without Zag adapters", () => {
    const components = {
      checkbox: "./internal/ui-sdk/checkbox.js",
      "radio-group": "@ui-sdk/core/radio",
      "segmented-control": "@ui-sdk/core/segmented-control",
      select: "./internal/ui-sdk/options.js",
      listbox: "./internal/ui-sdk/options.js",
      combobox: "./internal/ui-sdk/options.js",
      "number-input": "@ui-sdk/web/number-input",
      dialog: "@ui-sdk/web/dialog",
      "toggle-group": "@ui-sdk/core/toggle",
      switch: "@ui-sdk/core/switch",
      editable: "./internal/behavior/editable.js",
      "tags-input": "./internal/behavior/tags-input.js",
      "file-upload": "./internal/ui-sdk/file-upload.js",
      "rating-group": "@ui-sdk/core/rating",
      slider: "@ui-sdk/web/slider",
      tooltip: "./internal/ui-sdk/hover.js",
      "hover-card": "./internal/ui-sdk/hover.js",
      "toast-root": "@ui-sdk/web/toast",
      toast: "./internal/ui-sdk/toast.js",
      menu: "./internal/ui-sdk/menu.js",
      "context-menu": "./internal/ui-sdk/menu.js",
      "pin-input": "@ui-sdk/core/otp-input",
      "date-picker": "@ui-sdk/web/date-picker",
    }
    for (const [name, adapter] of Object.entries(components)) {
      const compiled = readFileSync(join(distRoot, `${name}.mjs`), "utf8")
      expect(compiled).toContain(adapter)
      expect(compiled).not.toContain("./internal/zag/")
    }
  })

  it("backs accordion with the private UI SDK adapter", () => {
    const compiled = readFileSync(join(distRoot, "accordion.mjs"), "utf8")
    const adapter = readFileSync(join(distRoot, "internal", "behavior", "accordion.js"), "utf8")

    expect(compiled).toContain('from "./internal/behavior/accordion.js"')
    expect(compiled).not.toContain("./internal/zag/")
    expect(adapter).toContain('from "@ui-sdk/core/accordion"')
  })

  it("backs tabs with the private UI SDK adapter", () => {
    const compiled = readFileSync(join(distRoot, "tabs.mjs"), "utf8")
    const adapter = readFileSync(join(distRoot, "internal", "behavior", "tabs-sdk.js"), "utf8")

    expect(compiled).toContain('from "./internal/behavior/tabs-sdk.js"')
    expect(compiled).not.toContain("./internal/zag/")
    expect(adapter).toContain('from "@ui-sdk/core/tabs"')
  })

  it("backs popover with the UI SDK adapter", () => {
    const popover = readFileSync(join(distRoot, "popover.mjs"), "utf8")

    expect(popover).toContain('import "@ui-sdk/web/popover"')
    expect(popover).not.toContain('from "./internal/zag/popover.js"')
    expect(popover).toContain("__naosApplySpreadAttributes")
    expect(popover).not.toContain("@naos-ui/core")
    expect(popover).not.toContain("type NaosZagPopoverService")
  })

  it("emits form-associated custom control output", () => {
    const checkbox = readFileSync(join(distRoot, "checkbox.mjs"), "utf8")
    const combobox = readFileSync(join(distRoot, "combobox.mjs"), "utf8")
    const datePicker = readFileSync(join(distRoot, "date-picker.mjs"), "utf8")
    const editable = readFileSync(join(distRoot, "editable.mjs"), "utf8")
    const fileUpload = readFileSync(join(distRoot, "file-upload.mjs"), "utf8")
    const listbox = readFileSync(join(distRoot, "listbox.mjs"), "utf8")
    const numberInput = readFileSync(join(distRoot, "number-input.mjs"), "utf8")
    const pinInput = readFileSync(join(distRoot, "pin-input.mjs"), "utf8")
    const radioGroup = readFileSync(join(distRoot, "radio-group.mjs"), "utf8")
    const ratingGroup = readFileSync(join(distRoot, "rating-group.mjs"), "utf8")
    const segmentedControl = readFileSync(join(distRoot, "segmented-control.mjs"), "utf8")
    const select = readFileSync(join(distRoot, "select.mjs"), "utf8")
    const slider = readFileSync(join(distRoot, "slider.mjs"), "utf8")
    const switchComponent = readFileSync(join(distRoot, "switch.mjs"), "utf8")
    const tagsInput = readFileSync(join(distRoot, "tags-input.mjs"), "utf8")
    const toggle = readFileSync(join(distRoot, "toggle.mjs"), "utf8")
    const toggleGroup = readFileSync(join(distRoot, "toggle-group.mjs"), "utf8")

    for (const source of [
      checkbox,
      combobox,
      datePicker,
      editable,
      fileUpload,
      listbox,
      numberInput,
      pinInput,
      radioGroup,
      ratingGroup,
      segmentedControl,
      select,
      slider,
      switchComponent,
      tagsInput,
      toggle,
      toggleGroup,
    ]) {
      expect(source).toContain("static formAssociated = true")
      expect(source).toContain("this.#internals = this.attachInternals()")
      expect(source).toContain("this.#internals.setFormValue")
      expect(source).toContain("formResetCallback()")
      expect(source).toContain("formDisabledCallback(disabled)")
    }
  })

  it("maps common DOM listener attribute names in package output", () => {
    const dropdown = readFileSync(join(distRoot, "dropdown.mjs"), "utf8")
    const tabs = readFileSync(join(distRoot, "tabs.mjs"), "utf8")

    expect(dropdown).toContain("__naosListen(")
    expect(dropdown).toContain('"keydown"')
    expect(tabs).toContain("__naosApplySpreadAttributes")
    expect(tabs).not.toContain('"key-down": "keydown"')
    expect(dropdown).not.toContain('"key-down"')
    expect(tabs).not.toContain('addEventListener("key-down"')
  })

  it("ships element declarations with typed props, events, and tag names", () => {
    const toggle = readFileSync(join(distRoot, "toggle.d.mts"), "utf8")

    expect(toggle).toContain("export declare class NaosToggleElement extends HTMLElement {")
    expect(toggle).toContain("pressed: boolean;")
    expect(toggle).toContain("label: string;")
    expect(toggle).toContain('"naos-change": CustomEvent<{ pressed: boolean }>;')
    expect(toggle).toContain('"naos-toggle": NaosToggleElement;')
  })

  it("type-checks a consumer against the generated element declarations", () => {
    const consumerPath = join(distRoot, "__type-probe.ts")
    const consumerSource = `
      const created = document.createElement("naos-toggle")
      created.pressed = true
      created.label = "Power"
      created.addEventListener("naos-change", (event) => {
        const pressed: boolean = event.detail.pressed
        void pressed
      })
      // @ts-expect-error - pressed is a boolean prop
      created.pressed = "yes"
      // @ts-expect-error - label is a string prop
      created.label = 5

      const queried = document.querySelector("naos-toggle")
      if (queried) {
        const label: string = queried.label
        void label
      }
    `

    // index.d.mts only re-exports "./*.mjs" specifiers, which do not resolve
    // in this bare compiler-API program; the element declarations are the
    // files under test.
    const declarationFiles = readdirSync(distRoot)
      .filter((file) => file.endsWith(".d.mts") && file !== "index.d.mts")
      .map((file) => join(distRoot, file))
    const options: ts.CompilerOptions = {
      lib: ["lib.dom.d.ts", "lib.es2023.d.ts"],
      noEmit: true,
      skipLibCheck: true,
      strict: true,
      target: ts.ScriptTarget.ES2023,
    }
    const host = ts.createCompilerHost(options)
    const defaultReadFile = host.readFile.bind(host)
    const defaultFileExists = host.fileExists.bind(host)
    host.readFile = (fileName) =>
      fileName === consumerPath ? consumerSource : defaultReadFile(fileName)
    host.fileExists = (fileName) => (fileName === consumerPath ? true : defaultFileExists(fileName))

    const program = ts.createProgram([...declarationFiles, consumerPath], options, host)
    const diagnostics = ts.getPreEmitDiagnostics(program)
    const messages = diagnostics.map((diagnostic) =>
      ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
    )

    expect(messages).toEqual([])
  })
})
