import { computed, event, type ComponentOptions } from "@naos-ui/core"
import css from "./progress.wc.css?inline"

export type NaosProgressProps = {
  indeterminate?: boolean
  label?: string
  locale?: string
  max?: number
  min?: number
  orientation?: "horizontal" | "vertical"
  value?: number
}

export const options = {
  styles: [css],
} satisfies ComponentOptions

export function NaosProgress({
  indeterminate = false,
  label = "Progress",
  locale = "en-US",
  max = 100,
  min = 0,
  orientation = "horizontal",
  value = 0,
}: NaosProgressProps = {}) {
  const changed = event<{ value: number | null }>("naos-change")
  void changed

  const current = computed(() =>
    indeterminate ? null : Math.min(Math.max(Number.isFinite(value) ? value : min, min), max),
  )
  const percent = computed(() =>
    max === min ? 0 : (((current() ?? min) - min) / (max - min)) * 100,
  )
  const valueText = computed(() =>
    indeterminate
      ? `${label}: in progress`
      : `${label}: ${new Intl.NumberFormat(locale, { style: "percent" }).format(percent() / 100)}`,
  )
  const state = computed(() =>
    indeterminate ? "indeterminate" : current() === max ? "complete" : "loading",
  )

  return (
    <section
      id="progress-naos-progress"
      part="root"
      data-scope="progress"
      data-part="root"
      data-state={indeterminate ? "indeterminate" : "loading"}
      data-max={max}
      data-value={current() == null ? undefined : String(current())}
      data-orientation={orientation}
      style={{ "--percent": indeterminate ? undefined : percent() }}
    >
      <div
        id="progress-naos-progress-label"
        part="label"
        data-scope="progress"
        data-part="label"
        data-orientation={orientation}
      >
        {label}
      </div>
      <div
        id="progress-naos-progress-track"
        part="track"
        role="progressbar"
        aria-label={valueText()}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={current() ?? undefined}
        data-scope="progress"
        data-part="track"
        data-max={max}
        data-orientation={orientation}
        data-state={state()}
      >
        <div
          part="range"
          data-scope="progress"
          data-part="range"
          data-orientation={orientation}
          data-state={state()}
          style={{
            width: indeterminate || orientation !== "horizontal" ? undefined : `${percent()}%`,
            height: indeterminate || orientation !== "vertical" ? undefined : `${percent()}%`,
          }}
        />
      </div>
      <div part="value" data-scope="progress" data-part="value-text" aria-live="polite">
        {valueText()}
      </div>
    </section>
  )
}
