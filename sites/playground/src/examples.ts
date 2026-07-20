export type PlaygroundExample = {
  id: string
  label: string
  description: string
  source: string
}

const counterExample = `import { clx, computed, state } from "@naos-ui/core"

export const options = {
  styles: [
    \`
    button {
      display: inline-flex;
      align-items: center;
      gap: 0.6rem;
      border: 0;
      border-radius: 999px;
      padding: 0.7rem 1.5rem;
      background: #0f766e;
      color: #ffffff;
      font: 600 1rem/1 system-ui, sans-serif;
      cursor: pointer;
      transition: background 150ms ease, transform 150ms ease;
    }
    button:hover { background: #115e59; }
    button:active { transform: scale(0.96); }
    .badge {
      display: inline-grid;
      place-items: center;
      min-width: 1.7rem;
      height: 1.7rem;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.25);
      font-size: 0.85rem;
      transition: background 150ms ease;
    }
    button.active .badge { background: #f59e0b; color: #451a03; }
    \`,
  ],
}

export function Counter({ label = "Count" }) {
  const count = state(0)
  const doubled = computed(() => count() * 2)

  return (
    <button
      class={clx({ active: count() > 0 })}
      style={{ "--count": String(count()) }}
      title={\`Doubled: \${doubled()}\`}
      onClick={() => count.update((value) => value + 1)}
    >
      {label}
      <span class="badge">{count()}</span>
    </button>
  )
}
`

const conditionalExample = `import { Match, Show, Switch, state } from "@naos-ui/core"

export const options = {
  styles: [
    \`
    :host { font: 0.95rem/1.5 system-ui, sans-serif; color: #0f172a; }
    section { display: grid; gap: 0.75rem; justify-items: center; }
    button {
      border: 1px solid #0f766e;
      border-radius: 0.4rem;
      padding: 0.45rem 1rem;
      background: #ffffff;
      color: #0f766e;
      font-weight: 600;
      cursor: pointer;
    }
    p { margin: 0; padding: 0.5rem 1rem; border-radius: 0.4rem; }
    p[data-tone="idle"] { background: #e2e8f0; }
    p[data-tone="loading"] { background: #fef3c7; }
    p[data-tone="done"] { background: #ccfbf1; }
    em { color: #64748b; }
    \`,
  ],
}

export function StatusFlow() {
  const step = state(0)

  return (
    <section>
      <button onClick={() => step.update((value) => (value + 1) % 4)}>
        Next state
      </button>
      <Switch>
        <Match when={step() === 1}>
          <p data-tone="loading">Loading...</p>
        </Match>
        <Match when={step() === 2}>
          <p data-tone="done">Done - data is ready.</p>
        </Match>
        <Match>
          <p data-tone="idle">Idle - press the button.</p>
        </Match>
      </Switch>
      <Show when={step() === 3} fallback={<em>Step 3 reveals a bonus.</em>}>
        <strong>Bonus content unlocked!</strong>
      </Show>
    </section>
  )
}
`

const listExample = `import { For, state } from "@naos-ui/core"

export const options = {
  styles: [
    \`
    :host { font: 0.95rem/1.4 system-ui, sans-serif; }
    section { display: grid; gap: 0.75rem; justify-items: center; }
    button {
      border: 1px solid #0f766e;
      border-radius: 0.4rem;
      padding: 0.45rem 1rem;
      background: #0f766e;
      color: white;
      font-weight: 600;
      cursor: pointer;
    }
    ul { display: grid; gap: 0.4rem; margin: 0; padding: 0; list-style: none; }
    li {
      border: 1px solid #d7dde5;
      border-radius: 0.4rem;
      padding: 0.45rem 1.2rem;
      background: #ffffff;
      text-align: center;
    }
    \`,
  ],
}

export function ShuffleList() {
  const items = state([
    { id: "alpha", label: "Alpha" },
    { id: "beta", label: "Beta" },
    { id: "gamma", label: "Gamma" },
    { id: "delta", label: "Delta" },
  ])

  return (
    <section>
      <button
        onClick={() =>
          items.update((current) => [...current].sort(() => Math.random() - 0.5))
        }
      >
        Shuffle
      </button>
      <ul>
        <For each={items()} motion="flip">
          {(item) => <li key={item.id}>{item.label}</li>}
        </For>
      </ul>
    </section>
  )
}
`

const eventsExample = `import { event, state } from "@naos-ui/core"

export const options = {
  styles: [
    \`
    :host { font: 0.95rem/1.5 system-ui, sans-serif; }
    section { display: grid; gap: 0.6rem; justify-items: center; }
    button {
      border: 0;
      border-radius: 0.4rem;
      padding: 0.5rem 1.2rem;
      background: #0f766e;
      color: white;
      font-weight: 600;
      cursor: pointer;
    }
    output { color: #475569; font-size: 0.85rem; }
    \`,
  ],
}

export function Announcer() {
  const sent = state(0)
  // Dispatches a bubbling, typed CustomEvent host consumers can listen to:
  // element.addEventListener("announce", (event) => event.detail)
  const announce = event<number>("announce")

  return (
    <section>
      <button
        onClick={() => {
          sent.update((value) => value + 1)
          announce.emit(sent())
        }}
      >
        Emit typed event
      </button>
      <output>Dispatched {sent()} "announce" events - inspect them in devtools.</output>
    </section>
  )
}
`

const tracingExample = `import { computed, inspect, state } from "@naos-ui/core"

export const options = {
  styles: [
    \`
    :host { font: 0.95rem/1.5 system-ui, sans-serif; }
    section { display: grid; gap: 0.6rem; justify-items: center; }
    button {
      border: 0;
      border-radius: 0.4rem;
      padding: 0.5rem 1.2rem;
      background: #0f766e;
      color: white;
      font-weight: 600;
      cursor: pointer;
    }
    em { color: #64748b; font-size: 0.85rem; }
    \`,
  ],
}

export function TracedCounter() {
  const count = state(0)
  const squared = computed(() => count() * count())

  // Dev-only reactive tracing: logs on mount and whenever a source changes.
  // Open the browser console to watch it fire.
  inspect(count(), squared())

  return (
    <section>
      <button onClick={() => count.update((value) => value + 1)}>
        Increment ({count()})
      </button>
      <em>Open the devtools console to see inspect() tracing.</em>
    </section>
  )
}
`

export const examples: readonly PlaygroundExample[] = [
  {
    id: "counter",
    label: "Counter - state & scoped styles",
    description: "state(), computed(), clx() classes, style objects, and options.styles.",
    source: counterExample,
  },
  {
    id: "conditional",
    label: "Conditional views - Show & Switch",
    description: "Explicit <Show> fallback plus first-match-wins <Switch>/<Match> arms.",
    source: conditionalExample,
  },
  {
    id: "list-flip",
    label: "Keyed list - FLIP motion",
    description: '<For motion="flip"> animates keyed reorders through @naos-ui/motion.',
    source: listExample,
  },
  {
    id: "events",
    label: "Typed events",
    description: "event<Detail>() dispatches typed, bubbling CustomEvents from the host.",
    source: eventsExample,
  },
  {
    id: "tracing",
    label: "Dev tracing - inspect()",
    description: "Dev-only reactive console tracing on the dependency-gated update path.",
    source: tracingExample,
  },
]
