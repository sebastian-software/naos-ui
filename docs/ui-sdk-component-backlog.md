# UI SDK component backlog

**Evidence.** The catalogue below covers all 55 component guides in the [Vercel UI SDK source at `8060d16`](https://github.com/vercel-labs/ui/tree/8060d16d7a9ab3fc79fee25764607344df078c36/apps/docs/content/docs/web-components/components). The Naos baseline is `1596ab0`. “Existing” means the principal use case has a Naos counterpart. The comparison uses [primitive exports](../packages/primitives/package.json), source, and the [primitive README](../packages/primitives/README.md). It is a contract inventory based on static inspection. Existing entries can still differ in behavior and browser support.

**Sequence.** Improve Menu, Combobox and form composition first. Start date entry with the standalone single-date field, then reuse the segment model for time. Extract Calendar independently when an inline date-selection use case warrants it. Schedule Drawer, Tree and Resizable as extended work after the relevant core behavior is verified. [The Zag roadmap](rfcs/0002-zag-backed-primitives-roadmap.md) already defers Drawer, Tree View, Splitter and several specialized controls until the core set is stable. [The Base UI audit](base-ui-primitive-architecture-audit.md) records the underlying overlay, focus, presence and form-contract recommendations. Use the [primitive migration plan](ui-sdk-primitive-migration.md) for migration gates and dependency order. Track migration in [#185](https://github.com/sebastian-software/naos-ui/issues/185).

## Catalogue disposition

| UI SDK guide | Naos coverage | Backlog decision |
| --- | --- | --- |
| Accordion | Existing `accordion` and `accordion-item` | Keep the existing disclosure API. |
| Alert Dialog | `dialog` covers the overlay. Dedicated alert semantics and safe initial focus are missing. | Extend Dialog first. |
| Autocomplete | `combobox` filters choices and submits a selected value. Free text as the committed value is missing. | Extend Combobox first. |
| Avatar | Existing `avatar` | Keep the existing image/fallback API. |
| Button | Existing `button`. The SDK adds pending and focusable-disabled behaviors. | Handle pending submission in the action/form contract and document native button/link composition. |
| Calendar | Date Picker has a month grid inside its popup. | Extract an inline single-date Calendar after a consumer needs it. |
| Carousel | No primitive. CSS scroll snap and real buttons cover basic paging. | Defer a component. Revisit when accessible selection and rotation need reuse. |
| Checkbox | Existing individual form-associated `checkbox`. | Use a native fieldset and repeated names first. Evaluate a group contract only for shared required/min/max rules or aggregate selection. |
| Collapsible | Existing `collapsible` | Keep the existing disclosure API. |
| Color Picker | No primitive. Native color input covers basic selection. | Defer synchronized color-channel editing and parsing until product demand. |
| Combobox | Existing single-value `combobox` and `combobox-item`. | Preserve current selection. Treat multi-selection and richer option collections as separate follow-ups. |
| Command | No dedicated action picker. Dialog and collections supply building blocks. | Prototype a palette as a recipe. Promote shared behavior if another consumer needs it. |
| Date Input | Date Picker uses one text input. | Add locale-ordered segmented date entry as a standalone form control. |
| Date Picker | Existing single-date `date-picker` | Keep the single-date contract. Consider range selection after the calendar contract is proven. |
| Dialog | Existing `dialog` | Reuse the overlay and presence work. |
| Drawer | No primitive. Dialog supplies modal behavior. | Add a sheet in extended scope when an edge-anchored, dismissible interaction is needed. |
| Field | Existing `field` hosts label, hint and error slots. Association is left to the caller. | Document and verify label, focus and description wiring through the form contract. |
| File Input | Existing `file-upload` covers chooser, drop and form submission. | Keep the existing name. Validate paste and additional constraints as targeted gaps when needed. |
| Hover Card | Existing `hover-card` | Verify normal link activation as part of trigger composition. |
| Image Cropper | No primitive. | Defer to a media-specific feature with a defined editing workflow. |
| Input | Native `input` and `field` cover ordinary entry. Native composition covers adornments and clear controls. | Document the recipe and identify any missing behavior in field composition. |
| Label | Native `label` handles labelable controls. Some composites need an explicit accessible-name and focus contract. | Solve it in field and composite contracts before considering a new label element. |
| Listbox | Existing `listbox` and `listbox-item`, including multiple selection. | Verify range selection before documenting it as part of the existing family. |
| Menu | Existing flat `menu`, `menu-item` and `context-menu`. | Extend in two steps, starting with stateful items, followed by submenus. |
| Menubar | No coordinated application menubar. | Defer until submenus and shared focus navigation are proven and there is an app-menu consumer. |
| Meter | Native `meter` supplies measurement semantics. | Document native use. |
| Navigation Menu | Existing disclosure and links cover basic site navigation. Coordinated panel switching is missing. | Document grouped disclosures with links and keep site navigation semantics. |
| Number Input | Existing `number-input` with steppers. | Treat locale formatting and scrubbing as extensions if needed. |
| OTP Input | Existing `pin-input` with OTP mode, paste and form participation. | Keep the existing name. Verify autofill on supported browsers as needed. |
| Pagination | Native links/buttons and existing router navigation cover page changes. | Provide a route-aware recipe if repeated. Keep page counts and URL policy with the application. |
| Password Input | Native password input covers submission and password manager metadata. | Document a reveal toggle recipe with caret preservation and native autocomplete attributes. |
| Popover | Existing `popover` | Reuse the overlay conformance work. |
| Preferences | No dedicated wrapper. CSS media queries and theme scope cover common preferences. | Keep persisted overrides with the application until data-attribute publication has a repeated consumer. |
| Progress | Existing `progress` | Keep the existing feedback API. |
| Radio | Existing `radio-group` and `radio` | Keep the existing names. |
| Rating | Existing `rating-group`, including half steps. | Keep the existing name. |
| Resizable | No interactive split-pane primitive. | Add a constrained two-pane splitter in extended scope when a workspace needs adjustable panes. |
| Scroll Area | CSS overflow and native scrolling cover basic use. Rich thumb/edge/follow controls are missing. | Use native scrolling. Evaluate edge or follow behavior as a helper before a custom scrollbar. |
| Segmented Control | Existing `segmented-control` and `segmented-item` | Keep the existing selection API. |
| Select | Existing single-value `select` and `select-item`. | Evaluate multi-value submission separately from Combobox free-text behavior. |
| Separator | Native `hr`, `role="separator"`, or CSS cover the semantic and decorative cases. | Document native use and distinguish it from an interactive splitter. |
| Slider | Existing `slider` | Treat multithumb behavior as a Slider extension if demanded. |
| Switch | Existing `switch` | Keep the existing boolean control. |
| Tabs | Existing `tabs`, `tab` and `tab-panel` | Keep the existing panel lifecycle. |
| Textarea | Native `textarea` and `field` cover multiline entry. | Document native composition and an autoresize recipe if repeated. |
| Time Input | No locale-ordered segmented time control. Native time input covers basic forms. | Reuse the Date Input segment contract when a product needs consistent localized segment editing. |
| Timeline | Ordered list and `time` cover static content. | Keep as native markup unless keyboard navigation through interactive events is a repeated need. |
| Toast | Existing `toast` and `toast-root` | Keep announcement and dismissal work in the existing family. |
| Toggle | Existing `toggle`, `toggle-group` and `toggle-item` | Keep the existing pressed and group selection API. |
| Token Input | Existing `tags-input` covers discrete tags. Mixed inline text and atomic typed tokens are missing. | Keep Tags Input for lists. Defer rich editing to a demonstrated editor workflow. |
| Toolbar | Existing `button-group` is structural. Roving focus across heterogeneous controls is missing. | Add a focus contract after testing composition with existing controls and native fields. |
| Tooltip | Existing `tooltip` | Verify compound triggers with the shared overlay work. |
| Tree | No hierarchical collection primitive. | Add a single-selection tree in extended scope if a consumer needs keyboard navigation through nested items. |
| Trigger Menu | No caret-anchored suggestions. Combobox supplies a collection model. | Defer pending a real mentions or slash-command editor. Treat caret anchoring and insertion together. |
| Waterfall | No hierarchical duration visualizer. | Defer as a diagnostics feature. A future implementation can reuse hierarchical navigation where its treegrid semantics allow. |

## Implementation tickets

Keep existing public names and defaults when extending a primitive. Document the Web Component contract and validate build, type checking and tests with `pnpm --filter @naos-ui/primitives build`, `pnpm --filter @naos-ui/primitives check-types` and `pnpm --filter @naos-ui/primitives test`. Include real-browser focus, keyboard, pointer or form checks where the capability relies on them. See the [primitive contract ADR](adrs/0008-primitive-contracts-parts-slots-data-state.md) and [form-associated controls ADR](adrs/0018-form-associated-custom-element-support.md).

### Existing primitive extensions

- **[Add checkbox and radio items to Menu (#196)](https://github.com/sebastian-software/naos-ui/issues/196).** Specify item rendering and state ownership with the existing `menu`, `menu-item` and `context-menu` contracts. Prove named groups, disabled items, mixed checkbox state where supported, radio exclusivity, keyboard activation, dismissal behavior and existing action selection.
- **[Add nested submenus with scoped keyboard and dismissal behavior (#197)](https://github.com/sebastian-software/naos-ui/issues/197).** Build on the overlay stack and trigger composition contracts. Verify arrow navigation including RTL, mouse/pointer entry, Escape closing the active layer, outside press, restoration to the parent trigger and teardown when a parent disconnects.
- **[Support text suggestions with free-text submission (#198)](https://github.com/sebastian-software/naos-ui/issues/198).** Add an opt-in mode to `combobox` unless the API needs a distinct control to avoid ambiguous state. Verify unmatched text survives blur and submits, choosing a suggestion fills the text, Escape closes without committing a highlight, IME composition survives, and reset preserves the existing selected-option mode's contract.
- **[Support alert-dialog semantics in Dialog (#199)](https://github.com/sebastian-software/naos-ui/issues/199).** Reuse modal focus trapping, close and teardown. Verify a programmatic and user-opened dialog has the correct role, name and description, focuses a safe action, applies explicit outside-dismissal behavior, and restores focus across confirm, cancel and Escape. Agree on the extension point before giving it a public tag.
- **Define native field composition for labels, hints and errors.** Use `field`, native text controls and existing form-associated controls as fixtures. Verify accessible names, optional descriptions, invalid/error display, label activation, behavior across Shadow DOM boundaries, repeat-name checkbox groups and disabled fieldsets. Fold into the existing form-contract work. Consider a group component separately if the native recipe cannot express observed requirements.

### New capabilities

- **[Add locale-aware segmented date entry (#200)](https://github.com/sebastian-software/naos-ui/issues/200).** Deliver a standalone single-date field with stable ISO date submission, localized segment order and a native form contract. Verify keyboard editing, paste, incomplete and impossible dates, constraints, localized display vs value, reset and disabled fieldsets. Use the existing date-picker adapter and `@internationalized/date` where suitable.
- **Add locale-aware segmented time entry.** Reuse Date Input's keyboard, naming and validation contract after it lands. Verify 12/24-hour formats, noon and midnight, incomplete segments, ISO-style local time submission, and reset. Define seconds precision in the public value contract.
- **Expose the date picker month grid as an inline Calendar.** Identify the reusable month-grid contract in `date-picker` and start with one selected date. Verify keyboard movement across month boundaries, disabled dates, locale week starts, selected versus focused styling and continued Date Picker behavior. Consider range and multi-date selection after two contexts exercise the single-date contract.
- **[Add a two-pane resizable splitter (#202)](https://github.com/sebastian-software/naos-ui/issues/202).** Verify the interactive separator exposes orientation and a meaningful value, supports keyboard and pointer resizing, honors both panes' constraints, and handles host resize, RTL and pointer cancellation. Keep persistence and multi-pane layout out of the first slice.
- **[Add a single-selection Tree primitive (#203)](https://github.com/sebastian-software/naos-ui/issues/203).** Start with authored nested items and a stable item identity. Verify expand/collapse, arrows, Home/End, typeahead, focus and selection restoration when a branch disappears, disabled items, and the event contract. Treat checkboxes, lazy loading and virtualization as follow-ups.
- **[Add a roving-focus Toolbar for existing controls (#201)](https://github.com/sebastian-software/naos-ui/issues/201).** Verify one Tab stop, arrow navigation with RTL and orientation, disabled controls, native text editing inside the toolbar, and focus after menu dismissal or item removal. Use authored controls with native semantics.
- **[Add an accessible edge Drawer (#204)](https://github.com/sebastian-software/naos-ui/issues/204).** Depend on the shared modal and presence contracts. Verify naming, focus containment and return, background interaction, dismissal, scroll lock, reduced motion and mobile visual viewport. Scope the first slice to edge placement and modal behavior. Add drag, snapping and resize only for an observed interaction need.

### Recipes and later decisions

- **Document a command palette composition.** Use Dialog, a text field and existing collection behavior. Prove search, highlighting, action activation and focus return in one sample before designing a public command component. Add nested pages only with a second use case.
- **Document password visibility with native forms.** Show a labeled password input, current/new-password autocomplete values, a non-submit reveal button with state, caret retention, and a deliberate visibility reset on submit.
- **Revisit deferred specialist controls when a consumer exists.** Record the required interaction and accessibility semantics from that consumer. Prioritize a reusable primitive only when native markup or the current Naos composition fails to provide the needed contract.
