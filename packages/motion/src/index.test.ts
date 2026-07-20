import { describe, expect, it } from "vitest"

import {
  autoLayout,
  flipMovedElements,
  prefersReducedMotion,
  spring,
  springEasing,
  springMotionToken,
  waitForAnimations,
} from "./index.js"

type FakeAnimation = {
  cancel: () => void
  canceled: boolean
  finished: Promise<void>
  keyframes: Keyframe[]
}

type FakeElement = Element & {
  animations: FakeAnimation[]
  moveTo: (left: number, top: number) => void
  parent: { children: FakeElement[] } | null
}

class FakeMutationObserver {
  static instances: FakeMutationObserver[] = []
  disconnected = false
  target: Node | null = null

  constructor(private readonly callback: (records: MutationRecord[]) => void) {
    FakeMutationObserver.instances.push(this)
  }

  observe(target: Node) {
    this.target = target
  }

  disconnect() {
    this.disconnected = true
  }

  trigger(records: Array<{ addedNodes?: Node[] }>) {
    this.callback(
      records.map(
        (record) => ({ addedNodes: record.addedNodes ?? [] }) as unknown as MutationRecord,
      ),
    )
  }
}

function createFakeContainer() {
  const container = { children: [] as FakeElement[] }

  const createChild = (left: number, top: number): FakeElement => {
    let rect = { left, top }
    const element = {
      animate: (keyframes: Keyframe[]) => {
        const animation: FakeAnimation = {
          cancel: () => {
            animation.canceled = true
          },
          canceled: false,
          finished: new Promise<void>(() => undefined),
          keyframes,
        }
        element.animations.push(animation)
        return animation as unknown as Animation
      },
      animations: [] as FakeAnimation[],
      getBoundingClientRect: () => ({ ...rect, bottom: rect.top + 10, right: rect.left + 10 }),
      moveTo: (nextLeft: number, nextTop: number) => {
        rect = { left: nextLeft, top: nextTop }
      },
      nodeType: 1,
      get parentElement() {
        return element.parent as unknown as Element | null
      },
      parent: container as FakeElement["parent"],
    }
    return element as unknown as FakeElement
  }

  return { container: container as unknown as Element & { children: FakeElement[] }, createChild }
}

function lastMutationObserver() {
  const observer = FakeMutationObserver.instances.at(-1)
  if (!observer) throw new Error("No FakeMutationObserver instance was created.")
  return observer
}

function withFakeMutationObserver<T>(run: () => T): T {
  const original = globalThis.MutationObserver
  FakeMutationObserver.instances = []
  globalThis.MutationObserver = FakeMutationObserver as unknown as typeof MutationObserver
  try {
    return run()
  } finally {
    globalThis.MutationObserver = original
  }
}

describe("@naos-ui/motion", () => {
  it("resolves animation waits without DOM animation support", async () => {
    await expect(waitForAnimations(null)).resolves.toBeUndefined()
    await expect(waitForAnimations({} as Element)).resolves.toBeUndefined()
  })

  it("waits for pending animations and forwards subtree lookup", async () => {
    let resolveFinished: () => void = () => undefined
    const finished = new Promise<void>((resolve) => {
      resolveFinished = resolve
    })
    const calls: boolean[] = []
    const element = {
      getAnimations: (options?: GetAnimationsOptions) => {
        calls.push(options?.subtree ?? false)
        return [
          { finished: Promise.resolve(), playState: "finished" },
          { finished, playState: "running" },
        ]
      },
    } as unknown as Element

    const wait = waitForAnimations(element, { timeout: false })
    let settled = false
    void wait.then(() => {
      settled = true
    })

    await Promise.resolve()
    expect(settled).toBe(false)

    resolveFinished()
    await wait
    expect(settled).toBe(true)
    expect(calls).toEqual([true])
  })

  it("resolves pending animation waits when aborted", async () => {
    const controller = new AbortController()
    const element = {
      getAnimations: () => [{ finished: new Promise(() => undefined), playState: "running" }],
    } as unknown as Element

    const wait = waitForAnimations(element, {
      signal: controller.signal,
      timeout: false,
    })
    let settled = false
    void wait.then(() => {
      settled = true
    })

    await Promise.resolve()
    expect(settled).toBe(false)

    controller.abort()
    await wait
    expect(settled).toBe(true)
  })

  it("skips animation waits when reduced motion is requested", async () => {
    const element = {
      getAnimations: () => {
        throw new Error("reduced motion should not read animations")
      },
    } as unknown as Element

    await expect(waitForAnimations(element, { reducedMotion: true })).resolves.toBeUndefined()
  })

  it("reports reduced-motion media preference defensively", () => {
    const originalMatchMedia = globalThis.matchMedia
    try {
      globalThis.matchMedia = ((query: string) => ({
        addEventListener: () => undefined,
        addListener: () => undefined,
        dispatchEvent: () => true,
        matches: query.includes("prefers-reduced-motion"),
        media: query,
        onchange: null,
        removeEventListener: () => undefined,
        removeListener: () => undefined,
      })) as typeof matchMedia

      expect(prefersReducedMotion()).toBe(true)
      expect(prefersReducedMotion("(prefers-contrast: more)")).toBe(false)
    } finally {
      globalThis.matchMedia = originalMatchMedia
    }
  })

  it("generates spring-quality CSS timing", () => {
    const timing = spring("snappy")

    expect(timing.duration).toBeGreaterThan(0)
    expect(timing.duration).toBeLessThanOrEqual(420)
    expect(timing.easing).toMatch(/^linear\(0, /)
    expect(timing.easing.endsWith(", 1)")).toBe(true)
    expect(springEasing({ damping: 26, stiffness: 300 })).toMatch(/^linear\(/)
  })

  it("generates deterministic spring motion token classes and CSS", () => {
    const preset = springMotionToken({ kind: "presence", preset: "snappy" })
    const custom = springMotionToken({
      kind: "presence",
      options: { damping: 22, mass: 1, maxDuration: 420, stiffness: 420 },
    })
    const sameCustom = springMotionToken({
      kind: "presence",
      options: { maxDuration: 420, stiffness: 420, damping: 22, mass: 1 },
    })

    expect(preset.className).toBe("naos-motion-presence-spring-snappy")
    expect(preset.css).toContain(".naos-motion-presence-spring-snappy")
    expect(preset.css).toContain("--naos-presence-motion-duration: ")
    expect(preset.css).toContain("--naos-presence-motion-easing: linear(")
    expect(custom.className).toBe(sameCustom.className)
    expect(custom.css).toBe(sameCustom.css)
  })

  it("animates moved elements from their previous rect", () => {
    const originalGetComputedStyle = globalThis.getComputedStyle
    const animateCalls: unknown[] = []
    const element = {
      animate: (...args: unknown[]) => {
        animateCalls.push(args)
        return { playState: "running" }
      },
      getBoundingClientRect: () => ({
        bottom: 20,
        height: 20,
        left: 10,
        right: 110,
        top: 0,
        width: 100,
        x: 10,
        y: 0,
        toJSON: () => ({}),
      }),
    } as unknown as Element

    try {
      globalThis.getComputedStyle = (() => ({
        transform: "scale(1)",
      })) as unknown as typeof getComputedStyle

      const animations = flipMovedElements(
        new Map([
          [
            element,
            {
              bottom: 56,
              height: 20,
              left: 30,
              right: 130,
              top: 36,
              width: 100,
              x: 30,
              y: 36,
              toJSON: () => ({}),
            },
          ],
        ]),
        { duration: 180, easing: "linear" },
      )

      expect(animations).toHaveLength(1)
      expect(animateCalls).toHaveLength(1)
      expect(animateCalls[0]).toEqual([
        [{ transform: "translate(20px, 36px) scale(1)" }, { transform: "scale(1)" }],
        { duration: 180, easing: "linear" },
      ])
    } finally {
      globalThis.getComputedStyle = originalGetComputedStyle
    }
  })

  it("uses provided last rects instead of re-measuring", () => {
    const animateCalls: unknown[] = []
    const element = {
      animate: (...args: unknown[]) => {
        animateCalls.push(args)
        return { playState: "running" }
      },
      getBoundingClientRect: () => {
        throw new Error("provided last rects should not re-measure")
      },
    } as unknown as Element

    const firstRect = { left: 30, top: 36 } as DOMRectReadOnly
    const lastRect = { left: 10, top: 0 } as DOMRectReadOnly
    const animations = flipMovedElements(new Map([[element, firstRect]]), {
      duration: 180,
      easing: "linear",
      lastRects: new Map([[element, lastRect]]),
    })

    expect(animations).toHaveLength(1)
    expect(animateCalls[0]).toEqual([
      [{ transform: "translate(20px, 36px)" }, { transform: "translate(0px, 0px)" }],
      { duration: 180, easing: "linear" },
    ])
  })

  it("skips FLIP when reduced motion is requested", () => {
    const element = {
      animate: () => {
        throw new Error("reduced motion should not animate")
      },
      getBoundingClientRect: () => {
        throw new Error("reduced motion should not measure")
      },
    } as unknown as Element

    expect(
      flipMovedElements(new Map([[element, {} as DOMRectReadOnly]]), {
        reducedMotion: true,
      }),
    ).toEqual([])
  })
})

describe("autoLayout", () => {
  it("flips persisted children from their previous rect on child-list mutations", () => {
    withFakeMutationObserver(() => {
      const { container, createChild } = createFakeContainer()
      const first = createChild(0, 0)
      const second = createChild(0, 20)
      container.children.push(first, second)

      const dispose = autoLayout(container, { layout: { maxDuration: 100 } })
      const observer = lastMutationObserver()
      expect(observer.target).toBe(container)

      first.moveTo(0, 20)
      second.moveTo(0, 0)
      container.children.reverse()
      observer.trigger([{}])

      expect(first.animations).toHaveLength(1)
      expect(second.animations).toHaveLength(1)
      expect(first.animations[0]?.keyframes[0]?.transform).toBe("translate(0px, -20px)")
      expect(second.animations[0]?.keyframes[0]?.transform).toBe("translate(0px, 20px)")
      dispose()
    })
  })

  it("cancels running layout animations before a new pass and on disposal", () => {
    withFakeMutationObserver(() => {
      const { container, createChild } = createFakeContainer()
      const child = createChild(0, 0)
      container.children.push(child)

      const dispose = autoLayout(container)
      const observer = lastMutationObserver()

      child.moveTo(0, 40)
      observer.trigger([{}])
      expect(child.animations).toHaveLength(1)
      expect(child.animations[0]?.canceled).toBe(false)

      child.moveTo(0, 0)
      observer.trigger([{}])
      expect(child.animations).toHaveLength(2)
      expect(child.animations[0]?.canceled).toBe(true)

      dispose()
      expect(child.animations[1]?.canceled).toBe(true)
      expect(observer.disconnected).toBe(true)
    })
  })

  it("skips animations under reduced motion while keeping position bookkeeping", () => {
    withFakeMutationObserver(() => {
      const { container, createChild } = createFakeContainer()
      const child = createChild(0, 0)
      container.children.push(child)

      const dispose = autoLayout(container, { reducedMotion: true })
      const observer = lastMutationObserver()

      child.moveTo(0, 40)
      observer.trigger([{}])
      expect(child.animations).toHaveLength(0)
      dispose()
    })
  })

  it("plays opt-in enter animations for added children without flipping them", () => {
    withFakeMutationObserver(() => {
      const { container, createChild } = createFakeContainer()
      const existing = createChild(0, 0)
      container.children.push(existing)

      const dispose = autoLayout(container, { enter: "fade" })
      const observer = lastMutationObserver()

      const added = createChild(0, 20)
      container.children.push(added)
      existing.moveTo(0, 20)
      added.moveTo(0, 0)
      container.children.reverse()
      observer.trigger([{ addedNodes: [added as unknown as Node] }])

      expect(existing.animations).toHaveLength(1)
      expect(existing.animations[0]?.keyframes[0]?.transform).toBe("translate(0px, -20px)")
      expect(added.animations).toHaveLength(1)
      expect(added.animations[0]?.keyframes).toEqual([{ opacity: 0 }, { opacity: 1 }])
      dispose()
    })
  })

  it("stays inert when the abort signal is already aborted", () => {
    withFakeMutationObserver(() => {
      const { container, createChild } = createFakeContainer()
      const child = createChild(0, 0)
      container.children.push(child)

      const controller = new AbortController()
      controller.abort()
      const dispose = autoLayout(container, { signal: controller.signal })
      const observer = lastMutationObserver()

      expect(observer.target).toBeNull()
      child.moveTo(0, 40)
      observer.trigger([{}])
      expect(child.animations).toHaveLength(0)
      dispose()
    })
  })

  it("disposes through an abort signal", () => {
    withFakeMutationObserver(() => {
      const { container, createChild } = createFakeContainer()
      const child = createChild(0, 0)
      container.children.push(child)

      const controller = new AbortController()
      autoLayout(container, { signal: controller.signal })
      const observer = lastMutationObserver()

      child.moveTo(0, 40)
      observer.trigger([{}])
      expect(child.animations).toHaveLength(1)

      controller.abort()
      expect(observer.disconnected).toBe(true)
      expect(child.animations[0]?.canceled).toBe(true)

      child.moveTo(0, 0)
      observer.trigger([{}])
      expect(child.animations).toHaveLength(1)
    })
  })
})
