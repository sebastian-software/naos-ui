import "@ui-sdk/web/resizable"
import type { ResizableEvents } from "@ui-sdk/web/resizable"
import { event, type ComponentOptions } from "@naos-ui/core"

export const options = {
  styles: [
    ":host { display: block } ui-resizable-handle { width: 10px; background: #687686; cursor: col-resize }",
  ],
} satisfies ComponentOptions

export function LabSplitView({ label = "Resize sidebar" }: { label?: string } = {}) {
  const changed = event<number[]>("naos-layout-change")
  return (
    <ui-resizable
      onLayoutchange={(e) => changed.emit((e as ResizableEvents["layoutchange"]).detail.value)}
    >
      <ui-resizable-panel id="sidebar" default-size="30" min-size="15" {...{ collapsible: true }}>
        <slot name="sidebar" />
      </ui-resizable-panel>
      <ui-resizable-handle part="divider" aria-label={label} />
      <ui-resizable-panel id="main" min-size="25">
        <slot />
      </ui-resizable-panel>
    </ui-resizable>
  )
}
