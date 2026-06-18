# ADR 0017: Theme Package And Token Boundary

Status: Accepted

Weight: P1

## Context

Iktia primitives expose platform-native styling contracts through Shadow DOM,
parts, slots, state attributes, ARIA, and CSS custom properties. ADR 0015
already establishes CSS custom properties as the v0.1 theming mechanism, but it
does not define where reusable theme presets live or how package-level theme
tokens relate to primitive-specific override hooks.

Reference systems such as ShadCN and Web Awesome show useful patterns for this
boundary. ShadCN demonstrates portable theme presets and create/apply workflows.
Web Awesome demonstrates stackable theme, palette, variant, and light/dark
scheme layers, low-specificity CSS token selectors, scoped light/dark sections,
and a clear split between global design tokens and component-level styling
hooks.

Iktia should learn from those systems without copying their source, component
CSS, DOM structure, registry shape, palette matrix, utility classes, hosted
project workflow, or visual builder.

## Decision

Create a separate `@iktia/theme` package for reusable theme presets and token
metadata.

The `@iktia/theme` package owns semantic CSS custom properties and generated
preset CSS. The `@iktia/primitives` package owns primitive component CSS,
parts, slots, state attributes, events, accessibility behavior, and
primitive-specific override variables.

Theme CSS uses Iktia-prefixed global tokens such as `--iktia-background`,
`--iktia-surface`, `--iktia-primary`, `--iktia-success`, `--iktia-warning`,
`--iktia-danger`, `--iktia-border`, `--iktia-input`, `--iktia-ring`,
`--iktia-radius`, and `--iktia-font-sans`.

Theme CSS must use low-specificity selectors so host applications can override
tokens without fighting the preset. Generated preset CSS should also use a
named cascade layer, `iktia-theme`, so normal application CSS can override theme
defaults without depending on import order. The default selector shape is:

```css
@layer iktia-theme {
  :where(:root),
  :where([data-iktia-theme="neutral"]) {
    color-scheme: light;
  }

  :where([data-iktia-color-scheme="dark"]),
  :where([data-iktia-theme="neutral"][data-iktia-color-scheme="dark"]) {
    color-scheme: dark;
  }
}
```

The public theme selectors are:

* `data-iktia-theme="<name>"` for a named theme scope;
* `data-iktia-color-scheme="dark"` for dark-mode overrides.

Light mode is the default token set. Dark mode is opt-in through
`data-iktia-color-scheme="dark"` on `:root` or a subtree. The CSS `color-scheme`
property must be set with the same selectors so native controls and browser UI
match the selected scheme.

Primitive CSS must use fallback chains that preserve component-specific
overrides while consuming semantic theme tokens:

```css
border-color: var(--iktia-button-border, var(--iktia-border, #26584a));
background: var(--iktia-button-bg, var(--iktia-surface, #f3faf6));
outline-color: var(--iktia-focus-ring, var(--iktia-ring, #0f766e));
```

Do not adopt a full Web Awesome-style palette and variant class system in the
first theme slice. Variant roles such as success and warning are reserved as
semantic tokens, but a complete hue-scale matrix, utility layer, and visual
theme builder require later RFCs or ADRs.

Do not add `iktia init`, `iktia create`, or `iktia theme apply` as part of the
first theme package. CLI theming workflows require a later update to the
minimal CLI scope decision.

## Alternatives

* Put theme CSS and token metadata directly in `@iktia/primitives`.
* Keep theming as docs-only snippets with no installable package.
* Adopt ShadCN's theme registry shape directly.
* Adopt Web Awesome's full stackable theme, palette, variant, utility, and
  builder model immediately.
* Use unprefixed global theme custom properties.
* Add a JavaScript theme runtime or CSS-in-JS layer.

## Consequences

* `@iktia/primitives` stays focused on behavior, accessibility, DOM contracts,
  and minimal default CSS.
* `@iktia/theme` can evolve reusable presets without becoming a component
  runtime.
* Host applications can theme globally or per subtree with normal CSS
  inheritance.
* Component-specific variables remain the exact override layer for individual
  primitives.
* `color-scheme` keeps native controls aligned with light and dark tokens.
* The first implementation stays smaller than Web Awesome's full theme system
  while preserving a later path to palettes, variant-role mapping, grouped
  control tokens, and visual tooling.

## Related Milestones

RFC 0003
