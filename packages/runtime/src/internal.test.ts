import { describe, expect, it, vi } from "vitest"

import {
  K,
  type Kernel,
  attrChanged,
  computedAccessor,
  connect,
  createKernel,
  defineProps,
  flushSync,
  markAllDirty,
  reconcileKeyed,
  shouldUpdate,
  stateAccessor,
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
