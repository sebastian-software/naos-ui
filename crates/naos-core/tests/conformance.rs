//! Local compiler conformance fixtures for accepted, rejected, and DSD output.

use naos_core::{
    DiagnosticSeverity, PackageContext, render_declarative_shadow_dom_module_with_inline_styles,
    transform_component_module,
};

fn test_package() -> PackageContext {
    PackageContext {
        name: "@naos-ui/test".to_owned(),
        version: Some("1.0.0".to_owned()),
        tag_prefix: "x".to_owned(),
    }
}

struct AcceptedFixture {
    filename: &'static str,
    source: &'static str,
    snippets: &'static [&'static str],
    expected_dependency_guards: &'static str,
}

struct RejectedFixture {
    filename: &'static str,
    source: &'static str,
    code: &'static str,
    message: &'static str,
    hint: &'static str,
    span_starts_with: Option<&'static str>,
}

struct DsdFixture {
    filename: &'static str,
    source: &'static str,
    props: Option<&'static str>,
    inline_styles: Option<&'static str>,
    snippets: &'static [&'static str],
    forbidden_snippets: &'static [&'static str],
}

const ACCEPTED_FIXTURES: &[AcceptedFixture] = &[
    AcceptedFixture {
        filename: "reactive-counter.wc.tsx",
        source: include_str!("fixtures/conformance/accepted/reactive-counter.wc.tsx"),
        snippets: &[
            "class ReactiveCounterElement extends HTMLElement",
            "customElements.define(\"x-reactive-counter\", ReactiveCounterElement)",
            "static get observedAttributes()",
            "this.#computedCache.set(\"doubled\", (count() * 2));",
            "this.#scheduleFlush();",
            "#effectCleanups = [];",
            "new CustomEvent(\"change\"",
            "setAttribute(\"data-count\"",
            "setAttribute(\"part\", \"button\")",
        ],
        expected_dependency_guards: "",
    },
    AcceptedFixture {
        filename: "composition-toggle-list.wc.tsx",
        source: include_str!("fixtures/conformance/accepted/composition-toggle-list.wc.tsx"),
        snippets: &[
            "class CompositionToggleListElement extends HTMLElement",
            "customElements.define(\"x-composition-toggle-list\", CompositionToggleListElement)",
            "const host = () => ({",
            "addEventListener(\"click\"",
            "data-naos-control\", \"show",
            "data-naos-control\", \"for",
            ".replaceChildren(",
            "setAttribute(\"aria-pressed\"",
        ],
        expected_dependency_guards: "",
    },
    AcceptedFixture {
        filename: "styled-slots.wc.tsx",
        source: include_str!("fixtures/conformance/accepted/styled-slots.wc.tsx"),
        snippets: &[
            "import css from \"./styled-slots.css?inline\";",
            "class StyledSlotsElement extends HTMLElement",
            "customElements.define(\"x-styled-slots\", StyledSlotsElement)",
            "new CSSStyleSheet()",
            "__naosComponentStyleSheet.replaceSync([css].join(\"\\n\"))",
            "this.#root.adoptedStyleSheets = [__naosComponentStyles()]",
            "document.createElement(\"slot\")",
            "setAttribute(\"name\", \"icon\")",
            "setAttribute(\"part\", \"root label\")",
        ],
        expected_dependency_guards: "",
    },
    AcceptedFixture {
        filename: "typed-props.wc.tsx",
        source: include_str!("fixtures/conformance/accepted/typed-props.wc.tsx"),
        snippets: &[
            "class TypedPropsElement extends HTMLElement",
            "customElements.define(\"x-typed-props\", TypedPropsElement)",
            // Annotation-derived kinds: boolean without a default is
            // presence-based; rich props never observe or reflect attributes.
            "return [\"disabled\", \"count\", \"label\"];",
            "case \"disabled\":",
            "newValue !== null",
            "set items(value) {",
        ],
        expected_dependency_guards: "",
    },
    AcceptedFixture {
        filename: "dependency-ast-edge-cases.wc.tsx",
        source: include_str!("fixtures/conformance/accepted/dependency-ast-edge-cases.wc.tsx"),
        snippets: &[
            "class DependencyAstEdgeCasesElement extends HTMLElement",
            "customElements.define(\"x-dependency-ast-edge-cases\", DependencyAstEdgeCasesElement)",
            "data-naos-control\", \"for",
            "/a{2}/.test(\"aa\")",
        ],
        expected_dependency_guards: include_str!(
            "fixtures/conformance/accepted/dependency-ast-edge-cases.expected.txt"
        ),
    },
];

const REJECTED_FIXTURES: &[RejectedFixture] = &[
    RejectedFixture {
        filename: "removed-signal.wc.tsx",
        source: include_str!("fixtures/conformance/rejected/removed-signal.wc.tsx"),
        code: "NAOS_REMOVED_AUTHORING_API",
        message: "signal() was removed",
        hint: "function component authoring API",
        span_starts_with: Some("signal(0)"),
    },
    RejectedFixture {
        filename: "conditional-jsx.wc.tsx",
        source: include_str!("fixtures/conformance/rejected/conditional-jsx.wc.tsx"),
        code: "NAOS_UNSUPPORTED_CONDITIONAL_JSX",
        message: "Use explicit <Show> or <Switch>",
        hint: "<Show",
        span_starts_with: Some("<section>"),
    },
    RejectedFixture {
        filename: "unkeyed-map.wc.tsx",
        source: include_str!("fixtures/conformance/rejected/unkeyed-map.wc.tsx"),
        code: "NAOS_UNSUPPORTED_LIST_RENDERER",
        message: "require a key attribute",
        hint: "keyed .map()",
        span_starts_with: Some("<li>"),
    },
    RejectedFixture {
        filename: "map-block-body.wc.tsx",
        source: include_str!("fixtures/conformance/rejected/map-block-body.wc.tsx"),
        code: "NAOS_UNSUPPORTED_LIST_RENDERER",
        message: "expression body",
        hint: "keyed .map()",
        span_starts_with: Some("(item) => {"),
    },
    RejectedFixture {
        filename: "computed-block-body.wc.tsx",
        source: include_str!("fixtures/conformance/rejected/computed-block-body.wc.tsx"),
        code: "NAOS_UNSUPPORTED_COMPUTED_CALLBACK",
        message: "computed() must use an expression body",
        hint: "Check the v0.1 authoring limitations",
        span_starts_with: Some("() => {"),
    },
    RejectedFixture {
        filename: "rest-props.wc.tsx",
        source: include_str!("fixtures/conformance/rejected/rest-props.wc.tsx"),
        code: "NAOS_UNSUPPORTED_FUNCTION_PROPS",
        message: "rest props are not supported",
        hint: "explicit destructured props",
        span_starts_with: None,
    },
    RejectedFixture {
        filename: "factory-render.wc.tsx",
        source: include_str!("fixtures/conformance/rejected/factory-render.wc.tsx"),
        code: "NAOS_UNSUPPORTED_FACTORY_RENDER",
        message: "factory render functions",
        hint: "single JSX template",
        span_starts_with: Some("() => <button>"),
    },
    RejectedFixture {
        filename: "string-event-handler.wc.tsx",
        source: include_str!("fixtures/conformance/rejected/string-event-handler.wc.tsx"),
        code: "NAOS_UNSUPPORTED_EVENT_HANDLER",
        message: "must use a braced handler expression",
        hint: "bare handler",
        span_starts_with: Some("onClick="),
    },
    RejectedFixture {
        filename: "show-boolean-fallback.wc.tsx",
        source: include_str!("fixtures/conformance/rejected/show-boolean-fallback.wc.tsx"),
        code: "NAOS_UNSUPPORTED_SHOW_FALLBACK",
        message: "Show fallback must have a value",
        hint: "<Show",
        span_starts_with: Some("<Show when={ready()} fallback>"),
    },
    RejectedFixture {
        filename: "match-outside-switch.wc.tsx",
        source: include_str!("fixtures/conformance/rejected/match-outside-switch.wc.tsx"),
        code: "NAOS_UNSUPPORTED_SWITCH_MATCH",
        message: "direct child of <Switch>",
        hint: "<Match when={...}>",
        span_starts_with: Some("<Match when={ready()}>"),
    },
    RejectedFixture {
        filename: "fragment-child.wc.tsx",
        source: include_str!("fixtures/conformance/rejected/fragment-child.wc.tsx"),
        code: "NAOS_UNSUPPORTED_SYNTAX",
        message: "JSX fragments and spread children are not supported",
        hint: "authoring limitations",
        span_starts_with: None,
    },
    RejectedFixture {
        filename: "effect-block-callback.wc.tsx",
        source: include_str!("fixtures/conformance/rejected/effect-block-callback.wc.tsx"),
        code: "NAOS_UNSUPPORTED_SYNTAX",
        message: "require an arrow function callback",
        hint: "authoring limitations",
        span_starts_with: None,
    },
    RejectedFixture {
        filename: "unknown-component-options.wc.tsx",
        source: include_str!("fixtures/conformance/rejected/unknown-component-options.wc.tsx"),
        code: "NAOS_UNSUPPORTED_COMPONENT_OPTIONS",
        message: "only support `styles`",
        hint: "ComponentOptions",
        span_starts_with: None,
    },
    RejectedFixture {
        filename: "prop-type-mismatch.wc.tsx",
        source: include_str!("fixtures/conformance/rejected/prop-type-mismatch.wc.tsx"),
        code: "NAOS_PROP_TYPE_MISMATCH",
        message: "declares a number type but its default literal",
        hint: "TypeScript annotation",
        span_starts_with: None,
    },
    RejectedFixture {
        filename: "no-template.wc.tsx",
        source: include_str!("fixtures/conformance/rejected/no-template.wc.tsx"),
        code: "NAOS_COMPONENT_TEMPLATE_REQUIRED",
        message: "must return a TSX template",
        hint: "single JSX return value",
        span_starts_with: None,
    },
    RejectedFixture {
        filename: "no-component.wc.tsx",
        source: include_str!("fixtures/conformance/rejected/no-component.wc.tsx"),
        code: "NAOS_COMPONENT_NOT_FOUND",
        message: "No Naos component declaration",
        hint: "function component",
        span_starts_with: None,
    },
    RejectedFixture {
        filename: "broken-syntax.wc.tsx",
        source: include_str!("fixtures/conformance/rejected/broken-syntax.wc.tsx"),
        code: "NAOS_PARSE_MODULE_SOURCE",
        message: "Expected",
        hint: "Fix the TypeScript/TSX syntax",
        span_starts_with: None,
    },
];

const DSD_FIXTURES: &[DsdFixture] = &[
    DsdFixture {
        filename: "snapshot-shell.wc.tsx",
        source: include_str!("fixtures/conformance/dsd/snapshot-shell.wc.tsx"),
        props: Some(r#"{"label":"Clicks"}"#),
        inline_styles: Some(r#"{"css":":host { display: block; }"}"#),
        snippets: &[
            "<x-snapshot-shell label=\"Clicks\">",
            "<template shadowrootmode=\"open\">",
            "<style>:host { display: block; }</style>",
            "part=\"root\"",
            "data-count=\"0\"",
            "aria-label=\"Clicks\"",
            "data-naos-root=\"\"",
            "data-naos-node=\"node0\"",
            "data-naos-text=\"text0\"",
            "Clicks: 0",
        ],
        forbidden_snippets: &["addEventListener", "CustomEvent"],
    },
    DsdFixture {
        filename: "static-evaluation-boundary.wc.tsx",
        source: include_str!("fixtures/conformance/dsd/static-evaluation-boundary.wc.tsx"),
        props: Some(r#"{"label":"Runtime","count":5}"#),
        inline_styles: Some(r#"{"css":":host { color: teal; }"}"#),
        // computed() dynamic text fallback is covered by
        // render_declarative_shadow_dom_module_should_mark_unsupported_dynamic_values.
        // This fixture focuses on the prop/state/browser-only static boundary.
        snippets: &[
            "<x-static-evaluation-boundary",
            "label=\"Runtime\"",
            "count=\"5\"",
            "enabled=\"true\"",
            "<template shadowrootmode=\"open\">",
            "<style>:host { color: teal; }</style>",
            "<style>:host { display: block; }</style>",
            "part=\"root\"",
            "data-count=\"5\"",
            "data-enabled=\"true\"",
            "data-items=\"[&quot;static&quot;,&quot;Runtime&quot;]\"",
            "data-meta=\"{&quot;count&quot;:5,&quot;enabled&quot;:true,&quot;label&quot;:&quot;Runtime&quot;}\"",
            "aria-label=\"Runtime\"",
            "<slot data-naos-node=\"node1\" name=\"lead\"></slot>",
            ">Runtime<",
            "Runtime: 5",
            "[\"static\",\"Runtime\"]",
            "<span style=\"display: contents\" data-naos-text=\"text3\"></span>",
        ],
        forbidden_snippets: &[
            "data-browser=",
            "onClick",
            "addEventListener",
            "CustomEvent",
            "localStorage",
            "fetch",
            "/analytics",
            "effectBoundary",
            "clicked-boundary",
            "boundary-change",
        ],
    },
];

#[test]
fn accepted_fixtures_should_transform_through_public_compiler_boundary() {
    for fixture in ACCEPTED_FIXTURES {
        let result = transform_component_module(fixture.source, fixture.filename, &test_package())
            .unwrap_or_else(|error| panic!("{} should compile: {error}", fixture.filename));

        assert!(
            result.has_changed,
            "{} should be rewritten by the compiler",
            fixture.filename
        );
        let source_map = result
            .map
            .as_ref()
            .unwrap_or_else(|| panic!("{} should emit a source map", fixture.filename));
        assert_eq!(source_map.sources, vec![fixture.filename]);
        assert_eq!(source_map.sources_content, vec![fixture.source.to_owned()]);
        assert!(
            source_map
                .mappings
                .split(';')
                .any(|segment| segment != "AAAA"),
            "{} should emit non-trivial source mappings",
            fixture.filename
        );
        assert!(
            source_map
                .mappings
                .split(';')
                .collect::<std::collections::BTreeSet<_>>()
                .len()
                > 1,
            "{} should map generated lines to multiple source locations",
            fixture.filename
        );

        for snippet in fixture.snippets {
            assert!(
                result.code.contains(snippet),
                "{} output should contain {snippet:?}\n\n{}",
                fixture.filename,
                result.code
            );
        }
        for guard in fixture
            .expected_dependency_guards
            .lines()
            .map(str::trim)
            .filter(|line| !line.is_empty() && !line.starts_with('#'))
        {
            assert!(
                result.code.contains(guard),
                "{} output should contain dependency guard {guard:?}\n\n{}",
                fixture.filename,
                result.code
            );
        }
    }
}

#[test]
fn rejected_fixtures_should_emit_stable_diagnostics() {
    for fixture in REJECTED_FIXTURES {
        let error = transform_component_module(fixture.source, fixture.filename, &test_package())
            .expect_err("rejected fixture should not compile");
        let diagnostics = error.diagnostics_with_source(fixture.filename, Some(fixture.source));
        let diagnostic = diagnostics
            .first()
            .unwrap_or_else(|| panic!("{} should emit diagnostics", fixture.filename));

        assert_eq!(diagnostic.code, fixture.code, "{}", fixture.filename);
        assert_eq!(
            diagnostic.severity,
            DiagnosticSeverity::Error,
            "{}",
            fixture.filename
        );
        assert_eq!(diagnostic.filename, fixture.filename);
        assert!(
            diagnostic.message.contains(fixture.message),
            "{} message should contain {:?}, got {:?}",
            fixture.filename,
            fixture.message,
            diagnostic.message
        );
        let hint = diagnostic
            .hint
            .as_deref()
            .unwrap_or_else(|| panic!("{} should emit a hint", fixture.filename));
        assert!(
            hint.contains(fixture.hint),
            "{} hint should contain {:?}, got {:?}",
            fixture.filename,
            fixture.hint,
            hint
        );

        if let Some(expected_start) = fixture.span_starts_with {
            let span = diagnostic
                .span
                .unwrap_or_else(|| panic!("{} should emit a source span", fixture.filename));
            let snippet = &fixture.source[span.start..span.end];
            assert!(
                snippet.starts_with(expected_start),
                "{} span should start with {:?}, got {:?}",
                fixture.filename,
                expected_start,
                snippet
            );
            let loc = diagnostic.loc.unwrap_or_else(|| {
                panic!("{} should resolve a line/column location", fixture.filename)
            });
            assert!(
                loc.start_line >= 1 && loc.start_column >= 1,
                "{}",
                fixture.filename
            );
            assert!(
                (loc.end_line, loc.end_column) >= (loc.start_line, loc.start_column),
                "{}",
                fixture.filename
            );
        }
    }
}

#[test]
fn dsd_input_diagnostics_should_use_the_cataloged_code() {
    let source = "export function Probe() {\n  return <span>Probe</span>\n}\n";
    let error = render_declarative_shadow_dom_module_with_inline_styles(
        source,
        "probe.wc.tsx",
        &test_package(),
        Some("not-json"),
        None,
    )
    .expect_err("invalid DSD props should not prerender");
    let diagnostics = error.diagnostics_with_source("probe.wc.tsx", Some(source));
    assert_eq!(diagnostics[0].code, "NAOS_DSD_INPUT");
    assert!(
        diagnostics[0]
            .hint
            .as_deref()
            .unwrap_or_default()
            .contains("JSON")
    );
}

#[test]
fn invalid_package_context_should_use_the_cataloged_code() {
    let source = "export function Probe() {\n  return <span>Probe</span>\n}\n";
    let package = PackageContext {
        name: "@naos-ui/test".to_owned(),
        version: None,
        tag_prefix: "Not A Prefix".to_owned(),
    };
    let error = transform_component_module(source, "probe.wc.tsx", &package)
        .expect_err("invalid tag prefix should not compile");
    let diagnostics = error.diagnostics_with_source("probe.wc.tsx", Some(source));
    assert_eq!(diagnostics[0].code, "NAOS_INVALID_PACKAGE_CONTEXT");
}

#[test]
fn dsd_fixtures_should_prerender_static_shells_without_event_code() {
    for fixture in DSD_FIXTURES {
        let result = render_declarative_shadow_dom_module_with_inline_styles(
            fixture.source,
            fixture.filename,
            &test_package(),
            fixture.props,
            fixture.inline_styles,
        )
        .unwrap_or_else(|error| panic!("{} should prerender: {error}", fixture.filename));

        assert!(result.uses_declarative_shadow_dom, "{}", fixture.filename);
        assert!(result.shadow, "{}", fixture.filename);

        for snippet in fixture.snippets {
            assert!(
                result.html.contains(snippet) || result.template_html.contains(snippet),
                "{} DSD output should contain {snippet:?}\n\n{}",
                fixture.filename,
                result.html
            );
        }
        for snippet in fixture.forbidden_snippets {
            assert!(
                !result.html.contains(snippet) && !result.template_html.contains(snippet),
                "{} DSD output should not contain {snippet:?}\n\n{}",
                fixture.filename,
                result.html
            );
        }
    }
}

#[test]
fn production_compiler_should_not_contain_legacy_parser_or_panic_paths() {
    let compiler_sources = [
        ("ast.rs", include_str!("../src/ast.rs")),
        ("codegen.rs", include_str!("../src/codegen.rs")),
        ("parse.rs", include_str!("../src/parse.rs")),
    ];
    let forbidden = [
        concat!("Template", "Parser"),
        concat!("panic", "!("),
        concat!("unwrap", "()"),
        concat!("expect", "("),
        concat!("unreachable", "!("),
        concat!("on_helper_", "handler"),
    ];

    for (filename, source) in compiler_sources {
        let production = source
            .split("#[cfg(test)]")
            .next()
            .expect("compiler source should contain production code");
        for pattern in forbidden {
            assert!(
                !production.contains(pattern),
                "{filename} production source must not contain {pattern}"
            );
        }
    }
}
