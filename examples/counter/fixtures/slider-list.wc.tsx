import { For, state } from "@naos-ui/core"
import "@naos-ui/primitives/slider"

export function SliderList() {
  const rows = state(["volume"])
  return (
    <section>
      <button onClick={() => rows.set(rows().length ? [] : ["volume"])}>Toggle row</button>
      <For each={rows()}>
        {(row) => (
          <div key={row}>
            <naos-slider label={row} />
          </div>
        )}
      </For>
    </section>
  )
}
