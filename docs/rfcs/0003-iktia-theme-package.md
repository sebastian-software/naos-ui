# RFC 0003: Iktia Theme Package

Status: Draft
Date: 2026-06-18

## Summary

Add a small `@iktia/theme` package that provides semantic CSS custom property
presets for Iktia applications and primitives.

The package should bridge Iktia's Shadow DOM primitives with app-level design
tokens through normal CSS inheritance. Host applications import a preset CSS
file, set or override CSS custom properties on `:root` or a scoped container,
and Iktia primitives consume those variables from inside their Shadow DOM.

The first slice is intentionally a package and documentation plan, not a visual
theme builder and not a CLI scaffolding feature. ShadCN's theming and create
flows are useful inspiration for semantic tokens, portable presets, dark-mode
overrides, and later apply/create workflows. Web Awesome's theming model is also
useful as a reference for scoped themes, low-specificity CSS variables,
light/dark scheme selectors, `color-scheme`, and the distinction between global
design tokens and component-level hooks.

Iktia must not copy ShadCN or Web Awesome source, component styling, DOM
structure, registry implementation, utility system, visual-builder workflow, or
runtime architecture, and must not depend on either project.

## Goals

* Ship a public package named `@iktia/theme`.
* Provide a default neutral preset that works with `@iktia/primitives`.
* Define a small semantic token vocabulary for application surfaces, actions,
  status colors, controls, focus rings, radius, and font families.
* Keep component-specific `--iktia-*` override hooks valid for users who need
  per-primitive control.
* Make light and dark themes work through CSS variable overrides, not through
  component re-rendering or a JavaScript theme runtime.
* Set `color-scheme` with the same selectors that apply light and dark tokens.
* Use low-specificity theme selectors so host applications can override preset
  tokens with ordinary CSS.
* Keep the package independent from React, ShadCN, Tailwind, Radix, CSS-in-JS,
  font loaders, icon packages, and framework adapters.
* Leave a clear later path for preset application and create-style tooling
  without changing the v0.1 CLI scope.

## Non-Goals

* Do not use ShadCN as a dependency.
* Do not use Web Awesome as a dependency.
* Do not copy ShadCN code, CSS, component names, DOM structure, visual style, or
  registry implementation.
* Do not copy Web Awesome code, CSS, component names, DOM structure, visual
  style, utility classes, palette matrix, or builder workflow.
* Do not require Tailwind or generate Tailwind configuration.
* Do not add an Iktia CSS graph, Sass pipeline, PostCSS contract, CSS Modules
  contract, constructable stylesheet contract, or CSS-in-JS runtime.
* Do not add `iktia init`, `iktia create`, project scaffolding, or a visual
  builder in this first slice.
* Do not move primitive behavior or component rendering into `@iktia/theme`.
* Do not make `@iktia/primitives` an opinionated design system package.
* Do not load fonts or icons automatically.

## Existing Constraints

This package must fit the accepted Iktia architecture:

* Iktia components compile to platform-native Custom Elements with Shadow DOM.
* Component CSS currently uses Vite `?inline` CSS text imports and flat
  `ComponentOptions.styles`.
* The accepted v0.1 theming mechanism is CSS custom properties.
* Host pages can set CSS variables on the element or any ancestor, and those
  values inherit into Shadow DOM.
* Primitive styling contracts use `part`, slots, `data-state`,
  `data-disabled`, `data-invalid`, `data-orientation`, ARIA, and documented CSS
  custom properties.
* The v0.1 CLI is limited to `compile`, `prerender`, and `info`; it does not
  include `init`, `create`, or project scaffolding.

## Decisions

* `@iktia/theme` is a separate package from `@iktia/primitives`.
* `@iktia/theme` owns reusable theme presets and token metadata.
* `@iktia/primitives` owns component CSS, parts, slots, state attributes,
  events, accessibility behavior, and component-specific override variables.
* Presets are distributed as CSS files plus typed JavaScript metadata.
* The first preset is `neutral`.
* Theme CSS exposes both default root tokens and named theme scopes through
  low-specificity selectors.
* Theme CSS is wrapped in `@layer iktia-theme` so ordinary application CSS can
  override preset defaults without relying on import order.
* Light mode is the default token set.
* Named theme scopes use `[data-iktia-theme="<name>"]`.
* Dark mode uses `[data-iktia-color-scheme="dark"]` as the public selector.
* Theme CSS sets `color-scheme: light` or `color-scheme: dark` with the same
  selectors that apply the matching token values.
* Scoped themes are supported by placing preset variables on a container
  instead of `:root`.
* Component CSS should prefer fallback chains from component-specific variables
  to semantic tokens to literal last-resort values.
* Future CLI or visual tooling must consume the same preset data model rather
  than inventing a second theme format.

## Public Surface

The first public CSS entry point:

```ts
import "@iktia/theme/neutral.css"
```

The first public TypeScript entry point:

```ts
import { neutralTheme, type IktiaThemePreset } from "@iktia/theme"
```

The first public selector surface:

```html
<html data-iktia-theme="neutral">
<html data-iktia-theme="neutral" data-iktia-color-scheme="dark">
<section data-iktia-theme="neutral" data-iktia-color-scheme="dark">
```

The public preset shape:

```ts
export type IktiaThemeTokens = Record<string, string>

export type IktiaThemePreset = {
  readonly name: string
  readonly title: string
  readonly tokens: {
    readonly theme: IktiaThemeTokens
    readonly light: IktiaThemeTokens
    readonly dark: IktiaThemeTokens
  }
}
```

Token object keys omit the CSS variable prefix. The build output prefixes them
with `--iktia-`.

Example:

```ts
export const neutralTheme = {
  name: "neutral",
  title: "Neutral",
  tokens: {
    theme: {
      "font-sans": 'Inter, ui-sans-serif, system-ui, sans-serif',
      "font-mono": '"SFMono-Regular", Consolas, monospace',
      radius: "0.375rem",
      "radius-sm": "calc(var(--iktia-radius) * 0.66)",
      "radius-md": "var(--iktia-radius)",
      "radius-lg": "calc(var(--iktia-radius) * 1.33)",
      "radius-xl": "calc(var(--iktia-radius) * 1.66)",
    },
    light: {
      background: "#f8fafc",
      foreground: "#17201b",
      surface: "#ffffff",
      "surface-foreground": "#17201b",
      overlay: "#ffffff",
      "overlay-foreground": "#17201b",
      primary: "#0f766e",
      "primary-foreground": "#f8fffb",
      secondary: "#e2f3ea",
      "secondary-foreground": "#0f3f35",
      muted: "#edf4f0",
      "muted-foreground": "#58665f",
      accent: "#dff4ef",
      "accent-foreground": "#0f3f35",
      success: "#16815f",
      "success-foreground": "#f2fff8",
      warning: "#a15c00",
      "warning-foreground": "#fff8e5",
      danger: "#b42318",
      "danger-foreground": "#fff7f5",
      border: "#d6ded9",
      input: "#65736d",
      ring: "#0f766e",
    },
    dark: {
      background: "#101412",
      foreground: "#eef7f2",
      surface: "#171d1a",
      "surface-foreground": "#eef7f2",
      overlay: "#1d2420",
      "overlay-foreground": "#eef7f2",
      primary: "#5eead4",
      "primary-foreground": "#063832",
      secondary: "#24312d",
      "secondary-foreground": "#d8f5ec",
      muted: "#202925",
      "muted-foreground": "#9fb1aa",
      accent: "#1d3a35",
      "accent-foreground": "#d8f5ec",
      success: "#5ee6a8",
      "success-foreground": "#062d20",
      warning: "#fbbf24",
      "warning-foreground": "#332000",
      danger: "#f87171",
      "danger-foreground": "#3b0a0a",
      border: "#34433d",
      input: "#50635b",
      ring: "#5eead4",
    },
  },
} satisfies IktiaThemePreset
```

The generated `neutral.css` should look like this in shape, not necessarily in
exact color values:

```css
@layer iktia-theme {
  :where(:root),
  :where([data-iktia-theme="neutral"]) {
    color-scheme: light;
    --iktia-font-sans: Inter, ui-sans-serif, system-ui, sans-serif;
    --iktia-font-mono: "SFMono-Regular", Consolas, monospace;
    --iktia-radius: 0.375rem;
    --iktia-radius-sm: calc(var(--iktia-radius) * 0.66);
    --iktia-radius-md: var(--iktia-radius);
    --iktia-radius-lg: calc(var(--iktia-radius) * 1.33);
    --iktia-radius-xl: calc(var(--iktia-radius) * 1.66);
    --iktia-background: #f8fafc;
    --iktia-foreground: #17201b;
    --iktia-surface: #ffffff;
    --iktia-surface-foreground: #17201b;
    --iktia-overlay: #ffffff;
    --iktia-overlay-foreground: #17201b;
    --iktia-primary: #0f766e;
    --iktia-primary-foreground: #f8fffb;
    --iktia-secondary: #e2f3ea;
    --iktia-secondary-foreground: #0f3f35;
    --iktia-muted: #edf4f0;
    --iktia-muted-foreground: #58665f;
    --iktia-accent: #dff4ef;
    --iktia-accent-foreground: #0f3f35;
    --iktia-success: #16815f;
    --iktia-success-foreground: #f2fff8;
    --iktia-warning: #a15c00;
    --iktia-warning-foreground: #fff8e5;
    --iktia-danger: #b42318;
    --iktia-danger-foreground: #fff7f5;
    --iktia-border: #d6ded9;
    --iktia-input: #65736d;
    --iktia-ring: #0f766e;
  }

  :where([data-iktia-color-scheme="dark"]),
  :where([data-iktia-theme="neutral"][data-iktia-color-scheme="dark"]) {
    color-scheme: dark;
    --iktia-background: #101412;
    --iktia-foreground: #eef7f2;
    --iktia-surface: #171d1a;
    --iktia-surface-foreground: #eef7f2;
    --iktia-overlay: #1d2420;
    --iktia-overlay-foreground: #eef7f2;
    --iktia-primary: #5eead4;
    --iktia-primary-foreground: #063832;
    --iktia-secondary: #24312d;
    --iktia-secondary-foreground: #d8f5ec;
    --iktia-muted: #202925;
    --iktia-muted-foreground: #9fb1aa;
    --iktia-accent: #1d3a35;
    --iktia-accent-foreground: #d8f5ec;
    --iktia-success: #5ee6a8;
    --iktia-success-foreground: #062d20;
    --iktia-warning: #fbbf24;
    --iktia-warning-foreground: #332000;
    --iktia-danger: #f87171;
    --iktia-danger-foreground: #3b0a0a;
    --iktia-border: #34433d;
    --iktia-input: #50635b;
    --iktia-ring: #5eead4;
  }
}
```

## Token Model

The v1 token set is intentionally small and semantic:

| Token | Purpose |
| --- | --- |
| `background` / `foreground` | Page or application shell defaults. |
| `surface` / `surface-foreground` | Cards, panels, fields, controls, and default primitive surfaces. |
| `overlay` / `overlay-foreground` | Dropdowns, popovers, menus, dialogs, and floating layers. |
| `primary` / `primary-foreground` | High-emphasis actions, selected states, and active accents. |
| `secondary` / `secondary-foreground` | Lower-emphasis filled actions and supporting controls. |
| `muted` / `muted-foreground` | Hints, descriptions, inactive text, and quiet surfaces. |
| `accent` / `accent-foreground` | Hover, highlighted, checked, and selected item states. |
| `success` / `success-foreground` | Positive status, successful validation, and completion states. |
| `warning` / `warning-foreground` | Caution, pending, and recoverable warning states. |
| `danger` / `danger-foreground` | Invalid, destructive, and error states. |
| `border` | Default dividers and structural borders. |
| `input` | Form control borders and outline-style control treatment. |
| `ring` | Focus-visible outline and active focus affordances. |
| `radius` | Base corner radius. |
| `radius-sm`, `radius-md`, `radius-lg`, `radius-xl` | Derived radius scale for component families. |
| `font-sans`, `font-mono` | Font-family variables only; package does not load font files. |

The token vocabulary should not include component-specific names such as
`button-bg` or `select-border`. Those remain primitive override hooks and are
owned by `@iktia/primitives`.

Web Awesome's broader token categories are useful future references, especially
component-group tokens, focus tokens, shadows, spacing, transitions, typography,
and variant role mapping. They are intentionally not part of the first token
set unless a primitive integration proves that a shared group token removes real
duplication.

## Reference Learnings

Web Awesome's current theming system layers themes, palettes, variant roles, and
light/dark schemes through classes on the page or a scoped subtree. That is
more product surface than Iktia should adopt in v1, but several ideas are worth
keeping:

* Use low-specificity selectors for preset tokens so application CSS can
  override them easily.
* Support named theme scopes in addition to default root tokens.
* Set `color-scheme` alongside light and dark token overrides.
* Reserve success and warning tokens early so feedback and validation
  components do not have to overload `danger` and `accent`.
* Keep global design tokens separate from component-level override hooks.

The first Iktia theme package should not adopt Web Awesome's full hue-scale
palette matrix, utility class layer, hosted project workflow, or visual theme
builder. Those can be evaluated later if Iktia needs more than one default
preset and a real preset creation workflow.

## Primitive CSS Integration

Primitive CSS should keep existing component-level variables as the first
override point. The new semantic tokens become shared fallbacks.

Example button fallback direction:

```css
:host {
  color: var(--iktia-button-fg, var(--iktia-foreground, #17201b));
  font: inherit;
}

button {
  border-color: var(--iktia-button-border, var(--iktia-border, #26584a));
  border-radius: var(--iktia-button-radius, var(--iktia-radius-md, 0.375rem));
  background: var(--iktia-button-bg, var(--iktia-surface, #f3faf6));
}

button:hover {
  background: var(--iktia-button-bg-hover, var(--iktia-accent, #e2f3ea));
}

button:focus-visible {
  outline-color: var(--iktia-focus-ring, var(--iktia-ring, #0f766e));
}

button[data-variant="primary"] {
  border-color: var(--iktia-button-primary-border, var(--iktia-primary, #0f766e));
  background: var(--iktia-button-primary-bg, var(--iktia-primary, #0f766e));
  color: var(--iktia-button-primary-fg, var(--iktia-primary-foreground, #f8fffb));
}
```

This gives users three levels of control:

1. Import a preset and use the default look.
2. Override semantic tokens for the whole application or a scoped subtree.
3. Override primitive-specific variables for exact component-level changes.

Primitive CSS must not remove existing documented variables during this pass
unless a separate stability review accepts the break. Because primitives are
still experimental, names can still be rationalized, but the implementation
should prefer additive compatibility wherever practical.

## Package Shape

The package should live at `packages/theme`.

Recommended source layout:

```txt
packages/theme/
  package.json
  tsconfig.json
  scripts/build-theme.mjs
  src/index.ts
  src/presets/neutral.ts
  src/theme.test.ts
```

Recommended generated layout:

```txt
packages/theme/dist/
  index.mjs
  index.d.mts
  neutral.css
```

Recommended `package.json` exports:

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.mts",
      "import": "./dist/index.mjs"
    },
    "./neutral.css": "./dist/neutral.css"
  },
  "files": ["dist/", "README.md"],
  "sideEffects": ["./dist/*.css"]
}
```

The build script should generate CSS from the preset data so the TypeScript
metadata and CSS entry points cannot drift. Hand-written CSS fixtures may exist
in tests, but package output should come from the preset object.

The package should not depend on `@iktia/primitives`. It can be used by any host
page, and primitives only consume the resulting CSS variables.

## Milestones

### M1: Package Foundation

Add `packages/theme` as a public workspace package.

Deliverables:

* Add `@iktia/theme` package metadata, TypeScript config, build script, tests,
  README, and package exports.
* Add the `IktiaThemePreset` and `IktiaThemeTokens` public types.
* Add `neutralTheme` as the first preset.
* Generate `dist/neutral.css` from `neutralTheme`.
* Wire the package into release and workspace validation where required:
  release-please config, release manifest, release workflow, and
  `scripts/check-release-set.mjs`.

Acceptance criteria:

* `import "@iktia/theme/neutral.css"` resolves from a built package.
* `import { neutralTheme } from "@iktia/theme"` resolves from a built package.
* CSS output is deterministic and covered by tests.
* The package tarball includes only intended distribution files.

### M2: Primitive Token Integration

Refactor existing primitive CSS fallbacks to consume semantic tokens while
preserving primitive-specific override hooks.

Deliverables:

* Replace direct literal-only fallbacks with component-variable to semantic-token
  to literal fallback chains.
* Normalize focus ring usage around `--iktia-focus-ring` falling back to
  `--iktia-ring`.
* Map form controls to `--iktia-input`, `--iktia-border`, `--iktia-surface`,
  `--iktia-foreground`, and `--iktia-danger` where appropriate.
* Map overlay-like primitives to `--iktia-overlay` and
  `--iktia-overlay-foreground` where appropriate.
* Map selected, checked, highlighted, hover, and active item states to
  `--iktia-accent` or `--iktia-primary` based on emphasis.
* Map successful validation, warning, and destructive states to
  `--iktia-success`, `--iktia-warning`, and `--iktia-danger` respectively.

Acceptance criteria:

* Existing primitive examples still render without importing `@iktia/theme`.
* Importing `@iktia/theme/neutral.css` changes shared styling through semantic
  tokens without requiring component source changes.
* Component-specific overrides still win over semantic tokens.
* Existing browser tests for parts, state attributes, and form behavior still
  pass.

### M3: Documentation

Document the theming model as a first-class Iktia workflow.

Deliverables:

* Add a docs guide for installing `@iktia/theme`, importing `neutral.css`,
  toggling `[data-iktia-color-scheme="dark"]`, and overriding tokens.
* Add a preset example showing a scoped theme container.
* Add a primitive variable matrix that distinguishes semantic theme tokens from
  component-specific override variables.
* Update package reference docs to list `@iktia/theme`.
* Update demos or docs examples to show theme CSS crossing the Shadow DOM
  boundary.
* Document the relationship to ADR 0017 so users understand which selectors and
  token layers are durable decisions.

Acceptance criteria:

* A user can apply the default preset from docs alone.
* A user can create a local theme override without reading primitive source.
* Docs clearly state that fonts must be loaded by the host application.
* Docs clearly state that `@iktia/theme` does not require Tailwind or ShadCN.

### M4: Verification

Add tests that prove the package, generated CSS, and primitive integration work
together.

Deliverables:

* Unit tests for preset schema rules and generated CSS output.
* Package build/export tests for `@iktia/theme`.
* Browser coverage proving CSS variables from `@iktia/theme/neutral.css`
  cross Shadow DOM boundaries into primitives.
* Browser coverage proving `[data-iktia-color-scheme="dark"]` changes computed
  styles inside at least one primitive Shadow DOM.
* Browser coverage proving `[data-iktia-theme="neutral"]` can scope theme
  variables to a subtree.
* Browser coverage proving `color-scheme` changes with the selected theme
  scheme.
* Regression coverage proving component-specific overrides beat semantic tokens.

Acceptance criteria:

* `pnpm --filter @iktia/theme build` passes.
* `pnpm --filter @iktia/theme test` passes.
* `pnpm check` passes after implementation.
* `pnpm test` passes after implementation.
* `pnpm test:examples` passes after implementation.
* `npm pack --dry-run --json` for changed public packages shows no leaked
  source scratch files or missing distribution files.

### M5: Follow-Up Planning

Capture later tooling without implementing it in v1.

Deliverables:

* Add a follow-up issue or later RFC for `iktia theme apply`.
* Add a follow-up issue or later RFC for a create-style visual preset builder.
* Define that future tooling must consume `IktiaThemePreset` data and emit the
  same CSS variable contract as `@iktia/theme`.
* Revisit ADR 0014 before adding any project scaffolding or `create` command to
  `@iktia/cli`.

Acceptance criteria:

* The v1 package is useful without CLI tooling.
* Future CLI and visual-builder work has a clear data contract.
* No v0.1 CLI scope is expanded as part of this RFC.

## Test Strategy

The implementation should use the same layered approach as the primitives
package:

* Package unit tests for preset validation and CSS generation.
* Type tests or compile checks for public preset exports.
* Browser tests for actual computed styles inside Shadow DOM.
* Docs examples that exercise the public import paths.
* Package tarball checks before publishing.

Recommended command sequence after implementation:

```sh
pnpm --filter @iktia/theme build
pnpm --filter @iktia/theme test
pnpm check
pnpm test
pnpm test:examples
npm pack --dry-run --json
```

Run `npm pack --dry-run --json` from each changed public package that will be
published.

## Acceptance Criteria

This RFC is complete when:

* The package boundary between `@iktia/theme` and `@iktia/primitives` is
  unambiguous.
* The initial public import paths are explicit.
* The dark-mode selector is explicit.
* The semantic token vocabulary is explicit.
* Primitive CSS fallback precedence is explicit.
* The first implementation can proceed without deciding token scope, package
  ownership, dark-mode shape, or CLI scope.
* Existing unrelated workspace changes are preserved and not treated as part of
  the theming implementation.

## Future Work

Future work can add more presets, preset registries, visual editing, and CLI
application flows. Those efforts must stay downstream of the v1 token contract.

Possible future commands:

```sh
iktia theme apply neutral
iktia theme apply ./theme.json
iktia theme inspect
```

Possible create-style workflow:

* choose base colors, radius, fonts, and density in a browser UI;
* preview the result against real Iktia primitives;
* export an `IktiaThemePreset` JSON object and CSS file;
* optionally apply the preset to a project after a later CLI-scope decision.

These commands and visual workflows are intentionally not part of the first
implementation slice.

## Related Decisions

* [ADR 0017: Theme Package And Token Boundary](../adrs/0017-theme-package-and-token-boundary.md)
