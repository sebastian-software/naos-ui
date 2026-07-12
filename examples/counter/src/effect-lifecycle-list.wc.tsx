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
            <div key={row.id} data-lifecycle-row={row.id}>
              <EffectLifecycleItem lifecycleId={row.id} />
            </div>
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
