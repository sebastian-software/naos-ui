import { useState } from "react"
import type { MetaFunction } from "react-router"
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Blocks,
  Box,
  Check,
  Copy,
  Cpu,
  Feather,
  FileCode,
  Layers,
  PackageCheck,
} from "lucide-react"
import config from "virtual:ardo/config"

export const meta: MetaFunction = () => [
  { title: "Naos" },
  {
    name: "description",
    content:
      "React-like TSX authoring for native Custom Elements with a small shared runtime kernel instead of a React runtime.",
  },
]

function withBase(path: string): string {
  const base = config.base?.replace(/\/?$/, "/") ?? "/"
  return `${base}${path.replace(/^\//, "")}`
}

const INSTALL_COMMAND = "pnpm add @naos-ui/core @naos-ui/runtime"

/**
 * One highlighted code token: a token class suffix (`tk-<cls>`) or null for
 * plain text. Hand-tokenized so the hero ships zero highlighting runtime.
 */
type CodeToken = [cls: string | null, text: string]

const counterCode: CodeToken[][] = [
  [
    ["k", "import"],
    [null, " { event, state } "],
    ["k", "from"],
    ["s", ' "@naos-ui/core"'],
  ],
  [],
  [
    ["k", "export function"],
    ["f", " Counter"],
    [null, "({ "],
    ["a", "label"],
    [null, " = "],
    ["s", '"Count"'],
    [null, " } = {}) {"],
  ],
  [
    ["k", "  const"],
    [null, " count = "],
    ["f", "state"],
    [null, "("],
    ["n", "0"],
    [null, ")"],
  ],
  [
    ["k", "  const"],
    [null, " change = "],
    ["f", "event"],
    [null, "<"],
    ["y", "number"],
    [null, ">("],
    ["s", '"change"'],
    [null, ")"],
  ],
  [],
  [
    ["k", "  return"],
    [null, " ("],
  ],
  [
    [null, "    <"],
    ["t", "button"],
  ],
  [
    ["a", "      part"],
    [null, "="],
    ["s", '"button"'],
  ],
  [
    ["a", "      onClick"],
    [null, "={() => {"],
  ],
  [
    [null, "        count."],
    ["f", "update"],
    [null, "((value) => value + "],
    ["n", "1"],
    [null, ")"],
  ],
  [
    [null, "        change."],
    ["f", "emit"],
    [null, "(count())"],
  ],
  [[null, "      }}"]],
  [[null, "    >"]],
  [[null, "      {label}: {count()}"]],
  [
    [null, "    </"],
    ["t", "button"],
    [null, ">"],
  ],
  [[null, "  )"]],
  [[null, "}"]],
]

const hostCode: CodeToken[][] = [
  [["c", "<!-- any framework — or no framework at all -->"]],
  [
    [null, "<"],
    ["t", "app-counter"],
    ["a", " label"],
    [null, "="],
    ["s", '"Clicks"'],
    [null, "></"],
    ["t", "app-counter"],
    [null, ">"],
  ],
  [
    [null, "<"],
    ["t", "script"],
    ["a", " type"],
    [null, "="],
    ["s", '"module"'],
    ["a", " src"],
    [null, "="],
    ["s", '"/counter.js"'],
    [null, "></"],
    ["t", "script"],
    [null, ">"],
  ],
]

const pipeline = [
  {
    icon: FileCode,
    title: "Author",
    text: "Write typed PascalCase component functions with state(), computed(), and typed events — a strict, React-like TSX subset.",
  },
  {
    icon: Cpu,
    title: "Compile",
    text: "The Rust/OXC compiler analyzes your TSX and generates native Custom Element modules. No virtual DOM anywhere in the output.",
  },
  {
    icon: PackageCheck,
    title: "Ship",
    text: "Deliver real Custom Elements with Shadow DOM, slots, and Declarative Shadow DOM prerendering. Consumers share a small runtime kernel, not a framework.",
  },
]

const features = [
  {
    icon: Box,
    title: "Native Custom Elements",
    text: "Shadow DOM, slots, part, CSS custom properties, form association. One tag that works wherever HTML works.",
  },
  {
    icon: Feather,
    title: "Small shared runtime",
    text: "A tree-shakeable kernel handles lifecycle, updates, styles, and DOM spreads. The complete internal kernel is about 6 kB gzip — not a framework runtime.",
  },
  {
    icon: Activity,
    title: "Signals reactivity",
    text: "state(), computed(), and effect() update exactly what changed. No re-render cycles, no reconciliation passes.",
  },
  {
    icon: Cpu,
    title: "Rust-powered compiler",
    text: "A Rust/OXC core behind a thin TypeScript surface: fast parses, precise diagnostics, and a typed N-API boundary.",
  },
  {
    icon: Layers,
    title: "Prerender & DSD",
    text: "Static HTML with <template shadowrootmode> by default — markup that renders before JavaScript and hydrates on upgrade.",
  },
  {
    icon: Blocks,
    title: "Every stack welcome",
    text: "React, Vue, Angular, CMS pages, plain HTML. Build a component once, consume it as a native element everywhere.",
  },
]

const comparisons = [
  {
    slug: "stencil",
    name: "vs. Stencil",
    line: "The closest neighbor — but Naos drops the virtual DOM entirely and authors with functions and signals instead of classes and decorators.",
  },
  {
    slug: "lit",
    name: "vs. Lit",
    line: "Same native-element output, with a small shared kernel instead of a template runtime: JSX and signals instead of tagged templates and reactive properties.",
  },
  {
    slug: "solid",
    name: "vs. Solid",
    line: "The same signals you would reach for in Solid — except the Custom Element is the primary output, not an app rendered into a page.",
  },
  {
    slug: "gea",
    name: "vs. Gea",
    line: "Nearly the same pitch, opposite core: Gea patches plain DOM as an app framework; Naos compiles to real Custom Elements.",
  },
  {
    slug: "react",
    name: "vs. React",
    line: "Not a rival — a complement. Build components in Naos, consume them in React (and everything else), with a small shared kernel instead of a framework runtime.",
  },
]

function CodeLines({ lines }: { lines: CodeToken[][] }) {
  return (
    <pre>
      <code>
        {lines.map((line, lineIndex) => (
          <span key={lineIndex} className="naos-code-line">
            {line.map(([cls, text], tokenIndex) =>
              cls === null ? (
                text
              ) : (
                <span key={tokenIndex} className={`tk-${cls}`}>
                  {text}
                </span>
              ),
            )}
            {"\n"}
          </span>
        ))}
      </code>
    </pre>
  )
}

function CodeWindow({
  file,
  lines,
  badge,
  className,
}: {
  file: string
  lines: CodeToken[][]
  badge?: string
  className?: string
}) {
  return (
    <figure className={`naos-window ${className ?? ""}`}>
      <figcaption className="naos-window-bar">
        <span className="naos-window-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="naos-window-file">{file}</span>
        {badge === undefined ? null : <span className="naos-window-badge">{badge}</span>}
      </figcaption>
      <CodeLines lines={lines} />
    </figure>
  )
}

function InstallCommand() {
  const [copied, setCopied] = useState(false)

  return (
    <div className="naos-install">
      <span className="naos-install-prompt" aria-hidden="true">
        $
      </span>
      <code>{INSTALL_COMMAND}</code>
      <button
        type="button"
        className="naos-install-copy"
        aria-label={copied ? "Copied" : "Copy install command"}
        onClick={() => {
          void navigator.clipboard
            ?.writeText(INSTALL_COMMAND)
            .then(() => {
              setCopied(true)
              window.setTimeout(() => {
                setCopied(false)
              }, 2000)
            })
            .catch(() => {
              /* Permission denied — the command stays selectable for manual copy. */
            })
        }}
      >
        {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
      </button>
    </div>
  )
}

export default function HomePage() {
  return (
    <main className="naos-home">
      <section className="naos-hero">
        <div className="naos-container naos-hero-inner">
          <div className="naos-hero-copy">
            <p className="naos-pill">
              <span className="naos-pill-dot" aria-hidden="true" />
              v0.1 prerelease — Rust/OXC compiler
            </p>
            <h1>
              <span className="naos-nowrap">React-like</span> TSX in.
              <br />
              <span className="naos-gradient-text">Native elements out.</span>
            </h1>
            <p className="naos-hero-lead">
              Naos compiles typed component functions into platform-native Web Components — Shadow
              DOM, slots, events, and static HTML when you prerender. No virtual DOM. A small shared
              runtime kernel, not a framework runtime.
            </p>
            <div className="naos-hero-actions">
              <a
                className="naos-btn"
                data-variant="primary"
                href={withBase("guide/getting-started")}
              >
                Get started
                <ArrowRight size={17} aria-hidden="true" />
              </a>
              <a className="naos-btn" data-variant="secondary" href={withBase("playground/")}>
                Open the playground
              </a>
            </div>
            <InstallCommand />
            <dl className="naos-hero-stats">
              <div>
                <dt>≈6 kB</dt>
                <dd>gzip for the complete shared runtime kernel</dd>
              </div>
              <div>
                <dt>1×</dt>
                <dd>authored — runs in every stack, or none</dd>
              </div>
              <div>
                <dt>100%</dt>
                <dd>platform output: real Custom Elements</dd>
              </div>
            </dl>
          </div>
          <div className="naos-hero-code">
            <CodeWindow file="counter.wc.tsx" lines={counterCode} />
            <CodeWindow
              file="index.html"
              lines={hostCode}
              badge="shared runtime"
              className="naos-window-host"
            />
          </div>
        </div>
      </section>

      <section className="naos-section naos-pipeline" aria-label="How Naos works">
        <div className="naos-container">
          <p className="naos-eyebrow">How it works</p>
          <h2>From typed functions to platform code.</h2>
          <ol className="naos-pipeline-grid">
            {pipeline.map((step, index) => (
              <li key={step.title} className="naos-step">
                <span className="naos-step-index" aria-hidden="true">
                  {index + 1}
                </span>
                <span className="naos-step-icon" aria-hidden="true">
                  <step.icon size={22} />
                </span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="naos-section naos-features" aria-label="Why Naos">
        <div className="naos-container">
          <p className="naos-eyebrow">Why Naos</p>
          <h2>The platform is the framework.</h2>
          <p className="naos-section-lead">
            Everything Naos generates is standard browser technology. Your components do not depend
            on Naos being fashionable in five years — only on the web platform still existing.
          </p>
          <div className="naos-feature-grid">
            {features.map((feature) => (
              <article key={feature.title} className="naos-feature">
                <span className="naos-feature-icon" aria-hidden="true">
                  <feature.icon size={22} />
                </span>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="naos-section naos-compare" aria-label="How Naos compares to other tools">
        <div className="naos-container">
          <p className="naos-eyebrow">Where Naos fits</p>
          <h2>Familiar words, a different core bet.</h2>
          <p className="naos-section-lead">
            Naos shares the "compiler-first, no virtual DOM" vocabulary of today's tools — but it
            compiles to native Custom Elements, ships a small shared runtime rather than a framework
            runtime, and updates with signals. Here is how that lands next to the tools you already
            know.
          </p>
          <div className="naos-compare-grid">
            {comparisons.map((item) => (
              <a
                key={item.slug}
                className="naos-compare-card"
                href={withBase(`comparisons/${item.slug}`)}
              >
                <span className="naos-compare-head">
                  <span className="naos-compare-name">{item.name}</span>
                  <ArrowUpRight size={17} aria-hidden="true" />
                </span>
                <span className="naos-compare-line">{item.line}</span>
              </a>
            ))}
            <a
              className="naos-compare-card"
              data-variant="overview"
              href={withBase("comparisons/overview")}
            >
              <span className="naos-compare-head">
                <span className="naos-compare-name">All comparisons</span>
                <ArrowUpRight size={17} aria-hidden="true" />
              </span>
              <span className="naos-compare-line">
                Side-by-side tables and sourced claims — every statement backed by the other tool's
                own documentation.
              </span>
            </a>
          </div>
        </div>
      </section>

      <section className="naos-cta" aria-label="Get started with Naos">
        <div className="naos-container naos-cta-inner">
          <h2>Build components that outlive the framework.</h2>
          <p>
            If a component should outlive the framework that renders it, author it once in Naos and
            ship it as a native element — instead of rebuilding it for React, Vue, and Angular in
            turn.
          </p>
          <div className="naos-cta-actions">
            <a className="naos-btn" data-variant="inverse" href={withBase("guide/getting-started")}>
              Get started
              <ArrowRight size={17} aria-hidden="true" />
            </a>
            <a className="naos-btn" data-variant="ghost" href={withBase("comparisons/overview")}>
              Read the comparisons
            </a>
          </div>
        </div>
      </section>
    </main>
  )
}
