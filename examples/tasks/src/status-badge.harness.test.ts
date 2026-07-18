// @vitest-environment happy-dom
import { mount } from "@naos-ui/testing"
import { describe, expect, it } from "vitest"

import "./status-badge.wc.tsx"

describe("tasks-status-badge through @naos-ui/testing", () => {
  it("renders the open state by default", async () => {
    const component = await mount("tasks-status-badge")

    const badge = component.queryPart("badge")
    expect(badge?.textContent).toBe("Open")
    expect(badge?.getAttribute("data-status")).toBe("open")
    component.unmount()
  })

  it("re-renders when the status prop changes", async () => {
    const component = await mount("tasks-status-badge", {
      props: { taskStatus: "done" },
    })

    expect(component.queryPart("badge")?.textContent).toBe("Done")

    await component.setProps({ taskStatus: "open" })
    expect(component.queryPart("badge")?.textContent).toBe("Open")
    component.unmount()
  })
})
