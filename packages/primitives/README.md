# `@naos-ui/primitives`

`@naos-ui/primitives` is the first Naos-authored primitive component package.
The components are written as `.wc.tsx` modules and compiled to native Custom
Elements for distribution.

**Stability: experimental.** Pre-1.0 and under active design; component APIs
may change in any release.

```ts
import "@naos-ui/primitives"
```

Or import individual elements:

```ts
import "@naos-ui/primitives/button"
import "@naos-ui/primitives/toggle"
```

## First Components

| Element | Purpose | Status |
| --- | --- | --- |
| `<naos-accordion>` / `<naos-accordion-item>` | Accordion collection with roving trigger focus, disabled items, and open state events. | Experimental disclosure MVP |
| `<naos-avatar>` | Avatar with image loading state, fallback content, status events, parts, and CSS custom properties. | Experimental feedback MVP |
| `<naos-button>` | Shadow-DOM action button with slots, variants, parts, and `naos-press`. | Experimental |
| `<naos-button-group>` | Oriented grouping for action controls. | Experimental |
| `<naos-checkbox>` | ARIA checkbox primitive with checked, indeterminate, and native `FormData` behavior. | Experimental form-associated MVP |
| `<naos-collapsible>` | Disclosure primitive with trigger/content ARIA, disabled state, and open events. | Experimental disclosure MVP |
| `<naos-combobox>` / `<naos-combobox-item>` | Autocomplete combobox with input, popup items, and native `FormData` behavior. | Experimental form-associated MVP |
| `<naos-context-menu>` | Context menu region with anchored menu positioning and item selection. | Experimental overlay MVP |
| `<naos-date-picker>` | Single-date picker with input, popup day grid, keyboard movement, and native `FormData` behavior. | Experimental form-associated MVP |
| `<naos-dialog>` | Modal dialog with backdrop, focus trap, scroll lock, dismiss behavior, and focus return. | Experimental overlay MVP |
| `<naos-dropdown>` | Button-triggered dropdown/disclosure primitive. | Experimental |
| `<naos-editable>` | Inline editable text control with preview/edit modes, commit/cancel behavior, and native `FormData` behavior. | Experimental form-associated MVP |
| `<naos-field>` | Field composition shell for labels, controls, hints, and errors. | Experimental |
| `<naos-file-upload>` | File input with dropzone, picker trigger, file list, delete controls, and native `FormData` behavior. | Experimental form-associated MVP |
| `<naos-hover-card>` | Hover/focus preview card with positioned content and open events. | Experimental overlay MVP |
| `<naos-listbox>` / `<naos-listbox-item>` | Listbox with selection, typeahead, disabled items, and native `FormData` behavior. | Experimental form-associated MVP |
| `<naos-menu>` / `<naos-menu-item>` | Flat action menu with dismiss behavior, focus return, and item selection. | Experimental overlay MVP |
| `<naos-number-input>` | Numeric input with steppers, keyboard behavior, min/max clamping, and native `FormData` behavior. | Experimental form-associated MVP |
| `<naos-pin-input>` | Multi-field code input with keyboard, paste, complete, invalid, and native `FormData` behavior. | Experimental form-associated MVP |
| `<naos-popover>` | Positioned popover with Escape/outside dismiss, close trigger, and focus return. | Experimental overlay MVP |
| `<naos-progress>` | Linear progress indicator with ARIA progressbar state and indeterminate mode. | Experimental feedback MVP |
| `<naos-radio-group>` / `<naos-radio>` | Radio collection with roving focus and native `FormData` behavior. | Experimental form-associated MVP |
| `<naos-rating-group>` | Rating control with pointer/keyboard selection, hover events, and native `FormData` behavior. | Experimental form-associated MVP |
| `<naos-segmented-control>` / `<naos-segmented-item>` | Single-selection segmented control with roving focus and native `FormData` behavior. | Experimental form-associated MVP |
| `<naos-select>` / `<naos-select-item>` | Single-selection listbox popup with typeahead, open state, and native `FormData` behavior. | Experimental form-associated MVP |
| `<naos-slider>` | Single-value slider with pointer/keyboard behavior and native `FormData` behavior. | Experimental form-associated MVP |
| `<naos-switch>` | On/off switch with native `FormData` behavior. | Experimental form-associated MVP |
| `<naos-tabs>` / `<naos-tab>` / `<naos-tab-panel>` | Tab collection with subcomponent tabs, panels, roving focus, and a legacy three-panel fallback. | Experimental |
| `<naos-tags-input>` | Token input with delimiter entry, paste handling, delete controls, and native `FormData` behavior. | Experimental form-associated MVP |
| `<naos-tooltip>` | Hover/focus tooltip with positioned content, Escape close, and open events. | Experimental overlay MVP |
| `<naos-toast>` / `<naos-toast-root>` | Toast trigger and notification root with store lifecycle, dismiss behavior, parts, and CSS custom properties. | Experimental feedback MVP |
| `<naos-toggle>` | Pressed/on-off button primitive with native `FormData` behavior. | Experimental form-associated MVP |
| `<naos-toggle-group>` / `<naos-toggle-item>` | Single or multiple toggle collection with roving focus and native `FormData` behavior. | Experimental form-associated MVP |

## Contracts

The primitives expose platform-readable contracts:

* `part` names for styling hooks.
* `data-state`, `data-disabled`, `data-invalid`, and `data-orientation`.
* Overlay hooks such as `data-naos-overlay`, `data-modal`, `data-side`,
  `data-align`, `data-anchor-hidden`, and `data-layer` where applicable.
* Presence hooks such as `data-naos-presence`, `data-starting-style`, and
  `data-ending-style` where transient UI owns enter/exit timing.
* CSS custom properties with `--naos-*` names.
* Native ARIA attributes where the current `.wc.tsx` compiler surface supports them.
* Naos-prefixed `CustomEvent`s such as `naos-change`, `naos-select`, and
  `naos-press`.

Checkbox, combobox, date picker, editable, file upload, listbox, number input, pin input, radio group,
rating group, segmented control, slider, select, switch, tags input, toggle, and toggle group use the compiler-owned `formControl()` spike to generate
Form-Associated Custom Element output. They support `name`, `value`, submit,
reset, disabled fieldset propagation, and `FormData` in the current MVP, but
remain experimental until label association, validation, and broader
cross-browser coverage are complete.

Shared behavior lives in private package modules under `src/internal`. Simple
controls use native elements and the public Vercel UI SDK APIs. Adapters for slotted options and form controls live under `src/internal/ui-sdk`. Compound primitives can use the package-private
`context-request` helper for DOM-native child registration without a framework
runtime or public context API. Overlay primitives share a package-private
`overlay` helper for state attributes, geometry variable names, Escape routing,
outside-interaction classification, and layer stack ownership. Transient UI can
use the package-private `presence` helper for entering/open/closing/closed
phase attributes and animation-aware close teardown. They are intentionally not
public exports.

## Typed Elements

Every primitive ships a generated declaration file next to its module: the
element class with typed properties, typed `addEventListener` overloads for
its `CustomEvent` payloads, and a global `HTMLElementTagNameMap` entry. In a
TypeScript consumer, `document.createElement("naos-toggle")` and
`querySelector("naos-toggle")` return `NaosToggleElement`, assigning a
mistyped prop is a compile error, and `naos-change` listeners receive
`CustomEvent<{ pressed: boolean }>`.

## Checkbox value ownership

Once connected, `checkbox.checked` is the current value. The `checked`
attribute supplies the reset default. For an enabled
`<naos-checkbox name="updates" checked>`, this sequence gives:

| Operation | `.checked` | Visible state | `FormData.get("updates")` | New `naos-change` events |
| --- | --- | --- | --- | --- |
| Insert the markup | true | checked | `"on"` | 0 |
| Set `.checked = false` | false | unchecked | `null` | 0 |
| Activate the checkbox | true | checked | `"on"` | 1 |
| Remove the `checked` attribute | true | checked | `"on"` | 0 |
| Call `form.reset()` | false | unchecked | `null` | 0 |
| Remove and reinsert the same checkbox | false | unchecked | `null` | 0 |

A property write or activation marks checkedness dirty. Until then, changing
the attribute also updates the live state. Reset clears this dirty flag.
Attribute-driven updates run asynchronously. Setting the live property updates
the form value synchronously. Disabling the control or its fieldset excludes
it from submission. Set `value` to supply a submitted string other than `on`.

The independent `indeterminate` property gives the checkbox a mixed appearance.
`checked` still determines submission. Activation clears the mixed state,
flips checkedness and emits the two booleans in one event. Reset preserves the
live mixed state.

A property written before the custom element is defined is adopted on first
connection. An already upgraded element uses its generated, reflecting setter
until its first connection, so a write during that interval sets the reset
default as well. Subsequent disconnects preserve the live property.

## Switch and toggle value ownership

Switch and toggle follow the checkbox lifecycle above. Once connected,
`switchElement.checked` and `toggleElement.pressed` expose the live boolean.
Their respective `checked` and `pressed` attributes supply the reset default.
Setting the property updates the control, its ARIA state and its form value
synchronously. A user activation emits one `naos-change` with
`{ checked: boolean }` on the switch or `{ pressed: boolean }` on the toggle.
Property writes and form resets are silent.

### Alert dialogs

Set `alert` on `naos-dialog` for a modal confirmation. Supply a `title` and
`description` (or their existing slots), and use the `close` slot to label the
safe action, such as “Cancel”. This action receives initial focus. Put other
actions in the `actions` slot so they are not included in the description.
Escape and the close action dismiss the alert; an outside press does not.
The ordinary dialog retains its existing behavior.
