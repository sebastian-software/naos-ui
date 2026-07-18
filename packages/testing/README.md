# `@naos-ui/testing`

`@naos-ui/testing` is the component-test harness for Naos: `mount()` a
compiled component with initial props/attrs, await the runtime's microtask
flush (`flush()` / `nextTick()` are tied to the real scheduler), drive
updates with `setProps()` / `setAttrs()`, capture typed CustomEvents, and
query shadow content including named parts across nested shadow roots.

**Stability: experimental.** Pre-1.0 and under active design; APIs may change
in any release.

```ts
import { mount } from "@naos-ui/testing"
import "@naos-ui/primitives/button"

const component = await mount("naos-button", { props: { label: "Send" } })
const presses = component.capture<{ variant: string }>("naos-press")

component.queryPart<HTMLButtonElement>("control")?.click()
presses.count // 1

component.unmount()
```

See the [testing guide](https://github.com/sebastian-software/naos-ui/blob/main/sites/docs/app/routes/guide/testing.mdx).
