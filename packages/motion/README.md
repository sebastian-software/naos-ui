# `@naos-ui/motion`

`@naos-ui/motion` provides framework-free motion primitives for Naos
components: spring timing helpers, motion design tokens, FLIP layout
utilities, animation-wait helpers, and `prefers-reduced-motion` awareness —
all built on the Web Animations API.

**Stability: experimental.** Pre-1.0 and under active design; APIs may change
in any release.

```ts
import { prefersReducedMotion, spring } from "@naos-ui/motion"

const timing = spring({ stiffness: 220, damping: 28 })
if (!prefersReducedMotion()) {
  element.animate(keyframes, { duration: timing.duration, easing: timing.easing })
}
```
