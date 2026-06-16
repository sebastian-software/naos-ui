# ADR 0018: Form-Associated Custom Element Support

Status: Proposed

Weight: P1

## Context

Iktia targets platform-native Custom Elements. That makes native form
participation a product direction, not only a convenience feature. A primitive
such as a text field, checkbox, toggle, select trigger, or segmented control
should eventually be able to submit values with a surrounding `<form>`, reset
with that form, report constraint validity, and react to form-disabled state.

Shadow DOM creates a boundary here. Native controls rendered inside a component
shadow root are not automatically submitted by an ancestor light-DOM form.
Declarative Shadow DOM improves early rendering, but it does not solve form
participation. React-inspired form actions solve submission orchestration, but
they do not make a custom control behave like a browser form control.

The browser-facing feature for this is Form-Associated Custom Elements through
`static formAssociated = true`, `attachInternals()`, `ElementInternals`, and
the form lifecycle callbacks. Iktia needs to expose that capability without
leaking the full browser API into ordinary component authoring.

## Decision

Treat form-associated element support as an explicit post-v0.1 compiler
capability for custom controls. Do not infer it from JSX that happens to render
an `<input>` or other native control.

The first public authoring shape should have two parts:

* A component-level opt-in that tells the compiler to generate a
  form-associated custom element.
* One compiler-known form-control binding that describes how authored state maps
  to browser form semantics.

The intended shape is:

```tsx
import { formControl, state, type ComponentOptions } from "@iktia/core"

export const options = {
  formAssociated: true,
} satisfies ComponentOptions

export type TextFieldProps = {
  disabled?: boolean
  name?: string
  required?: boolean
  value?: string
}

export function TextField({
  disabled = false,
  name = "",
  required = false,
  value = "",
}: TextFieldProps = {}) {
  const currentValue = state(value)

  const field = formControl({
    name,
    value: currentValue,
    disabled,
    required,
    reset: () => currentValue.set(value),
    validate: () =>
      required && currentValue() === ""
        ? { valueMissing: true, message: "Enter a value" }
        : null,
  })

  return (
    <input
      part="control"
      disabled={field.disabled()}
      required={required}
      value={field.value()}
      onInput={(event) => {
        const input = event.currentTarget as HTMLInputElement
        currentValue.set(input.value)
      }}
    />
  )
}
```

The exact exported helper name and TypeScript overloads can still change during
implementation, but the shape is fixed enough for compiler design:

* `ComponentOptions.formAssociated: true` is the opt-in.
* `formControl()` is compiler-known authoring syntax, not a runtime form
  library.
* `name`, `value`, `disabled`, and `required` remain normal props and
  attributes where possible.
* The generated host element owns browser integration through
  `ElementInternals`.

Generated output responsibilities:

* Emit `static formAssociated = true` only for opted-in components.
* Call `attachInternals()` once per element instance and keep the internals
  private to generated code.
* Call `internals.setFormValue()` whenever the authored form value changes.
* Call `internals.setValidity()` whenever authored validity changes.
* Generate `formResetCallback()` to apply the authored reset behavior.
* Generate `formDisabledCallback(disabled)` to update the authored disabled
  binding and re-render if necessary.
* Leave host `name` integration to the platform attribute; do not create a
  parallel Iktia naming system.
* Keep DSD hydration independent. DSD controls initial DOM structure, while
  form association controls form participation after element upgrade.

Runtime responsibilities:

* Keep `@iktia/runtime` out of validation policy.
* Add only tiny platform helpers if generated code would otherwise duplicate
  low-level `ElementInternals` plumbing.
* Do not introduce a broad forms library as part of this capability.

Compiler responsibilities:

* Extend component option parsing beyond `styles` only when this API is ready.
* Reject `formControl()` outside a `formAssociated: true` component.
* Reject multiple ambiguous form-control bindings until multi-value controls are
  designed.
* Emit diagnostics for unsupported values such as arbitrary `FormData` objects
  until the multi-value contract is explicit.
* Preserve static analyzability: form-control binding shape must be simple
  enough for Rust/OXC analysis.

No code prototype should land with this ADR. The design exposes unresolved API
choices that would turn a quick prototype into accidental public surface. The
first implementation PR should be fixture-driven and marked experimental in
docs until the open questions below are answered.

## Alternatives

* Keep form-heavy primitives on slotted native light-DOM controls forever.
* Infer form association whenever a component renders an `<input>`.
* Expose raw `ElementInternals` through `host()` and let authors wire browser
  form APIs manually.
* Build a complete validation and form state library before supporting custom
  controls.
* Implement form actions before custom-control participation and leave Shadow
  DOM controls unable to submit values.

## Consequences

* Iktia can support real custom controls without hiding native form semantics.
* The compiler must grow a new component option and a new compiler-known
  authoring primitive.
* Form-associated controls become a generated-output responsibility, not a
  runtime framework concern.
* Primitive examples can move from slotted native light-DOM controls to real
  custom form controls once the compiler implementation lands.
* The first implementation needs browser coverage because form submission,
  reset, disabled callbacks, and validity are platform behavior.

## Open Questions

* Should the helper name be `formControl()`, `formValue()`, or a narrower
  primitive per behavior?
* Should the first implementation support only a single string value, or also
  `File`, `FormData`, and multi-value controls?
* Should state restoration through `formStateRestoreCallback()` be part of the
  first implementation or a later milestone?
* What is the authored shape for custom validity anchors and validation message
  placement?
* How should `readonly` relate to `disabled` for generated custom controls?
* Should labels be documented as external `<label for>` usage first, or should
  Iktia add helper guidance for slotted labels?
* Should the eventual TypeScript type expose the associated `HTMLFormElement`
  through a helper, or keep form references internal?

## Related Milestones

Post-v0.1 forms, M22
