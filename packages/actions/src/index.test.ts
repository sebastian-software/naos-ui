import { describe, expect, it, vi } from "vitest"

import { action, bindAction, formAction, isNaosFormAction } from "./index.js"

describe("action", () => {
  it("commits reducer results and reports them through state and data", async () => {
    const counter = action((previous: number, step: number) => previous + step, 0)

    await expect(counter.submit(2)).resolves.toBe(2)
    await expect(counter.submit(3)).resolves.toBe(5)

    expect(counter.state()).toBe(5)
    expect(counter.data()).toBe(5)
    expect(counter.error()).toBeUndefined()
    expect(counter.pending()).toBe(false)
  })

  it("runs submissions sequentially and hands each the committed predecessor state", async () => {
    const order: string[] = []
    let releaseFirst: () => void = () => {}
    const sequential = action(async (previous: string[], label: string) => {
      order.push(`start:${label}:${previous.join("+") || "none"}`)
      if (label === "first") {
        await new Promise<void>((resolve) => {
          releaseFirst = resolve
        })
      }
      order.push(`end:${label}`)
      return [...previous, label]
    }, [] as string[])

    const first = sequential.submit("first")
    const second = sequential.submit("second")
    expect(sequential.pending()).toBe(true)

    await Promise.resolve()
    releaseFirst()
    await expect(first).resolves.toEqual(["first"])
    await expect(second).resolves.toEqual(["first", "second"])

    expect(order).toEqual([
      "start:first:none",
      "end:first",
      "start:second:first",
      "end:second",
    ])
    expect(sequential.pending()).toBe(false)
  })

  it("reports thrown errors and keeps the previous committed state", async () => {
    const failure = new Error("save failed")
    const failing = action((previous: number) => {
      if (previous >= 1) throw failure
      return previous + 1
    }, 0)

    await failing.submit()
    await expect(failing.submit()).rejects.toBe(failure)

    expect(failing.error()).toBe(failure)
    expect(failing.state()).toBe(1)

    await expect(failing.submit()).rejects.toBe(failure)
    expect(failing.state()).toBe(1)
  })

  it("provides an AbortSignal per invocation and aborts it on reset", async () => {
    let observedSignal: AbortSignal | null = null
    const slow = action(async (_previous: string, _payload: void, { signal }) => {
      observedSignal = signal
      await new Promise<void>((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), {
          once: true,
        })
      })
      return "never"
    }, "initial")

    const pending = slow.submit().catch((error: unknown) => error)
    await Promise.resolve()
    expect(observedSignal).not.toBeNull()
    expect(observedSignal!.aborted).toBe(false)

    slow.reset()
    expect(observedSignal!.aborted).toBe(true)
    const settled = await pending
    expect((settled as DOMException).name).toBe("AbortError")
    expect(slow.state()).toBe("initial")
    expect(slow.error()).toBeUndefined()
    expect(slow.pending()).toBe(false)
  })

  it("aborts in-flight work on dispose and rejects later submissions", async () => {
    let observedSignal: AbortSignal | null = null
    const disposable = action(async (_previous: number, _payload: void, { signal }) => {
      observedSignal = signal
      await new Promise<void>((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), {
          once: true,
        })
      })
      return 1
    }, 0)

    const pending = disposable.submit().catch(() => "aborted")
    await Promise.resolve()
    disposable.dispose()

    expect(observedSignal!.aborted).toBe(true)
    await expect(pending).resolves.toBe("aborted")
    await expect(disposable.submit()).rejects.toThrow("disposed action")
  })

  it("notifies subscribers on pending transitions and settlements", async () => {
    const events: Array<{ pending: boolean; state: number }> = []
    const counted = action((previous: number) => previous + 1, 0)

    const cleanup = bindAction(counted, ({ pending, state }) => {
      events.push({ pending, state })
    })

    await counted.submit()
    cleanup()
    await counted.submit()

    expect(events[0]).toEqual({ pending: false, state: 0 })
    expect(events).toContainEqual({ pending: true, state: 0 })
    expect(events).toContainEqual({ pending: false, state: 1 })
    expect(events.at(-1)).toEqual({ pending: false, state: 1 })
  })

  it("reports settlements through onSettled", async () => {
    const settlements: Array<{ error?: unknown; state: unknown }> = []
    const failure = new Error("nope")
    const observed = action(
      (previous: number, step: number) => {
        if (step < 0) throw failure
        return previous + step
      },
      0,
      { onSettled: (result) => settlements.push(result) }
    )

    await observed.submit(2)
    await observed.submit(-1).catch(() => {})

    expect(settlements).toEqual([{ state: 2 }, { error: failure, state: 2 }])
  })
})

describe("formAction", () => {
  function setupForm(html: string) {
    document.body.innerHTML = `<form>${html}</form>`
    const form = document.querySelector("form")
    if (!form) throw new Error("Missing test form.")
    return form
  }

  it("routes valid submits through the reducer with the form data", async () => {
    const form = setupForm(`<input name="note" value="ship it"><button>Save</button>`)
    const saved: string[] = []
    const save = formAction(async (previous: number, formData) => {
      saved.push(String(formData.get("note")))
      return previous + 1
    }, 0)

    const cleanup = save.enhance(form)
    const event = new Event("submit", { bubbles: true, cancelable: true })
    form.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    await vi.waitFor(() => {
      expect(save.state()).toBe(1)
    })
    expect(saved).toEqual(["ship it"])
    cleanup()

    const afterCleanup = new Event("submit", { bubbles: true, cancelable: true })
    form.dispatchEvent(afterCleanup)
    expect(afterCleanup.defaultPrevented).toBe(false)
  })

  it("leaves invalid forms to native constraint validation", () => {
    const form = setupForm(`<input name="note" required><button>Save</button>`)
    const reducer = vi.fn((previous: number) => previous + 1)
    const save = formAction(reducer, 0)

    save.enhance(form)
    const event = new Event("submit", { bubbles: true, cancelable: true })
    form.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(false)
    expect(reducer).not.toHaveBeenCalled()
  })

  it("is brand-detectable without importing the package", () => {
    const save = formAction((previous: number) => previous, 0)
    expect(isNaosFormAction(save)).toBe(true)
    expect(isNaosFormAction(action((previous: number) => previous, 0))).toBe(false)
    expect(isNaosFormAction("/api/save")).toBe(false)
    expect(
      (save as unknown as Record<PropertyKey, unknown>)[Symbol.for("naos.form.action")]
    ).toBe(true)
  })

  it("removes form listeners on dispose", () => {
    const form = setupForm(`<input name="note" value="x"><button>Save</button>`)
    const reducer = vi.fn((previous: number) => previous + 1)
    const save = formAction(reducer, 0)

    save.enhance(form)
    save.dispose()

    const event = new Event("submit", { bubbles: true, cancelable: true })
    form.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
    expect(reducer).not.toHaveBeenCalled()
  })
})
