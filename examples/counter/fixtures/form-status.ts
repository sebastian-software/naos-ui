import { bindFormStatus, formAction, getFormStatus } from "@naos-ui/actions"
import "../src/note-form.wc.tsx"

function element<ElementType extends HTMLElement>(id: string): ElementType {
  const found = document.getElementById(id)
  if (!found) throw new Error(`Missing form status fixture element ${id}`)
  return found as ElementType
}

let finish: () => void = () => {}
const primary = formAction(async () => {
  await new Promise<void>((resolve) => {
    finish = resolve
  })
  return true
}, false)
const secondary = formAction(() => true, false)
const primaryForm = element<HTMLFormElement>("primary")
const secondaryForm = element<HTMLFormElement>("secondary")
primary.enhance(primaryForm)
secondary.enhance(secondaryForm)

const describeStatus = (status: ReturnType<typeof getFormStatus>) =>
  status ? (status.pending ? "pending" : "idle") : "absent"
const watch = (from: Element, destination: HTMLElement, attribute = "data-status") =>
  bindFormStatus(from, (status) => destination.setAttribute(attribute, describeStatus(status)))

const light = element("light-status")
let stopLight = watch(light, light)
const external = element("external")
watch(external, external)
const secondaryStatus = element("secondary-status")
watch(secondaryStatus, secondaryStatus)
const outside = element("outside-status")
watch(outside, outside)

const shadowHost = element("shadow-host")
const closedRoot = shadowHost.attachShadow({ mode: "closed" })
const innerHost = document.createElement("span")
closedRoot.append(innerHost)
const innerRoot = innerHost.attachShadow({ mode: "open" })
const nestedSource = document.createElement("span")
const nativeForm = document.createElement("form")
const nativeSource = document.createElement("span")
innerRoot.append(nestedSource, nativeForm)
nativeForm.append(nativeSource)
watch(nestedSource, shadowHost, "data-nested-status")
watch(nativeSource, shadowHost, "data-native-status")

const slotted = element("slotted-status")
const slottedRoot = element("closed-slot-host").attachShadow({ mode: "closed" })
const slottedForm = document.createElement("form")
slottedRoot.append(slottedForm)
slottedForm.append(document.createElement("slot"))
const closed = formAction(() => true, false)
closed.enhance(slottedForm)
watch(slotted, slotted)

element("finish").addEventListener("click", () => finish())
element("dispose").addEventListener("click", () => primary.dispose())
element("move").addEventListener("click", () => {
  stopLight()
  secondaryForm.append(light)
  stopLight = watch(light, light)
})

const compiledContainer = element("compiled-form-container")
const compiledHost = compiledContainer.querySelector("demo-note-form")
const compiledForm = compiledHost?.shadowRoot?.querySelector("form")
if (!compiledHost || !compiledForm) throw new Error("Missing compiled form fixture")
const compiledStatus = element("compiled-form-status")
watch(compiledForm, compiledStatus)
element("disconnect-compiled").addEventListener("click", () => {
  compiledHost.remove()
  const submit = new SubmitEvent("submit", { bubbles: true, cancelable: true })
  compiledForm.dispatchEvent(submit)
  compiledStatus.setAttribute("data-detached-submit-prevented", String(submit.defaultPrevented))
})
element("reconnect-compiled").addEventListener("click", () =>
  compiledContainer.append(compiledHost),
)
