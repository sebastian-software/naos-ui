// @vitest-environment happy-dom
import { mount } from "@naos-ui/testing"
import { describe, expect, it } from "vitest"

import "../dist/button.mjs"

describe("naos-button through @naos-ui/testing", () => {
  it("mounts with initial props and exposes its parts", async () => {
    const component = await mount("naos-button", {
      props: { label: "Send" },
    })

    const control = component.queryPart<HTMLButtonElement>("control")
    expect(control).not.toBeNull()
    expect(control?.textContent).toContain("Send")
    expect(control?.dataset.variant).toBe("default")
    component.unmount()
  })

  it("updates rendered output when props change", async () => {
    const component = await mount("naos-button", {
      props: { label: "Send" },
    })

    await component.setProps({ label: "Submit", variant: "primary" })

    const control = component.queryPart<HTMLButtonElement>("control")
    expect(control?.textContent).toContain("Submit")
    expect(control?.dataset.variant).toBe("primary")
    component.unmount()
  })

  it("emits a typed naos-press event on activation", async () => {
    const component = await mount("naos-button", {
      props: { label: "Send", variant: "primary" },
    })
    const presses = component.capture<{ variant: string }>("naos-press")

    component.queryPart<HTMLButtonElement>("control")?.click()

    expect(presses.count).toBe(1)
    expect(presses.last?.detail.variant).toBe("primary")
    component.unmount()
  })

  it("suppresses activation while disabled", async () => {
    const component = await mount("naos-button", {
      props: { disabled: true, label: "Send" },
    })
    const presses = component.capture("naos-press")

    const control = component.queryPart<HTMLButtonElement>("control")
    expect(control?.disabled).toBe(true)
    control?.click()

    expect(presses.count).toBe(0)
    component.unmount()
  })
})
