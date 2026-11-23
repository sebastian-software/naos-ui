export const jumpMarkup =
  "<lab-jump-list><button>Rome</button><button disabled>Évora</button><button>Évian</button><button>Essen</button><button>Berlin</button></lab-jump-list>"

export function splitMarkup(variant) {
  if (variant === "split" || variant === "splitProbe") {
    return '<lab-split-view id="split" data-record><button slot="sidebar">Files</button><p>Document</p></lab-split-view>'
  }
  const [root, panel, divider] =
    variant === "namedSplit"
      ? ["lab-panels", "lab-pane", "lab-divider"]
      : ["ui-resizable", "ui-resizable-panel", "ui-resizable-handle"]
  return `<div id="bare"><${root} id="split" data-record>
    <${panel} id="sidebar" default-size="30" min-size="15" collapsible><button>Files</button></${panel}>
    <${divider} aria-label="Resize sidebar" style="width:10px;background:#687686;cursor:col-resize"></${divider}>
    <${panel} id="main" min-size="25">Document</${panel}>
  </${root}></div>`
}

export function popoverMarkup(tag, children) {
  return `<${tag} id="outer" label="Open outer" data-record>${children}</${tag}><button id="outside">Outside</button>`
}

export function pageMarkup(markup, variant) {
  const script = variant ? `<script defer src="./${variant}.js"></script>` : ""
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>Naos UI SDK experiment</title>
    <style>body{margin:24px;font:16px system-ui}#outside{position:fixed;bottom:10px;right:10px}lab-split-view,#bare{display:block;width:min(800px,100%)}</style>
    ${script}<body>${markup}</body></html>`
}

export function selectMarkup(variant) {
  const tag = variant === "zagSelect" ? "naos-select" : "lab-select"
  return `<form><fieldset><${tag} name="city" label="City" value="berlin">
    <naos-select-item value="berlin" label="Berlin"></naos-select-item>
    <naos-select-item value="bonn" label="Bonn" disabled></naos-select-item>
    <naos-select-item value="essen" label="Essen"></naos-select-item>
  </${tag}></fieldset></form>`
}
