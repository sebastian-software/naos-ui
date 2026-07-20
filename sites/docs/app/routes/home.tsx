import type { MetaFunction } from "react-router"
import config from "virtual:ardo/config"

export const meta: MetaFunction = () => [
  { title: "Naos" },
  {
    name: "description",
    content: "React-like TSX authoring for native Custom Elements without a React runtime.",
  },
]

function withBase(path: string): string {
  const base = config.base?.replace(/\/?$/, "/") ?? "/"
  return `${base}${path.replace(/^\//, "")}`
}

const comparisons = [
  {
    slug: "stencil",
    name: "vs. Stencil",
    line: "The closest neighbor — but Naos drops the virtual DOM entirely and authors with functions and signals instead of classes and decorators.",
  },
  {
    slug: "lit",
    name: "vs. Lit",
    line: "Same native-element output, without the template runtime: a compiler with JSX and signals instead of tagged templates and reactive properties.",
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
    line: "Not a rival — a complement. Build components in Naos, consume them in React (and everything else), with no runtime shipped along.",
  },
]

export default function HomePage() {
  return (
    <main className="naos-home">
      <section className="naos-hero">
        <p className="naos-eyebrow">v0.1 prerelease docs</p>
        <h1>React-like TSX authoring. Native Custom Element output.</h1>
        <p>
          Write typed component functions. Ship platform-native Web Components with Shadow DOM,
          events, slots, and static HTML output when you prerender.
        </p>
        <div className="naos-actions">
          <a className="naos-action" data-primary="true" href={withBase("guide/getting-started")}>
            Get started
          </a>
          <a className="naos-action" href={withBase("reference/api")}>
            API reference
          </a>
          <a className="naos-action" href={withBase("comparisons/overview")}>
            Comparisons
          </a>
          <a className="naos-action" href={withBase("playground/")}>
            Playground
          </a>
          <a className="naos-action" href={withBase("guide/styling-and-dsd")}>
            Styling and DSD
          </a>
          <a className="naos-action" href={withBase("demos/")}>
            Static demos
          </a>
        </div>
      </section>

      <section className="naos-grid" aria-label="Naos documentation areas">
        <article className="naos-card">
          <h2>Learning path</h2>
          <p>
            Start with install and Vite setup, then move through authoring, styling, Declarative
            Shadow DOM, packages, demos, and API details.
          </p>
        </article>
        <article className="naos-card">
          <h2>Authoring</h2>
          <p>
            Use <code>state()</code>, <code>computed()</code>, <code>effect()</code>, typed events,
            explicit listeners, host lifecycle access, and keyed <code>.map()</code> lists.
          </p>
        </article>
        <article className="naos-card">
          <h2>Native output</h2>
          <p>
            The public result is Custom Elements with Shadow DOM, parts, slots, CSS custom
            properties, and Declarative Shadow DOM in prerendered HTML.
          </p>
        </article>
        <article className="naos-card">
          <h2>Small boundary</h2>
          <p>
            Vite owns the module graph. <code>@naos-ui/runtime</code> stays a tiny helper package
            for events, scheduling, and hydration support.
          </p>
        </article>
      </section>

      <section className="naos-compare" aria-label="How Naos compares to other tools">
        <p className="naos-eyebrow">Where Naos fits</p>
        <h2>Familiar words, a different core bet.</h2>
        <p className="naos-compare-lead">
          Naos shares the "compiler-first, no virtual DOM" vocabulary of today's
          tools — but it compiles to native Custom Elements, ships no framework
          runtime, and updates with signals. Here is how that lands next to the
          tools you already know.
        </p>
        <ul className="naos-compare-list">
          {comparisons.map((item) => (
            <li key={item.slug}>
              <a
                className="naos-compare-row"
                href={withBase(`comparisons/${item.slug}`)}
              >
                <span className="naos-compare-name">{item.name}</span>
                <span className="naos-compare-line">{item.line}</span>
              </a>
            </li>
          ))}
        </ul>
        <p className="naos-compare-kicker">
          If a component should outlive the framework that renders it, author it
          once in Naos and ship it as a native element — instead of rebuilding it
          for React, Vue, and Angular in turn.
        </p>
        <div className="naos-actions">
          <a
            className="naos-action"
            data-primary="true"
            href={withBase("comparisons/overview")}
          >
            See all comparisons
          </a>
        </div>
      </section>
    </main>
  )
}
