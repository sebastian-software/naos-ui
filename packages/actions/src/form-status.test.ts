import { describe, expect, it } from "vitest"

import { bindFormStatus, formAction, getFormStatus, type NaosFormStatus } from "./index.js"

describe("form action status", () => {
  it("reports registration, pending, and cleanup for the resolved form", async () => {
    const form = document.createElement("form")
    const consumer = document.createElement("span")
    form.append(consumer)
    let finish = () => {}
    const action = formAction(async () => {
      await new Promise<void>((resolve) => {
        finish = resolve
      })
      return true
    }, false)
    const statuses: Array<NaosFormStatus | null> = []
    const stop = bindFormStatus(consumer, (status) => statuses.push(status))

    expect(getFormStatus(consumer)).toBeNull()
    const unenhance = action.enhance(form)
    expect(getFormStatus(consumer)).toEqual({ pending: false })
    const submission = action.submit(new FormData())
    expect(getFormStatus(consumer)).toEqual({ pending: true })
    await Promise.resolve()
    finish()
    await submission
    unenhance()
    expect(statuses).toEqual([
      null,
      { pending: false },
      { pending: true },
      { pending: false },
      null,
    ])

    stop()
    action.enhance(form)
    action.dispose()
    expect(getFormStatus(consumer)).toBeNull()
    expect(statuses).toHaveLength(5)
  })

  it("uses a native submitter's external form owner and supports explicit rebind", () => {
    document.body.innerHTML = `
      <form id="one"></form>
      <form id="two"></form>
      <button form="one">Submit</button>
    `
    const one = document.querySelector<HTMLFormElement>("#one")!
    const two = document.querySelector<HTMLFormElement>("#two")!
    const button = document.querySelector("button")!
    const first = formAction(() => 1, 0)
    const second = formAction(() => 2, 0)
    first.enhance(one)
    second.enhance(two)

    const explicit: Array<NaosFormStatus | null> = []
    const stop = bindFormStatus(button, (status) => explicit.push(status))
    first.dispose()
    expect(explicit).toEqual([{ pending: false }, null])
    expect(getFormStatus(button)).toBeNull()

    stop()
    button.setAttribute("form", "missing")
    expect(getFormStatus(button)).toBeNull()
    button.removeAttribute("form")
    two.append(button)
    const implicit: Array<NaosFormStatus | null> = []
    const stopImplicit = bindFormStatus(button, (status) => implicit.push(status))
    expect(implicit).toEqual([{ pending: false }])
    stopImplicit()
    second.dispose()
    expect(implicit).toHaveLength(1)
    document.body.replaceChildren()
  })

  it("finds a form across nested shadow roots and stops at a native form", () => {
    const form = document.createElement("form")
    const action = formAction(() => true, false)
    action.enhance(form)
    const outerHost = document.createElement("div")
    form.append(outerHost)
    const outerRoot = outerHost.attachShadow({ mode: "closed" })
    const innerHost = document.createElement("div")
    outerRoot.append(innerHost)
    const innerRoot = innerHost.attachShadow({ mode: "open" })
    const consumer = document.createElement("span")
    innerRoot.append(consumer)
    expect(getFormStatus(consumer)).toEqual({ pending: false })

    const native = document.createElement("form")
    innerRoot.append(native)
    native.append(consumer)
    expect(getFormStatus(consumer)).toBeNull()
    expect(getFormStatus(document.createElement("span"))).toBeNull()
    action.dispose()
  })

  it("falls through to the next enhancement where an earlier one was removed", async () => {
    const form = document.createElement("form")
    const first = formAction(() => 1, 0)
    const second = formAction(() => 2, 0)
    const removeFirst = first.enhance(form)
    second.enhance(form)
    const statuses: Array<NaosFormStatus | null> = []
    const stop = bindFormStatus(form, (status) => statuses.push(status))
    removeFirst()
    await second.submit(new FormData())
    expect(statuses).toEqual([{ pending: false }, { pending: true }, { pending: false }])
    first.dispose()
    second.dispose()
    expect(statuses.at(-1)).toBeNull()
    stop()
  })
})
