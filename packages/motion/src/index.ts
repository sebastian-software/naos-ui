export type NaosReducedMotionPreference = boolean | "media"

export type NaosAnimationWaitOptions = {
  reducedMotion?: NaosReducedMotionPreference
  signal?: AbortSignal | null
  subtree?: boolean
  timeout?: false | number
}

export type NaosSpringOptions = {
  damping?: number
  initialVelocity?: number
  mass?: number
  maxDuration?: number
  restDelta?: number
  restSpeed?: number
  sampleCount?: number
  stiffness?: number
}

export type NaosSpringPreset = keyof typeof motionTokens.springs

export type NaosSpringTiming = {
  duration: number
  easing: string
}

export type NaosMotionTokenKind = "layout" | "presence" | "transition"

export type NaosSpringMotionTokenOptions = {
  kind?: NaosMotionTokenKind
  preset?: NaosSpringPreset
  options?: NaosSpringOptions
}

export type NaosSpringMotionToken = NaosSpringTiming & {
  className: string
  css: string
}

export type NaosFlipOptions = {
  duration?: number
  easing?: string
  reducedMotion?: NaosReducedMotionPreference
}

export type NaosAutoLayoutEnterPreset = "fade" | "fade-scale"

export type NaosAutoLayoutOptions = {
  enter?: NaosAutoLayoutEnterPreset | false
  layout?: NaosSpringPreset | NaosSpringOptions
  reducedMotion?: NaosReducedMotionPreference
  signal?: AbortSignal | null
}

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)"
const DEFAULT_ANIMATION_TIMEOUT = 4000
const DEFAULT_SPRING_SAMPLE_COUNT = 24
const SPRING_STEP_SECONDS = 1 / 1000

export const motionTokens = {
  springs: {
    gentle: {
      damping: 28,
      mass: 1,
      maxDuration: 700,
      stiffness: 180,
    },
    smooth: {
      damping: 24,
      mass: 1,
      maxDuration: 550,
      stiffness: 260,
    },
    snappy: {
      damping: 22,
      mass: 1,
      maxDuration: 420,
      stiffness: 420,
    },
  },
} as const

export function prefersReducedMotion(query = REDUCED_MOTION_QUERY) {
  if (typeof globalThis.matchMedia !== "function") return false
  try {
    return globalThis.matchMedia(query).matches
  } catch {
    return false
  }
}

export function waitForAnimations(
  element: Element | null | undefined,
  options: NaosAnimationWaitOptions = {},
) {
  if (
    element == null ||
    shouldSkipMotion(options.reducedMotion) ||
    typeof element.getAnimations !== "function"
  ) {
    return Promise.resolve()
  }

  const animations = getPendingAnimations(element, options.subtree ?? true)
  if (animations.length === 0) return Promise.resolve()

  return new Promise<void>((resolve) => {
    let settled = false
    let timeout: ReturnType<typeof globalThis.setTimeout> | undefined

    const finish = () => {
      if (settled) return
      settled = true
      if (timeout != null) globalThis.clearTimeout(timeout)
      options.signal?.removeEventListener("abort", finish)
      resolve()
    }

    if (options.signal?.aborted) {
      finish()
      return
    }

    options.signal?.addEventListener("abort", finish, { once: true })

    const timeoutMs = options.timeout ?? DEFAULT_ANIMATION_TIMEOUT
    if (timeoutMs !== false) {
      timeout = globalThis.setTimeout(finish, Math.max(0, timeoutMs))
    }

    void Promise.allSettled(animations.map((animation) => animation.finished)).then(finish)
  })
}

export function spring(options: NaosSpringOptions | NaosSpringPreset = "smooth"): NaosSpringTiming {
  const resolved = resolveSpringOptions(options)
  const duration = springDuration(resolved)
  const sampleCount = Math.max(
    2,
    Math.min(80, Math.round(resolved.sampleCount ?? DEFAULT_SPRING_SAMPLE_COUNT)),
  )
  const values = Array.from({ length: sampleCount }, (_, index) => {
    const progress = index / (sampleCount - 1)
    return formatProgress(springValueAt(resolved, duration * progress))
  })

  values[0] = "0"
  values[values.length - 1] = "1"

  return {
    duration: Math.round(duration * 1000),
    easing: `linear(${values.join(", ")})`,
  }
}

export function springEasing(options: NaosSpringOptions | NaosSpringPreset = "smooth") {
  return spring(options).easing
}

export function springMotionToken(
  options: NaosSpringMotionTokenOptions | NaosSpringPreset = "smooth",
): NaosSpringMotionToken {
  const token = resolveSpringMotionTokenOptions(options)
  const timing = spring(token.preset ?? token.options ?? "smooth")
  const className = springMotionTokenClassName(token)

  return {
    ...timing,
    className,
    css: formatSpringMotionTokenCss({
      className,
      duration: timing.duration,
      easing: timing.easing,
      kind: token.kind,
    }),
  }
}

export function springMotionTokenClassName(
  options: NaosSpringMotionTokenOptions | NaosSpringPreset = "smooth",
) {
  const token = resolveSpringMotionTokenOptions(options)
  if (token.preset != null) {
    return `naos-motion-${token.kind}-spring-${token.preset}`
  }

  const normalized = normalizeSpringOptions(token.options)
  return `naos-motion-${token.kind}-spring-${hashMotionTokenSignature(JSON.stringify(normalized))}`
}

export function springMotionTokenCss(
  options: NaosSpringMotionTokenOptions | NaosSpringPreset = "smooth",
) {
  const token = springMotionToken(options)
  return token.css
}

export function flipMovedElements(
  firstRects: ReadonlyMap<Element, DOMRectReadOnly>,
  options: NaosFlipOptions = {},
): Animation[] {
  if (shouldSkipMotion(options.reducedMotion)) return []

  const timing = spring("snappy")
  const duration = options.duration ?? timing.duration
  const easing = options.easing ?? timing.easing
  const animations: Animation[] = []

  for (const [element, firstRect] of firstRects) {
    if (
      typeof element.getBoundingClientRect !== "function" ||
      typeof element.animate !== "function"
    ) {
      continue
    }

    const lastRect = element.getBoundingClientRect()
    const deltaX = firstRect.left - lastRect.left
    const deltaY = firstRect.top - lastRect.top
    if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) continue

    const baseTransform = transformForElement(element)
    const fromTransform = transformWithOffset(baseTransform, deltaX, deltaY)
    const toTransform = baseTransform === "none" ? "translate(0px, 0px)" : baseTransform

    animations.push(
      element.animate([{ transform: fromTransform }, { transform: toTransform }], {
        duration,
        easing,
      }),
    )
  }

  return animations
}

/**
 * Animates layout changes among a container's direct children: persisted
 * children FLIP from their previous position on every child-list mutation,
 * and newly added children can opt into a modest enter animation. Layout
 * moves are the primary use case — exit animations and resize tracking are
 * intentionally out of scope for this first iteration.
 *
 * Positions are snapshotted per mutation pass, so layout shifts that happen
 * without a child-list mutation (for example a sibling resizing) are not
 * animated. Running layout animations are canceled before each new pass and
 * on disposal so measurements always see untransformed layout positions.
 */
export function autoLayout(container: Element, options: NaosAutoLayoutOptions = {}): () => void {
  if (typeof MutationObserver !== "function") return () => undefined

  const timing = spring(options.layout ?? "snappy")
  const positions = new Map<Element, DOMRectReadOnly>()
  const running = new Set<Animation>()
  let disposed = false

  const track = (animation: Animation) => {
    running.add(animation)
    const untrack = () => running.delete(animation)
    animation.finished?.then(untrack, untrack)
  }

  const cancelRunning = () => {
    for (const animation of running) animation.cancel()
    running.clear()
  }

  const measureChildren = () => {
    positions.clear()
    for (const child of container.children) {
      if (typeof child.getBoundingClientRect !== "function") continue
      positions.set(child, child.getBoundingClientRect())
    }
  }

  const pass = (records: MutationRecord[]) => {
    if (disposed) return
    const previous = new Map(positions)
    cancelRunning()
    measureChildren()
    if (shouldSkipMotion(options.reducedMotion)) return

    const added = new Set<Element>()
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (isElementNode(node) && node.parentElement === container && !previous.has(node)) {
          added.add(node)
        }
      }
    }

    const firstRects = new Map<Element, DOMRectReadOnly>()
    for (const child of container.children) {
      const firstRect = previous.get(child)
      if (firstRect) firstRects.set(child, firstRect)
    }

    for (const animation of flipMovedElements(firstRects, {
      duration: timing.duration,
      easing: timing.easing,
      reducedMotion: options.reducedMotion,
    })) {
      track(animation)
    }

    const enter = options.enter ?? false
    if (enter === false) return
    for (const element of added) {
      if (element.parentElement !== container || typeof element.animate !== "function") continue
      track(
        element.animate(enterKeyframes(element, enter), {
          duration: timing.duration,
          easing: timing.easing,
        }),
      )
    }
  }

  const observer = new MutationObserver(pass)
  const dispose = () => {
    if (disposed) return
    disposed = true
    observer.disconnect()
    cancelRunning()
    positions.clear()
    options.signal?.removeEventListener("abort", dispose)
  }

  if (options.signal?.aborted) {
    dispose()
    return dispose
  }

  measureChildren()
  observer.observe(container, { childList: true })
  options.signal?.addEventListener("abort", dispose, { once: true })
  return dispose
}

function isElementNode(node: Node): node is Element {
  return node.nodeType === 1
}

function enterKeyframes(element: Element, preset: NaosAutoLayoutEnterPreset): Keyframe[] {
  if (preset === "fade") {
    return [{ opacity: 0 }, { opacity: 1 }]
  }
  const baseTransform = transformForElement(element)
  const fromTransform = baseTransform === "none" ? "scale(0.96)" : `scale(0.96) ${baseTransform}`
  const toTransform = baseTransform === "none" ? "scale(1)" : baseTransform
  return [
    { opacity: 0, transform: fromTransform },
    { opacity: 1, transform: toTransform },
  ]
}

function getPendingAnimations(element: Element, subtree: boolean) {
  try {
    return element
      .getAnimations({ subtree })
      .filter((animation) => animation.playState !== "finished" && animation.playState !== "idle")
  } catch {
    return []
  }
}

function shouldSkipMotion(reducedMotion: NaosReducedMotionPreference = "media") {
  if (reducedMotion === true) return true
  if (reducedMotion === false) return false
  return prefersReducedMotion()
}

function resolveSpringOptions(options: NaosSpringOptions | NaosSpringPreset) {
  const base: NaosSpringOptions =
    typeof options === "string" ? motionTokens.springs[options] : options
  return {
    damping: base.damping ?? motionTokens.springs.smooth.damping,
    initialVelocity: base.initialVelocity ?? 0,
    mass: base.mass ?? motionTokens.springs.smooth.mass,
    maxDuration: base.maxDuration ?? motionTokens.springs.smooth.maxDuration,
    restDelta: base.restDelta ?? 0.001,
    restSpeed: base.restSpeed ?? 0.001,
    sampleCount: base.sampleCount,
    stiffness: base.stiffness ?? motionTokens.springs.smooth.stiffness,
  }
}

function resolveSpringMotionTokenOptions(
  options: NaosSpringMotionTokenOptions | NaosSpringPreset,
): Required<Pick<NaosSpringMotionTokenOptions, "kind">> &
  (
    | { options: NaosSpringOptions; preset?: undefined }
    | { options?: undefined; preset: NaosSpringPreset }
  ) {
  if (typeof options === "string") {
    return { kind: "transition", preset: options }
  }

  if (options.options != null) {
    return {
      kind: options.kind ?? "transition",
      options: normalizeSpringOptions(options.options),
    }
  }

  return {
    kind: options.kind ?? "transition",
    preset: options.preset ?? "smooth",
  }
}

function normalizeSpringOptions(options: NaosSpringOptions) {
  const resolved = resolveSpringOptions(options)
  return {
    damping: resolved.damping,
    initialVelocity: resolved.initialVelocity,
    mass: resolved.mass,
    maxDuration: resolved.maxDuration,
    restDelta: resolved.restDelta,
    restSpeed: resolved.restSpeed,
    sampleCount: Math.max(
      2,
      Math.min(80, Math.round(resolved.sampleCount ?? DEFAULT_SPRING_SAMPLE_COUNT)),
    ),
    stiffness: resolved.stiffness,
  }
}

function formatSpringMotionTokenCss(options: {
  className: string
  duration: number
  easing: string
  kind: NaosMotionTokenKind
}) {
  return [
    `.${options.className} {`,
    `  --naos-${options.kind}-motion-duration: ${options.duration}ms;`,
    `  --naos-${options.kind}-motion-easing: ${options.easing};`,
    `}`,
  ].join("\n")
}

function hashMotionTokenSignature(signature: string) {
  let hash = 2166136261
  for (let index = 0; index < signature.length; index += 1) {
    hash ^= signature.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

function springDuration(options: RequiredSpringOptions) {
  let value = 0
  let velocity = options.initialVelocity
  const maxDurationSeconds = options.maxDuration / 1000

  for (let elapsed = 0; elapsed <= maxDurationSeconds; elapsed += SPRING_STEP_SECONDS) {
    if (Math.abs(1 - value) <= options.restDelta && Math.abs(velocity) <= options.restSpeed) {
      return elapsed
    }

    const acceleration =
      (-options.stiffness * (value - 1) - options.damping * velocity) / options.mass
    velocity += acceleration * SPRING_STEP_SECONDS
    value += velocity * SPRING_STEP_SECONDS
  }

  return maxDurationSeconds
}

function springValueAt(options: RequiredSpringOptions, seconds: number) {
  let value = 0
  let velocity = options.initialVelocity

  for (let elapsed = 0; elapsed < seconds; elapsed += SPRING_STEP_SECONDS) {
    const step = Math.min(SPRING_STEP_SECONDS, seconds - elapsed)
    const acceleration =
      (-options.stiffness * (value - 1) - options.damping * velocity) / options.mass
    velocity += acceleration * step
    value += velocity * step
  }

  return value
}

function formatProgress(value: number) {
  return Number(value.toFixed(4)).toString()
}

function formatPx(value: number) {
  return `${Number(value.toFixed(3))}px`
}

function transformForElement(element: Element) {
  if (typeof globalThis.getComputedStyle !== "function") return "none"
  try {
    return globalThis.getComputedStyle(element).transform || "none"
  } catch {
    return "none"
  }
}

function transformWithOffset(baseTransform: string, deltaX: number, deltaY: number) {
  const offset = `translate(${formatPx(deltaX)}, ${formatPx(deltaY)})`
  return baseTransform === "none" ? offset : `${offset} ${baseTransform}`
}

type RequiredSpringOptions = Required<Omit<NaosSpringOptions, "sampleCount">> &
  Pick<NaosSpringOptions, "sampleCount">
