import { resizable } from "@ui-sdk/core/resizable"
import { createParts } from "@ui-sdk/web"

// SDK owns these elements; Naos-authored leaves can be children of a pane.
createParts(resizable, {
  root: { tag: "lab-panels", display: "block" },
  panel: { tag: "lab-pane", display: "block" },
  handle: { tag: "lab-divider", display: "block" },
})
