import { For, state } from "@naos-ui/core"

import { EffectLifecycleItem } from "./effect-lifecycle-item.wc.tsx"

type LifecycleRow = {
  id: string
}

export function EffectLifecycleList() {
  const rows = state<LifecycleRow[]>([{ id: "a" }, { id: "b" }])

  return (
    <section>
      <div data-lifecycle-list>
        <For each={rows()}>
          {(row) => (
            <EffectLifecycleItem key={row.id} lifecycleId={row.id} />
          )}
        </For>
      </div>
      <button
        data-lifecycle-reorder
        onClick={() => {
          rows.set([...rows()].reverse())
        }}
      >
        Reorder lifecycle items
      </button>
    </section>
  )
}
