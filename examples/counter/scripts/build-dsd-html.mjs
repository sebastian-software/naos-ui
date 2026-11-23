import { readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { renderDeclarativeShadowDom } from "@naos-ui/compiler"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "../../..")

const components = [
  {
    filename: resolve(root, "examples/counter/src/counter.wc.tsx"),
    id: "dsd-counter-case",
    props: { label: "Count" },
    title: "DSD counter",
  },
  {
    children: "manual slot content",
    filename: resolve(root, "examples/counter/src/toggle.wc.tsx"),
    id: "dsd-toggle-case",
    props: { label: "Power" },
    title: "DSD toggle",
  },
  {
    filename: resolve(root, "examples/counter/src/note-form.wc.tsx"),
    id: "dsd-note-form-case",
  },
]

function renderComponent(component) {
  const source = readFileSync(component.filename, "utf8")
  const rendered = renderDeclarativeShadowDom({
    filename: component.filename,
    inlineStyles: resolveInlineStyles(source, component.filename),
    props: component.props,
    source,
  })
  const html = component.children
    ? rendered.html.replace(`</${rendered.tagName}>`, `${component.children}</${rendered.tagName}>`)
    : rendered.html

  return {
    ...component,
    ...rendered,
    html,
  }
}

function resolveInlineStyles(source, filename) {
  const inlineStyles = {}
  const regex =
    /import\s+([A-Za-z_$][A-Za-z0-9_$]*)\s+from\s+["']([^"']+\.css\?inline(?:&[^"']*)?)["']/g
  for (const match of source.matchAll(regex)) {
    const [, localName, importSource] = match
    const cssPath = resolve(dirname(filename), importSource.split("?")[0])
    inlineStyles[localName] = readFileSync(cssPath, "utf8")
  }
  return inlineStyles
}

const renderedComponents = components.map(renderComponent)
const counter = renderedComponents[0]
const toggle = renderedComponents[1]
const noteForm = renderedComponents[2]

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      name="description"
      content="Naos Declarative Shadow DOM demo with delayed custom element upgrade."
    />
    <title>Naos Declarative Shadow DOM demo</title>
    <link rel="stylesheet" href="/src/demo.css" />
  </head>
  <body data-demo-mode="dsd">
    <header class="site-header">
      <p class="eyebrow">Naos DSD demo</p>
      <h1>Declarative Shadow DOM before JavaScript upgrade.</h1>
      <p class="intro">
        This page is generated from the same <code>.wc.tsx</code> sources as the
        client demo. The browser parses the shadow roots, scoped styles, slots,
        and supported initial values before the custom elements are defined.
      </p>
      <nav class="demo-nav" aria-label="Demo pages">
        <a href="./">Vite build</a>
        <a href="./dsd.html">Static DSD</a>
        <a href="./dsd.html?delayUpgrade=1">Delayed upgrade</a>
      </nav>
    </header>

    <main class="demo-layout">
      <section class="demo-case" id="${counter.id}" aria-labelledby="dsd-counter-title">
        <div class="case-copy">
          <p class="case-kicker">DSD use case 01</p>
          <h2 id="dsd-counter-title">Prerendered counter</h2>
          <p>
            Counter proves static initial values, hydration markers, scoped
            styles, and click hydration after delayed JavaScript upgrade.
          </p>
        </div>
        <div class="case-surface">
          ${counter.html}
          <output id="counter-event">Last counter event: none</output>
        </div>
      </section>

      <section class="demo-case" id="${toggle.id}" aria-labelledby="dsd-toggle-title">
        <div class="case-copy">
          <p class="case-kicker">DSD use case 02</p>
          <h2 id="dsd-toggle-title">Prerendered primitive toggle</h2>
          <p>
            Toggle proves primitive contracts, slots, Shadow DOM styles,
            control-flow containers, and post-upgrade event wiring.
          </p>
        </div>
        <div class="case-surface">
          ${toggle.html}
          <output id="toggle-event">Last toggle event: none</output>
        </div>
      </section>
      <section class="demo-case" id="${noteForm.id}" aria-labelledby="dsd-note-form-title">
        <div class="case-copy">
          <h2 id="dsd-note-form-title">Prerendered note form</h2>
        </div>
        <div class="case-surface">
          ${noteForm.html}
          <output id="dsd-note-status" data-status="absent"></output>
        </div>
      </section>
    </main>

    <script type="module">
      import { bindFormStatus } from "@naos-ui/actions"

      const params = new URLSearchParams(window.location.search)
      let upgrade
      window.__naosUpgrade = () => upgrade ??= import("/src/main.ts").then(() => {
        const host = document.querySelector("#dsd-note-form-case demo-note-form")
        const form = host?.shadowRoot?.querySelector("form")
        const output = document.querySelector("#dsd-note-status")
        if (form && output) {
          bindFormStatus(form, (status) => {
            output.dataset.status = status ? (status.pending ? "pending" : "idle") : "absent"
            output.textContent = status ? (status.pending ? "Saving note" : "Ready to save") : ""
          })
        }
      })
      if (!params.has("delayUpgrade")) {
        window.__naosUpgrade()
      }
    </script>
  </body>
</html>
`

writeFileSync(resolve(root, "examples/counter/dsd.html"), html)
