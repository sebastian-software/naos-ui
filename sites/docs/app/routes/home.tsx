import type { MetaFunction } from "react-router"
import config from "virtual:ardo/config"

export const meta: MetaFunction = () => [
  { title: "Iktia" },
  {
    name: "description",
    content:
      "React-like TSX authoring for native Custom Elements without a React runtime.",
  },
]

function withBase(path: string): string {
  const base = config.base?.replace(/\/?$/, "/") ?? "/"
  return `${base}${path.replace(/^\//, "")}`
}

export default function HomePage() {
  return (
    <main className="iktia-home">
      <section className="iktia-hero">
        <p className="iktia-eyebrow">v0.1 prerelease docs</p>
        <h1>React-like TSX authoring. Native Custom Element output.</h1>
        <p>
          Write typed component functions. Ship platform-native Web Components
          with Shadow DOM, events, slots, and static HTML output when you
          prerender.
        </p>
        <div className="iktia-actions">
          <a className="iktia-action" data-primary="true" href={withBase("guide/getting-started")}>
            Get started
          </a>
          <a className="iktia-action" href={withBase("reference/api")}>
            API reference
          </a>
          <a className="iktia-action" href={withBase("demos/")}>
            Static demos
          </a>
        </div>
      </section>

      <section className="iktia-grid" aria-label="Iktia documentation areas">
        <article className="iktia-card">
          <h2>Authoring</h2>
          <p>
            Use <code>state()</code>, <code>computed()</code>,{" "}
            <code>effect()</code>, typed events, explicit listeners, host
            lifecycle access, and keyed <code>.map()</code> lists.
          </p>
        </article>
        <article className="iktia-card">
          <h2>Native output</h2>
          <p>
            The public result is Custom Elements with Shadow DOM, parts, slots,
            CSS custom properties, and Declarative Shadow DOM in prerendered
            HTML.
          </p>
        </article>
        <article className="iktia-card">
          <h2>Small boundary</h2>
          <p>
            Vite owns the module graph. <code>@iktia/runtime</code> stays a tiny
            helper package for events, scheduling, and hydration support.
          </p>
        </article>
      </section>
    </main>
  )
}
