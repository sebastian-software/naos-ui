import { clx, state } from "@naos-ui/core"

export function StyleProbe() {
  const active = state(false)
  const level = state(0)

  return (
    <section part="root">
      <span
        data-style-probe-chip
        class={clx("chip", active() && "chip--active", { "chip--idle": !active() })}
      >
        Chip
      </span>
      <div
        data-style-probe-meter
        style={{
          "--probe-level": String(level()),
          opacity: active() ? "0.5" : false,
        }}
      >
        Meter
      </div>
      <button data-style-probe-toggle onClick={() => active.set(!active())}>
        Toggle
      </button>
      <button data-style-probe-raise onClick={() => level.set(level() + 1)}>
        Raise
      </button>
    </section>
  )
}
