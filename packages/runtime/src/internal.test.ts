import { describe, expect, it, vi } from "vitest"

import {
  K,
  type Kernel,
  attrChanged,
  computedAccessor,
  connect,
  createKernel,
  defineComponent,
  defineProps,
  disconnect,
  flushSync,
  hostApi,
  listen,
  markAllDirty,
  registerKeyedBinding,
  reconcileKeyed,
  reportError,
  runEffect,
  setAttr,
  shouldUpdate,
  stateAccessor,
  unregisterKeyedBindings,
} from "./internal.js"

class FakeElement extends EventTarget {
  id = ""
  localName = "x-kernel"
  shadowRoot: ShadowRoot | null = null
  attributes = new Map<string, string>()

  attachShadow(): ShadowRoot {
    const root = {} as ShadowRoot
    this.shadowRoot = root
    return root
  }

  getRootNode(): Node {
    return {
      querySelectorAll: () => [this],
    } as unknown as Node
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value)
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name)
  }
}

function kernel(spec: Parameters<typeof createKernel>[1] = {}): Kernel {
  return createKernel(new FakeElement() as unknown as HTMLElement, {
    shadow: false,
    ...spec,
  })
}

describe("shared runtime kernel", () => {
  it("gates updates by full and dirty passes", () => {
    const dirty = new Set(["count"])

    expect(shouldUpdate(["count"], dirty)).toBe(true)
    expect(shouldUpdate(["label"], dirty)).toBe(false)
    expect(shouldUpdate([], dirty)).toBe(false)
    expect(shouldUpdate(null, dirty)).toBe(true)
    expect(shouldUpdate(["label"], null)).toBe(true)
  })

  it("defines data-driven properties and attribute parsing against one kernel record", () => {
    class TestElement extends FakeElement {}
    const instance = new TestElement()
    const instanceKernel = kernel({
      defaults: { count: 0 },
      props: {
        count: {
          attribute: "count",
          source: "count",
          coerce: (value) => Number(value),
          reflect: true,
        },
      },
      attrs: {
        count: { prop: "count", parse: (value) => Number(value ?? 0) },
      },
    })
    instanceKernel.element = instance as unknown as HTMLElement
    ;(instance as unknown as { [K]: Kernel })[K] = instanceKernel
    defineProps(TestElement as unknown as CustomElementConstructor, instanceKernel.spec)
    ;(instance as unknown as { count: number }).count = 4
    expect(instanceKernel.props.count).toBe(4)
    expect(instance.getAttribute("count")).toBe("4")

    attrChanged(instanceKernel, "count", "4", "6")
    expect(instanceKernel.props.count).toBe(6)
  })

  it("uses the compiler-provided declarative-root marker for mount selection", () => {
    const element = new FakeElement()
    element.shadowRoot = {} as ShadowRoot
    const mount = vi.fn()
    const hydrate = vi.fn()
    const instanceKernel = createKernel(element as unknown as HTMLElement, {
      shadow: true,
      usesDeclarativeRoot: false,
      mount,
      hydrate,
    })

    connect(instanceKernel)

    expect(mount).toHaveBeenCalledOnce()
    expect(hydrate).not.toHaveBeenCalled()
  })

  it("aborts lifecycle work before running effect cleanups on disconnect", () => {
    const element = new FakeElement()
    const instanceKernel = kernel()
    instanceKernel.element = element as unknown as HTMLElement
    instanceKernel.lifecycleAbort.signal.addEventListener("abort", () => {
      element.setAttribute("data-effect", "aborted")
    })
    instanceKernel.effectCleanups.push(() => element.removeAttribute("data-effect"))

    disconnect(instanceKernel)

    expect(element.getAttribute("data-effect")).toBeNull()
    expect(instanceKernel.effectCleanups).toEqual([undefined])
  })

  it("batches state updates and invalidates computed values", () => {
    const updates: Array<ReadonlySet<string> | null> = []
    const instanceKernel = kernel({
      update: (_kernel, dirty) => updates.push(dirty),
    })
    instanceKernel.mounted = true
    const count = stateAccessor<number>(instanceKernel, "count")
    const doubled = computedAccessor(instanceKernel, "doubled", () => count() * 2)

    instanceKernel.state.count = 1
    expect(doubled()).toBe(2)
    count.set(3)
    expect(doubled()).toBe(6)

    flushSync(instanceKernel)
    expect(updates).toHaveLength(1)
    expect(updates[0]).toBe(null)

    markAllDirty(instanceKernel)
    flushSync(instanceKernel)
    expect(updates).toHaveLength(2)
  })

  it("uses the runtime keyed-binding registry for state-driven selector updates", () => {
    const instanceKernel = kernel({
      keyedSelectors: { selected: ["isSelected"] },
    })
    instanceKernel.mounted = true
    instanceKernel.needsFullUpdate = false
    instanceKernel.state.selected = "a"
    const updates: string[] = []
    const recordA = {}
    const recordB = {}
    registerKeyedBinding(instanceKernel, "isSelected", "a", recordA, "selected", () => {
      updates.push("a")
    })
    registerKeyedBinding(instanceKernel, "isSelected", "b", recordB, "selected", () => {
      updates.push("b")
    })

    stateAccessor<string>(instanceKernel, "selected").set("b")
    flushSync(instanceKernel)

    expect(updates).toEqual(["a", "b"])
    unregisterKeyedBindings(instanceKernel, recordA)
    unregisterKeyedBindings(instanceKernel, recordB)
    expect(instanceKernel.keyedBindings).toHaveLength(0)
  })

  it("keeps host update scopes, queued tasks, and failures kernel-owned", async () => {
    const instanceKernel = kernel()
    instanceKernel.mounted = true
    const reporter = vi.fn()
    vi.stubGlobal("reportError", reporter)
    const api = hostApi(instanceKernel)()
    const update = api.update()
    const task = vi.fn(() => {
      throw new Error("queued failure")
    })
    api.queueTask(task)

    flushSync(instanceKernel)

    await expect(update).resolves.toBe(instanceKernel.updateAbort.signal)
    expect(task).toHaveBeenCalledOnce()
    expect(reporter).toHaveBeenCalledWith(expect.any(Error))
    vi.unstubAllGlobals()
  })

  it("scopes listeners to their latest event run and removes them on disposal", () => {
    const instanceKernel = kernel()
    const target = new EventTarget()
    const signals: AbortSignal[] = []
    const dispose = listen(instanceKernel, target, "change", (_event, signal) => {
      signals.push(signal)
    })

    target.dispatchEvent(new Event("change"))
    target.dispatchEvent(new Event("change"))
    expect(signals).toHaveLength(2)
    expect(signals[0]?.aborted).toBe(true)

    dispose()
    expect(signals[1]?.aborted).toBe(true)
    target.dispatchEvent(new Event("change"))
    expect(signals).toHaveLength(2)
  })

  it("runs dependency-gated effects and replaces their cleanup", () => {
    const instanceKernel = kernel()
    const calls: string[] = []

    runEffect(instanceKernel, 0, new Set(["count"]), ["count"], () => {
      calls.push("first")
      return () => calls.push("cleanup-first")
    })
    runEffect(instanceKernel, 0, new Set(["label"]), ["count"], () => {
      calls.push("skipped")
    })
    runEffect(instanceKernel, 0, null, ["count"], () => {
      calls.push("second")
      return () => calls.push("cleanup-second")
    })

    expect(calls).toEqual(["first", "cleanup-first", "second"])
    disconnect(instanceKernel)
    expect(calls).toEqual(["first", "cleanup-first", "second", "cleanup-second"])
  })

  it("shares attribute and registration guards through the runtime contract", () => {
    const element = new FakeElement()
    setAttr(element as unknown as Element, "data-state", false)
    expect(element.getAttribute("data-state")).toBeNull()
    setAttr(element as unknown as Element, "aria-hidden", false, false)
    expect(element.getAttribute("aria-hidden")).toBe("false")

    const registry = new Map<string, CustomElementConstructor>()
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    vi.stubGlobal("customElements", {
      define: (name: string, constructor: CustomElementConstructor) =>
        registry.set(name, constructor),
      get: (name: string) => registry.get(name),
    })
    class First extends FakeElement {}
    class SamePackage extends FakeElement {}
    class Conflict extends FakeElement {}
    const metadata = { packageName: "@test/kernel", packageVersion: "1.0.0", tagName: "x-kernel" }

    defineComponent("x-kernel", First as unknown as CustomElementConstructor, metadata)
    defineComponent("x-kernel", SamePackage as unknown as CustomElementConstructor, metadata)
    defineComponent("x-kernel", Conflict as unknown as CustomElementConstructor, {
      ...metadata,
      packageVersion: "2.0.0",
    })

    expect(registry.get("x-kernel")).toBe(First)
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
    vi.unstubAllGlobals()
  })

  it("reports errors through both the component event and platform reporter", () => {
    const instanceKernel = kernel()
    const reported = vi.fn()
    const events: unknown[] = []
    vi.stubGlobal("reportError", reported)
    instanceKernel.element.addEventListener("naos-error", (event) => events.push(event))

    reportError(instanceKernel, new Error("broken"))

    expect(events).toHaveLength(1)
    expect(reported).toHaveBeenCalledWith(expect.any(Error))
    vi.unstubAllGlobals()
  })

  it("reconciles records by key and disposes stale rows", () => {
    const children: Node[] = []
    const container = {
      get firstChild() {
        return children[0] ?? null
      },
      insertBefore(node: Node, before: Node | null) {
        const existing = children.indexOf(node)
        if (existing >= 0) children.splice(existing, 1)
        const index = before ? children.indexOf(before) : children.length
        children.splice(index < 0 ? children.length : index, 0, node)
      },
      removeChild(node: Node) {
        children.splice(children.indexOf(node), 1)
      },
    } as unknown as Node
    const nodes = new Map<string, Node>()
    const disposed: string[] = []
    const records = reconcileKeyed(
      container,
      new Map<string, { node: Node; value: string }>(),
      ["a", "b"],
      (value) => value,
      (value) => {
        const node = {} as Node
        nodes.set(value, node)
        return { node, value }
      },
      (record, value) => {
        record.value = value
      },
      (record) => disposed.push(record.value),
    )
    const next = reconcileKeyed(
      container,
      records,
      ["b", "c"],
      (value) => value,
      (value) => ({ node: {} as Node, value }),
      (record, value) => {
        record.value = value
      },
      (record) => disposed.push(record.value),
    )

    expect([...next.keys()]).toEqual(["b", "c"])
    expect(disposed).toEqual(["a"])
    expect(children).toHaveLength(2)
  })
})
