#![warn(missing_docs, rustdoc::broken_intra_doc_links)]
//! Rust compiler core for Naos.
//!
//! The core owns host-neutral compiler semantics. TypeScript packages call into
//! this crate through a thin Node binding and keep bundler integration outside
//! the semantic pipeline.

mod ast;
mod codegen;
mod error;
mod model;
mod naming;
mod parse;

pub use codegen::{
    render_declarative_shadow_dom_module, render_declarative_shadow_dom_module_with_inline_styles,
    transform_component_module,
};
pub use error::{CompilerError, CompilerResult, location_for_span};
pub use model::{
    AttributeValue, CompilerDiagnostic, ComponentImport, ComponentModule, ComponentOptions,
    ComputedDefinition, DeclarativeShadowDomRenderResult, DiagnosticLocation, DiagnosticSeverity,
    DiagnosticSpan, EffectDefinition, EventDefinition, InspectDefinition, KeyedSelectorDefinition,
    PackageContext, PropAccess, PropDefinition, PropKind, SourceMap, StateDefinition, StateKind,
    StyleImport, TemplateAttribute, TemplateChild, TemplateElement, TemplateEventHandler,
    TemplateList, TemplateListKey, TemplateListKind, TemplateListMotion, TransformResult,
};
pub use parse::analyze_component_module;

/// Returns version metadata for the loaded compiler core.
#[must_use]
pub fn core_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

#[cfg(test)]
mod tests {
    use super::{
        AttributeValue, CompilerResult, ComponentModule, DeclarativeShadowDomRenderResult,
        DiagnosticSeverity, DiagnosticSpan, PackageContext, PropKind, StateKind, TemplateAttribute,
        TemplateChild, TemplateListKey, TemplateListKind, TemplateListMotion, TransformResult,
        core_version, location_for_span,
    };
    use super::{
        analyze_component_module as analyze_component_module_with_package,
        render_declarative_shadow_dom_module as render_declarative_shadow_dom_module_with_package,
        render_declarative_shadow_dom_module_with_inline_styles as render_declarative_shadow_dom_module_with_inline_styles_and_package,
        transform_component_module as transform_component_module_with_package,
    };
    use crate::error::{
        DIAGNOSTIC_CODE_COMPONENT_TEMPLATE_REQUIRED, DIAGNOSTIC_CODE_DSD_INPUT,
        DIAGNOSTIC_CODE_PROP_TYPE_MISMATCH, DIAGNOSTIC_CODE_REMOVED_AUTHORING_API,
        DIAGNOSTIC_CODE_TEMPLATE_PARSE, DIAGNOSTIC_CODE_UNSUPPORTED_COMPONENT_OPTIONS,
        DIAGNOSTIC_CODE_UNSUPPORTED_COMPUTED_CALLBACK, DIAGNOSTIC_CODE_UNSUPPORTED_CONDITIONAL_JSX,
        DIAGNOSTIC_CODE_UNSUPPORTED_EFFECT_CALLBACK, DIAGNOSTIC_CODE_UNSUPPORTED_EVENT_HANDLER,
        DIAGNOSTIC_CODE_UNSUPPORTED_FACTORY_RENDER, DIAGNOSTIC_CODE_UNSUPPORTED_FUNCTION_PROPS,
        DIAGNOSTIC_CODE_UNSUPPORTED_LIST_RENDERER, DIAGNOSTIC_CODE_UNSUPPORTED_SHOW_FALLBACK,
        DIAGNOSTIC_CODE_UNSUPPORTED_SWITCH_MATCH, DIAGNOSTIC_CODE_UNSUPPORTED_SYNTAX,
    };

    fn test_package() -> PackageContext {
        PackageContext {
            name: "@naos-ui/test".to_owned(),
            version: Some("1.0.0".to_owned()),
            tag_prefix: "x".to_owned(),
        }
    }

    fn analyze_component_module(source: &str, filename: &str) -> CompilerResult<ComponentModule> {
        analyze_component_module_with_package(source, filename, &test_package())
    }

    fn transform_component_module(source: &str, filename: &str) -> CompilerResult<TransformResult> {
        transform_component_module_with_package(source, filename, &test_package())
    }

    fn render_declarative_shadow_dom_module(
        source: &str,
        filename: &str,
        props_json: Option<&str>,
    ) -> CompilerResult<DeclarativeShadowDomRenderResult> {
        render_declarative_shadow_dom_module_with_package(
            source,
            filename,
            &test_package(),
            props_json,
        )
    }

    fn render_declarative_shadow_dom_module_with_inline_styles(
        source: &str,
        filename: &str,
        props_json: Option<&str>,
        inline_styles_json: Option<&str>,
    ) -> CompilerResult<DeclarativeShadowDomRenderResult> {
        render_declarative_shadow_dom_module_with_inline_styles_and_package(
            source,
            filename,
            &test_package(),
            props_json,
            inline_styles_json,
        )
    }

    #[test]
    fn core_version_should_match_crate_version() {
        assert_eq!(core_version(), env!("CARGO_PKG_VERSION"));
    }

    #[test]
    fn diagnostic_catalog_code_literals_should_stay_stable() {
        let codes = [
            (DIAGNOSTIC_CODE_DSD_INPUT, "NAOS_DSD_INPUT"),
            (
                DIAGNOSTIC_CODE_COMPONENT_TEMPLATE_REQUIRED,
                "NAOS_COMPONENT_TEMPLATE_REQUIRED",
            ),
            (
                DIAGNOSTIC_CODE_REMOVED_AUTHORING_API,
                "NAOS_REMOVED_AUTHORING_API",
            ),
            (DIAGNOSTIC_CODE_TEMPLATE_PARSE, "NAOS_TEMPLATE_PARSE"),
            (
                DIAGNOSTIC_CODE_UNSUPPORTED_COMPONENT_OPTIONS,
                "NAOS_UNSUPPORTED_COMPONENT_OPTIONS",
            ),
            (
                DIAGNOSTIC_CODE_UNSUPPORTED_CONDITIONAL_JSX,
                "NAOS_UNSUPPORTED_CONDITIONAL_JSX",
            ),
            (
                DIAGNOSTIC_CODE_UNSUPPORTED_COMPUTED_CALLBACK,
                "NAOS_UNSUPPORTED_COMPUTED_CALLBACK",
            ),
            (
                DIAGNOSTIC_CODE_UNSUPPORTED_EFFECT_CALLBACK,
                "NAOS_UNSUPPORTED_EFFECT_CALLBACK",
            ),
            (
                DIAGNOSTIC_CODE_UNSUPPORTED_EVENT_HANDLER,
                "NAOS_UNSUPPORTED_EVENT_HANDLER",
            ),
            (
                DIAGNOSTIC_CODE_UNSUPPORTED_FUNCTION_PROPS,
                "NAOS_UNSUPPORTED_FUNCTION_PROPS",
            ),
            (
                DIAGNOSTIC_CODE_UNSUPPORTED_FACTORY_RENDER,
                "NAOS_UNSUPPORTED_FACTORY_RENDER",
            ),
            (
                DIAGNOSTIC_CODE_UNSUPPORTED_LIST_RENDERER,
                "NAOS_UNSUPPORTED_LIST_RENDERER",
            ),
            (
                DIAGNOSTIC_CODE_UNSUPPORTED_SHOW_FALLBACK,
                "NAOS_UNSUPPORTED_SHOW_FALLBACK",
            ),
            (
                DIAGNOSTIC_CODE_UNSUPPORTED_SWITCH_MATCH,
                "NAOS_UNSUPPORTED_SWITCH_MATCH",
            ),
            (
                DIAGNOSTIC_CODE_UNSUPPORTED_SYNTAX,
                "NAOS_UNSUPPORTED_SYNTAX",
            ),
        ];

        for (actual, expected) in codes {
            assert_eq!(actual, expected);
        }
    }

    fn assert_diagnostic<T: std::fmt::Debug>(
        result: Result<T, super::CompilerError>,
        filename: &str,
        code: &str,
        message: &str,
        hint: &str,
    ) {
        let error = result.expect_err("fixture should fail with a diagnostic");
        let diagnostics = error.diagnostics(filename);
        let diagnostic = diagnostics
            .first()
            .expect("compiler error should expose diagnostics");

        assert_eq!(diagnostic.code, code, "{filename}");
        assert_eq!(diagnostic.severity, DiagnosticSeverity::Error, "{filename}");
        assert_eq!(diagnostic.filename, filename);
        assert!(
            diagnostic.message.contains(message),
            "{filename} message should contain {message:?}, got {:?}",
            diagnostic.message
        );
        if let Some(span) = diagnostic.span {
            assert!(span.start < span.end, "{filename} span should be non-empty");
        }
        let diagnostic_hint = diagnostic.hint.as_deref().expect("hint should be present");
        assert!(
            diagnostic_hint.contains(hint),
            "{filename} hint should contain {hint:?}, got {diagnostic_hint:?}"
        );
    }

    fn assert_diagnostic_source_span<T: std::fmt::Debug>(
        result: Result<T, super::CompilerError>,
        source: &str,
        filename: &str,
        expected_source: &str,
    ) {
        let error = result.expect_err("fixture should fail with a diagnostic");
        let diagnostic = error
            .diagnostics(filename)
            .into_iter()
            .next()
            .expect("compiler error should expose diagnostics");
        let span = diagnostic
            .span
            .expect("diagnostic should expose a source span");

        assert_eq!(
            &source[span.start..span.end],
            expected_source,
            "{filename} span should point at the rejected source"
        );
    }

    #[test]
    fn compiler_diagnostics_should_use_catalog_codes_and_hints() {
        let cases = [
            (
                "removed-signal.wc.tsx",
                r#"
                    import { signal } from "@naos-ui/core";

                    export function RemovedSignal() {
                      const count = signal(0);
                      return <button>{count()}</button>;
                    }
                "#,
                DIAGNOSTIC_CODE_REMOVED_AUTHORING_API,
                "signal() was removed",
                "function component authoring API",
            ),
            (
                "unsupported-options.wc.tsx",
                r#"
                    import { state, type ComponentOptions } from "@naos-ui/core";

                    export const options = {
                      shadow: false,
                    } satisfies ComponentOptions;

                    export function UnsupportedOptions() {
                      const count = state(0);
                      return <button>{count()}</button>;
                    }
                "#,
                DIAGNOSTIC_CODE_UNSUPPORTED_COMPONENT_OPTIONS,
                "Component options only support `styles`",
                "export const options",
            ),
            (
                "rest-props.wc.tsx",
                r#"
                    export function RestProps({ label = "Count", ...rest }: RestProps = {}) {
                      return <button>{label}</button>;
                    }
                "#,
                DIAGNOSTIC_CODE_UNSUPPORTED_FUNCTION_PROPS,
                "rest props are not supported",
                "Declare explicit destructured props",
            ),
            (
                "missing-template.wc.tsx",
                r#"
                    import { state } from "@naos-ui/core";

                    export function MissingTemplate() {
                      const count = state(0);
                      count.set(1);
                    }
                "#,
                DIAGNOSTIC_CODE_COMPONENT_TEMPLATE_REQUIRED,
                "must return a TSX template",
                "single JSX return",
            ),
            (
                "factory-render.wc.tsx",
                r#"
                    import { state } from "@naos-ui/core";

                    export function FactoryRender() {
                      const count = state(0);
                      return () => <button>{count()}</button>;
                    }
                "#,
                DIAGNOSTIC_CODE_UNSUPPORTED_FACTORY_RENDER,
                "return () => JSX",
                "single JSX template",
            ),
            (
                "factory-render-block.wc.tsx",
                r#"
                    import { state } from "@naos-ui/core";

                    export function FactoryRenderBlock() {
                      const count = state(0);
                      return () => {
                        return <button>{count()}</button>;
                      };
                    }
                "#,
                DIAGNOSTIC_CODE_UNSUPPORTED_FACTORY_RENDER,
                "instance setup declarations",
                "single JSX template",
            ),
            (
                "computed-block.wc.tsx",
                r#"
                    import { computed, state } from "@naos-ui/core";

                    export function ComputedBlock() {
                      const count = state(0);
                      const doubled = computed(() => {
                        return count() * 2;
                      });
                      return <button>{doubled()}</button>;
                    }
                "#,
                DIAGNOSTIC_CODE_UNSUPPORTED_COMPUTED_CALLBACK,
                "computed() must use an expression body",
                "authoring limitations",
            ),
            (
                "effect-malformed-callback.wc.tsx",
                r#"
                    import { effect, state } from "@naos-ui/core";

                    export function EffectMalformedCallback() {
                      const count = state(0);
                      effect((() => {
                        count.set(1);
                      }) satisfies () => void);
                      return <button>{count()}</button>;
                    }
                "#,
                DIAGNOSTIC_CODE_UNSUPPORTED_EFFECT_CALLBACK,
                "effect() callback body is malformed",
                "authoring limitations",
            ),
            (
                "unkeyed-map.wc.tsx",
                r#"
                    import { computed } from "@naos-ui/core";

                    export function UnkeyedMap() {
                      const items = computed(() => ["One", "Two"]);
                      return <ul>{items().map((item) => <li>{item}</li>)}</ul>;
                    }
                "#,
                DIAGNOSTIC_CODE_UNSUPPORTED_LIST_RENDERER,
                "require a key attribute",
                "keyed .map()",
            ),
            (
                "conditional-jsx.wc.tsx",
                r#"
                    import { state } from "@naos-ui/core";

                    export function ConditionalJsx() {
                      const ready = state(false);
                      return <section>{ready() ? <span>Ready</span> : <span>Waiting</span>}</section>;
                    }
                "#,
                DIAGNOSTIC_CODE_UNSUPPORTED_CONDITIONAL_JSX,
                "Conditional JSX expressions are not supported",
                "<Show",
            ),
            (
                "show-fallback.wc.tsx",
                r#"
                    import { Show, state } from "@naos-ui/core";

                    export function ShowFallback() {
                      const ready = state(false);
                      return <Show when={ready()} fallback><span>Ready</span></Show>;
                    }
                "#,
                DIAGNOSTIC_CODE_UNSUPPORTED_SHOW_FALLBACK,
                "Show fallback must have a value",
                "<Show",
            ),
        ];

        for (filename, source, code, message, hint) in cases {
            assert_diagnostic(
                transform_component_module(source, filename),
                filename,
                code,
                message,
                hint,
            );
        }

        assert_diagnostic(
            render_declarative_shadow_dom_module(
                r#"
                    export function Counter() {
                      return <button>Count</button>;
                    }
                "#,
                "counter.wc.tsx",
                Some("[]"),
            ),
            "counter.wc.tsx",
            DIAGNOSTIC_CODE_DSD_INPUT,
            "DSD prerender props must be a JSON object",
            "JSON objects",
        );
    }

    #[test]
    fn compiler_diagnostics_should_include_ast_source_spans() {
        let removed_signal_source = r#"
            import { signal } from "@naos-ui/core";

            export function RemovedSignal() {
              const count = signal(0);
              return <button>{count()}</button>;
            }
        "#;

        assert_diagnostic_source_span(
            transform_component_module(removed_signal_source, "removed-signal.wc.tsx"),
            removed_signal_source,
            "removed-signal.wc.tsx",
            "signal(0)",
        );

        let computed_block_source = r#"
            import { computed, state } from "@naos-ui/core";

            export function ComputedBlock() {
              const count = state(0);
              const doubled = computed(() => {
                return count() * 2;
              });
              return <button>{doubled()}</button>;
            }
        "#;

        assert_diagnostic_source_span(
            transform_component_module(computed_block_source, "computed-block.wc.tsx"),
            computed_block_source,
            "computed-block.wc.tsx",
            "() => {\n                return count() * 2;\n              }",
        );

        let factory_render_source = r#"
            import { state } from "@naos-ui/core";

            export function FactoryRender() {
              const count = state(0);
              return () => <button>{count()}</button>;
            }
        "#;

        assert_diagnostic_source_span(
            transform_component_module(factory_render_source, "factory-render.wc.tsx"),
            factory_render_source,
            "factory-render.wc.tsx",
            "() => <button>{count()}</button>",
        );
    }

    #[test]
    fn analyze_component_module_should_extract_counter_model() {
        let source = r#"
            import { event, state } from "@naos-ui/core";

            export function Counter({ label = "Count" }: CounterProps = {}) {
              const count = state(0);
              const change = event<number>("change");

              return (
                <button onClick={() => change.emit(count())}>
                  {label}: {count()}
                </button>
              );
            }
        "#;

        let module = match analyze_component_module(source, "counter.wc.tsx") {
            Ok(module) => module,
            Err(error) => panic!("analysis failed: {error}"),
        };

        assert_eq!(module.tag_name, "x-counter");
        assert!(module.options.shadow);
        assert_eq!(module.props.len(), 1);
        assert_eq!(module.states.len(), 1);
        assert_eq!(module.states[0].kind, StateKind::State);
        assert_eq!(module.events.len(), 1);
        assert_eq!(module.template.tag_name, "button");
        assert_eq!(module.template.attributes.len(), 1);
        assert!(matches!(
            module.template.attributes.as_slice(),
            [TemplateAttribute::Named {
                name,
                value: AttributeValue::EventHandler(handler),
            }] if name == "onClick"
                && handler.handler_expression == "() => change.emit(count())"
                && handler.options_expression.is_none()
        ));
        assert!(matches!(
            module.template.children.as_slice(),
            [TemplateChild::Text(_), TemplateChild::Expression(expression), ..]
                if expression == "label"
        ));
    }

    #[test]
    fn analyze_component_module_should_lower_jsx_comments_entities_and_regex_literals() {
        let source = r#"
            import { state } from "@naos-ui/core";

            export function Probe() {
              const value = state("aa");

              return (
                <p title="Bread &amp; Butter">
                  Hello &amp; welcome{/* author note */}{/a{2}/.test(value())}
                </p>
              );
            }
        "#;

        let module = analyze_component_module(source, "probe.wc.tsx")
            .expect("valid TSX should lower into the compiler IR");

        assert!(matches!(
            module.template.attributes.as_slice(),
            [TemplateAttribute::Named {
                name,
                value: AttributeValue::Static(value),
            }] if name == "title" && value == "Bread & Butter"
        ));
        assert!(matches!(
            module.template.children.as_slice(),
            [TemplateChild::Text(text), TemplateChild::Expression(expression), TemplateChild::Text(_)]
                if text.contains("Hello & welcome") && expression == "/a{2}/.test(value())"
        ));
    }

    #[test]
    fn analyze_component_module_should_lower_dynamic_lists_into_owned_ir() {
        let source = r#"
            import { For, Index, state } from "@naos-ui/core";

            export function Lists() {
              const rows = state([{ id: "a" }]);
              return (
                <section>
                  {rows().map((row) => <span key={row.id}>{row.id}</span>)}
                  <For each={rows()} motion="flip">
                    {(row, position) => <strong key={row.id}>{position}</strong>}
                  </For>
                  <Index each={rows()}>
                    {(row) => <em>{row().id}</em>}
                  </Index>
                </section>
              );
            }
        "#;

        let module = analyze_component_module(source, "lists.wc.tsx")
            .expect("valid list syntax should lower into the compiler IR");
        let map = module
            .template
            .children
            .iter()
            .find_map(|child| match child {
                TemplateChild::List(list) => Some(list),
                _ => None,
            });
        let for_list = module
            .template
            .children
            .iter()
            .find_map(|child| match child {
                TemplateChild::Element(element) if element.tag_name == "For" => {
                    element.children.first()
                }
                _ => None,
            });
        let index_list = module
            .template
            .children
            .iter()
            .find_map(|child| match child {
                TemplateChild::Element(element) if element.tag_name == "Index" => {
                    element.children.first()
                }
                _ => None,
            });

        assert!(matches!(
            (map, for_list, index_list),
            (
                Some(list),
                Some(TemplateChild::List(for_list)),
                Some(TemplateChild::List(index_list)),
            ) if matches!(
                &list.kind,
                TemplateListKind::ItemKeyed {
                    key: TemplateListKey::Expression(key),
                } if key == "row.id"
            ) && list.template.tag_name == "span"
                && matches!(
                    &for_list.kind,
                    TemplateListKind::ItemKeyed {
                        key: TemplateListKey::Expression(key),
                    } if key == "row.id"
                )
                && for_list.index_name == "position"
                && for_list.motion == Some(TemplateListMotion::Flip)
                && matches!(index_list.kind, TemplateListKind::IndexKeyed)
                && index_list.item_name == "row"
        ));
    }

    #[test]
    fn analyze_component_module_should_extract_function_component_model() {
        let source = r#"
            import { computed, effect, event, state, type ComponentOptions } from "@naos-ui/core";

            export const options = {
              styles: [":host { display: block; }"],
            } satisfies ComponentOptions;

            export function Counter({ label = "Count", enabled = true, step = 1 }: CounterProps = {}) {
              const count = state(0);
              const doubled = computed(() => count() * 2);
              effect(() => {
                console.log(doubled());
                return () => console.log("cleanup");
              });
              const change = event<number>("change");

              return (
                <button disabled={!enabled} onClick={() => change.emit(count())}>
                  {label}: {doubled()}
                </button>
              );
            }
        "#;

        let module = match analyze_component_module(source, "counter.wc.tsx") {
            Ok(module) => module,
            Err(error) => panic!("analysis failed: {error}"),
        };

        assert_eq!(module.tag_name, "x-counter");
        assert_eq!(module.class_name, "CounterElement");
        assert_eq!(module.export_name.as_deref(), Some("Counter"));
        assert_eq!(module.props.len(), 3);
        assert_eq!(module.props[0].prop_name, "label");
        assert_eq!(module.props[1].attribute_name, "enabled");
        assert_eq!(module.props[2].attribute_name, "step");
        assert_eq!(module.states[0].kind, StateKind::State);
        assert_eq!(module.computed.len(), 1);
        assert_eq!(module.computed[0].local_name, "doubled");
        assert_eq!(module.effects.len(), 1);
        assert_eq!(module.options.styles, vec!["\":host { display: block; }\""]);
    }

    #[test]
    fn analyze_component_module_should_derive_prop_kinds_from_type_annotations() {
        let source = r#"
            type CardProps = {
              readonly disabled?: boolean;
              count?: number;
              title?: string;
              items?: string[];
              config?: { deep: boolean };
              tone?: "info" | "warn";
            };

            export function Card({ disabled, count, title = "Card", items = [], config, tone }: CardProps = {}) {
              return <section>{title}</section>;
            }
        "#;

        let module = match analyze_component_module(source, "card.wc.tsx") {
            Ok(module) => module,
            Err(error) => panic!("analysis failed: {error}"),
        };

        let kinds: Vec<(&str, PropKind)> = module
            .props
            .iter()
            .map(|prop| (prop.prop_name.as_str(), prop.kind))
            .collect();
        assert_eq!(
            kinds,
            vec![
                ("disabled", PropKind::Boolean),
                ("count", PropKind::Number),
                ("title", PropKind::String),
                ("items", PropKind::Rich),
                ("config", PropKind::Rich),
                ("tone", PropKind::String),
            ]
        );
        assert_eq!(module.props[0].default_value, "false");
        assert_eq!(module.props[1].default_value, "0");
        assert_eq!(module.props[4].default_value, "undefined");
    }

    #[test]
    fn analyze_component_module_should_derive_prop_kinds_from_inline_and_interface_types() {
        let inline = r#"
            export function Flag({ active }: { active?: boolean } = {}) {
              return <span>{active}</span>;
            }
        "#;
        let module = match analyze_component_module(inline, "flag.wc.tsx") {
            Ok(module) => module,
            Err(error) => panic!("analysis failed: {error}"),
        };
        assert_eq!(module.props[0].kind, PropKind::Boolean);

        let interface = r#"
            interface PanelProps {
              rows?: number[];
              open?: boolean;
            }

            export function Panel({ rows, open }: PanelProps = {}) {
              return <span>{open}</span>;
            }
        "#;
        let module = match analyze_component_module(interface, "panel.wc.tsx") {
            Ok(module) => module,
            Err(error) => panic!("analysis failed: {error}"),
        };
        assert_eq!(module.props[0].kind, PropKind::Rich);
        assert_eq!(module.props[1].kind, PropKind::Boolean);
    }

    #[test]
    fn analyze_component_module_should_resolve_annotations_at_word_boundaries() {
        // `typeWidgetProps` and `WidgetPropsExtra` are identifier decoys; the
        // real declaration follows both. `readonly_value` keeps its full name,
        // and inline comments must not corrupt member types.
        let source = r#"
            const typeWidgetProps = { count: 5 };

            type WidgetPropsExtra = {
              other?: number;
            };

            type WidgetProps = {
              readonly_value?: boolean;
              readonly tone?: string; // trailing comment
              /* block */ level?: number;
            };

            export function Widget({ readonly_value, tone, level }: WidgetProps = {}) {
              return <span data-tone={tone}>{level}</span>;
            }
        "#;

        let module = match analyze_component_module(source, "widget.wc.tsx") {
            Ok(module) => module,
            Err(error) => panic!("analysis failed: {error}"),
        };

        let kinds: Vec<(&str, PropKind)> = module
            .props
            .iter()
            .map(|prop| (prop.prop_name.as_str(), prop.kind))
            .collect();
        assert_eq!(
            kinds,
            vec![
                ("readonly_value", PropKind::Boolean),
                ("tone", PropKind::String),
                ("level", PropKind::Number),
            ]
        );
    }

    #[test]
    fn analyze_component_module_should_reject_prop_type_default_conflicts() {
        let source = r#"
            export function Broken({ count = "many" }: { count?: number } = {}) {
              return <span>{count}</span>;
            }
        "#;

        let error = analyze_component_module(source, "broken.wc.tsx")
            .expect_err("conflicting prop type and default should not compile");
        let diagnostics = error.diagnostics_with_source("broken.wc.tsx", Some(source));
        assert_eq!(diagnostics[0].code, DIAGNOSTIC_CODE_PROP_TYPE_MISMATCH);
        assert!(diagnostics[0].message.contains("count"));
    }

    #[test]
    fn generated_rich_props_should_stay_property_only() {
        let source = r#"
            type ListProps = {
              items?: string[];
              dense?: boolean;
            };

            export function List({ items = [], dense }: ListProps = {}) {
              return <ul data-dense={dense}>{items.length}</ul>;
            }
        "#;

        let result = match transform_component_module(source, "list.wc.tsx") {
            Ok(result) => result,
            Err(error) => panic!("transform failed: {error}"),
        };

        assert_contains(&result.code, "return [\"dense\"];");
        assert!(!result.code.contains("\"items\": { prop:"));
        assert_contains(&result.code, "items: { source: \"items\"");
        assert!(!result.code.contains("setAttribute(\"items\""));
        assert_contains(
            &result.code,
            "\"dense\": { prop: \"dense\", parse: (value) => value !== null }",
        );

        let props: Vec<(&str, PropKind)> = result
            .props
            .iter()
            .map(|prop| (prop.prop_name.as_str(), prop.kind))
            .collect();
        assert_eq!(
            props,
            vec![("items", PropKind::Rich), ("dense", PropKind::Boolean)]
        );
        assert!(result.events.is_empty());
    }

    #[test]
    fn transform_component_module_should_lower_braced_form_actions() {
        let source = r#"
            import { saveNote } from "./note-actions.js";

            export function NoteForm() {
              return (
                <form action={saveNote}>
                  <input name="note" required />
                  <button>Save</button>
                </form>
              );
            }
        "#;

        let result = match transform_component_module(source, "note-form.wc.tsx") {
            Ok(result) => result,
            Err(error) => panic!("transform failed: {error}"),
        };

        assert_contains(
            &result.code,
            "import { saveNote } from \"./note-actions.js\";",
        );
        assert_contains(&result.code, "FormAction = (saveNote);");
        assert_contains(&result.code, "typeof node0FormAction === \"string\"");
        assert_contains(
            &result.code,
            "node0FormAction[Symbol.for(\"naos.form.action\")] === true",
        );
        assert_contains(&result.code, "node0FormAction.enhance(node0);");
        assert_contains(
            &result.code,
            "requires a string URL or a Naos form action object",
        );

        let static_source = r#"
            export function PlainForm() {
              return (
                <form action="/api/save" method="post">
                  <button>Save</button>
                </form>
              );
            }
        "#;
        let static_result = match transform_component_module(static_source, "plain-form.wc.tsx") {
            Ok(result) => result,
            Err(error) => panic!("transform failed: {error}"),
        };
        assert_contains(
            &static_result.code,
            "setAttribute(\"action\", \"/api/save\")",
        );
        assert!(!static_result.code.contains("naos.form.action"));
    }

    #[test]
    fn analyze_component_module_should_reject_removed_component_api() {
        let source = r#"
            import { component } from "@naos-ui/core";

            export default component("x-counter", () => {
              return <button>Count</button>;
            });
        "#;

        let error = analyze_component_module(source, "counter.wc.tsx")
            .expect_err("component() should be rejected");

        assert!(error.to_string().contains("component() was removed"));
    }

    #[test]
    fn analyze_component_module_should_reject_removed_signal_api() {
        let source = r#"
            import { signal } from "@naos-ui/core";

            export function Counter() {
              const count = signal(0);
              return <button>{count()}</button>;
            }
        "#;

        let error = analyze_component_module(source, "counter.wc.tsx")
            .expect_err("signal() should be rejected");

        assert!(error.to_string().contains("signal() was removed"));
    }

    #[test]
    fn analyze_component_module_should_reject_removed_host_alias() {
        let source = r#"
            import { effect, useHost } from "@naos-ui/core";

            export function Counter() {
              effect(() => {
                useHost().update();
              });
              return <button>Count</button>;
            }
        "#;

        let error = analyze_component_module(source, "counter.wc.tsx")
            .expect_err("useHost() should be rejected");

        assert!(error.to_string().contains("useHost() was removed"));
    }

    #[test]
    fn analyze_component_module_should_reject_removed_prop_api() {
        let source = r#"
            import { prop } from "@naos-ui/core";

            export function Counter() {
              const label = prop.string("label", "Count");
              return <button>{label()}</button>;
            }
        "#;

        let error = analyze_component_module(source, "counter.wc.tsx")
            .expect_err("prop.*() should be rejected");

        assert!(
            error
                .to_string()
                .contains("prop.*() and prop() were removed")
        );
    }

    #[test]
    fn analyze_component_module_should_ignore_removed_api_names_in_comments_and_strings() {
        let source = r#"
            import { state } from "@naos-ui/core";

            export function Counter() {
              const count = state(0);
              const message = "component() signal() useHost() prop.value() export const options";
              const myprop = { value: () => "safe" };
              myprop.value();
              // component(); signal(); useHost(); prop.value(); export const options = { styles: [] };
              return <button title={message}>{count()}</button>;
            }
        "#;

        let module = analyze_component_module(source, "counter.wc.tsx")
            .expect("removed API names in non-code positions must not fail analysis");

        assert_eq!(module.template.tag_name, "button");
    }

    #[test]
    fn analyze_component_module_should_reject_public_shadow_option() {
        let source = r#"
            import { state, type ComponentOptions } from "@naos-ui/core";

            export const options = {
              shadow: false,
            } satisfies ComponentOptions;

            export function Counter() {
              const count = state(0);
              return <button>{count()}</button>;
            }
        "#;

        let error = analyze_component_module(source, "counter.wc.tsx")
            .expect_err("shadow should not be a public component option");

        assert!(
            error
                .to_string()
                .contains("Component options only support `styles`")
        );
    }

    #[test]
    fn analyze_component_module_should_reject_public_define_option() {
        let source = r#"
            import { state, type ComponentOptions } from "@naos-ui/core";

            export const options = {
              define: false,
            } satisfies ComponentOptions;

            export function Counter() {
              const count = state(0);
              return <button>{count()}</button>;
            }
        "#;

        let error = analyze_component_module(source, "counter.wc.tsx")
            .expect_err("define should not be a public component option");

        assert!(
            error
                .to_string()
                .contains("Component options only support `styles`")
        );
    }

    #[test]
    fn transform_component_module_should_generate_custom_element() {
        let source = r#"
            import { event, state } from "@naos-ui/core";

            export function Counter({ label = "Count" }: CounterProps = {}) {
              const count = state(0);
              const change = event<number>("change");

              return (
                <button
                  part="button"
                  data-count={count()}
                  onClick={() => {
                    count.set(count() + 1);
                    change.emit(count());
                  }}
                >
                  {label}: {count()}
                </button>
              );
            }
        "#;

        let result = match transform_component_module(source, "counter.wc.tsx") {
            Ok(result) => result,
            Err(error) => panic!("transform failed: {error}"),
        };

        assert!(result.has_changed);
        let source_map = result.map.as_ref().expect("source map should be emitted");
        assert_eq!(source_map.version, 3);
        assert_eq!(source_map.sources, vec!["counter.wc.tsx"]);
        assert_eq!(source_map.sources_content, vec![source.to_owned()]);
        assert!(
            source_map
                .mappings
                .split(';')
                .any(|segment| segment != "AAAA"),
            "source maps should contain authored-line mappings"
        );
        assert!(
            source_map
                .mappings
                .split(';')
                .collect::<std::collections::BTreeSet<_>>()
                .len()
                > 1,
            "source maps should not point every generated line at one source location"
        );
        assert!(
            result
                .code
                .contains("class CounterElement extends HTMLElement")
        );
        assert!(result.code.contains(
            "__naosDefineComponent(\"x-counter\", CounterElement, __naosComponentMetadata)"
        ));
        assert!(
            result
                .code
                .contains("defineComponent as __naosDefineComponent")
        );
        assert!(result.code.contains(
            "Object.freeze({ packageName: \"@naos-ui/test\", packageVersion: \"1.0.0\", tagName: \"x-counter\" })"
        ));
        assert!(result.code.contains("__naosCreateKernel(this, {"));
        assert!(result.code.contains("__naosConnect(this[__naosKernel]);"));
        assert!(
            result
                .code
                .contains("__naosEmitter(this[__naosKernel], \"change\")")
        );
        assert!(result.code.contains("this.#text0.data"));
    }

    #[test]
    fn transform_component_module_should_reuse_declarative_shadow_roots() {
        let source = r#"
            import { state } from "@naos-ui/core";

            export function Counter() {
              const count = state(0);

              return (
                <button onClick={() => count.set(count() + 1)}>
                  {count()}
                </button>
              );
            }
        "#;

        let result = match transform_component_module(source, "counter.wc.tsx") {
            Ok(result) => result,
            Err(error) => panic!("transform failed: {error}"),
        };

        assert!(result.code.contains("this.#root = kernel.root;"));
        assert!(result.code.contains("shadow: true,"));
        assert!(result.code.contains("hydrate: () => this.#hydrate(),"));
        assert!(result.code.contains("#requiredHydrationElement(marker)"));
        assert!(result.code.contains("this.#remount();"));
    }

    #[test]
    fn transform_component_module_should_generate_function_component_element() {
        let source = r#"
            import { event, state } from "@naos-ui/core";

            export function Counter({ label = "Count" }: CounterProps = {}) {
              const count = state(0);
              const change = event<number>("change");

              return (
                <button
                  part="button"
                  onClick={() => {
                    count.set(count() + 1);
                    change.emit(count());
                  }}
                >
                  {label}: {count()}
                </button>
              );
            }
        "#;

        let result = match transform_component_module(source, "counter.wc.tsx") {
            Ok(result) => result,
            Err(error) => panic!("transform failed: {error}"),
        };

        assert!(
            result
                .code
                .contains("class CounterElement extends HTMLElement")
        );
        assert!(result.code.contains(
            "__naosDefineComponent(\"x-counter\", CounterElement, __naosComponentMetadata)"
        ));
        assert!(result.code.contains("const label = this.#props.label;"));
        assert!(
            result
                .code
                .contains("export { CounterElement as Counter };")
        );
    }

    #[test]
    fn transform_component_module_should_generate_state_computed_and_effects() {
        let source = r#"
            import { computed, effect, event, state } from "@naos-ui/core";

            export function Counter({ label = "Count" }: CounterProps = {}) {
              const count = state(0);
              const doubled = computed(() => count() * 2);
              const change = event<number>("change");

              effect(() => {
                document.body.dataset.lastEffect = String(doubled());
                return () => {
                  document.body.dataset.cleaned = "true";
                };
              });

              return (
                <button
                  data-count={doubled()}
                  onClick={() => {
                    count.update((value) => value + 1);
                    change.emit(doubled());
                  }}
                >
                  {label}: {doubled()}
                </button>
              );
            }
        "#;

        let result = match transform_component_module(source, "counter.wc.tsx") {
            Ok(result) => result,
            Err(error) => panic!("transform failed: {error}"),
        };

        assert!(result.code.contains("runEffect as __naosRunEffect"));
        assert!(result.code.contains("#computedCache = new Map();"));
        assert!(
            result
                .code
                .contains("const doubled = __naosComputedAccessor")
        );
        assert!(result.code.contains(
            "__naosComputedAccessor(this[__naosKernel], \"doubled\", () => (count() * 2))"
        ));
        assert!(result.code.contains("#runEffects(dirtySources)"));
        assert!(
            result
                .code
                .contains("effects: (_kernel, dirtySources) => this.#runEffects(dirtySources)")
        );
        assert!(result.code.contains("__naosConnect(this[__naosKernel]);"));
        assert!(
            result
                .code
                .contains("const count = __naosStateAccessor(this[__naosKernel], \"count\");")
        );
        assert!(
            result
                .code
                .contains("__naosRunEffect(this[__naosKernel], 0, dirtySources, [")
        );
        assert!(result.code.contains("document.body.dataset.lastEffect"));
        assert!(!result.code.contains("#flushSync()"));
        assert!(
            result
                .code
                .contains("__naosEmitter(this[__naosKernel], \"change\")")
        );
    }

    #[test]
    fn transform_component_module_should_keep_unknown_reactive_reads_broad() {
        let source = r#"
            import { effect, state } from "@naos-ui/core";

            export function Probe() {
              const count = state(0);

              effect(() => {
                observeExternalRead();
              });

              return <button>{count()}</button>;
            }
        "#;

        let result = match transform_component_module(source, "probe.wc.tsx") {
            Ok(result) => result,
            Err(error) => panic!("transform failed: {error}"),
        };

        assert!(
            result
                .code
                .contains("__naosRunEffect(this[__naosKernel], 0, dirtySources, null, () => {")
        );
        assert!(
            result
                .code
                .contains("if (__naosShouldUpdate([\"count\"], dirtySources))")
        );
    }

    #[test]
    fn transform_component_module_should_ignore_comments_and_strings_in_dependency_detection() {
        let source = r#"
            import { computed, effect, state } from "@naos-ui/core";

            export function Probe() {
              const count = state(0);
              const label = computed(() => `Count ${count()}`);

              effect(() => {
                console.info("observeExternalRead() count() label()");
                // observeExternalRead();
                /* anotherExternalRead(); */
                document.body.dataset.label = `${label()}`;
              });

              return <button title={`literal count() ${label()}`}>{label()}</button>;
            }
        "#;

        let result = match transform_component_module(source, "probe.wc.tsx") {
            Ok(result) => result,
            Err(error) => panic!("transform failed: {error}"),
        };

        assert!(
            !result
                .code
                .contains("__naosShouldUpdate(null, dirtySources)")
        );
        assert!(
            result
                .code
                .contains("__naosRunEffect(this[__naosKernel], 0, dirtySources, [")
        );
    }

    #[test]
    fn transform_component_module_should_keep_host_reads_dependency_neutral() {
        let source = r#"
            import { effect, host, state } from "@naos-ui/core";

            export function Probe() {
              const count = state(0);

              effect(() => {
                host().element.dataset.count = String(count());
              });

              return <button>{count()}</button>;
            }
        "#;

        let result = match transform_component_module(source, "probe.wc.tsx") {
            Ok(result) => result,
            Err(error) => panic!("transform failed: {error}"),
        };

        assert!(
            !result
                .code
                .contains("__naosShouldUpdate(null, dirtySources)")
        );
        assert!(
            result.code.contains(
                "__naosRunEffect(this[__naosKernel], 0, dirtySources, [\"count\"], () => {"
            )
        );
    }

    #[test]
    fn transform_component_module_should_skip_comments_between_reactive_accessor_and_call() {
        let source = r#"
            import { state } from "@naos-ui/core";

            export function Probe() {
              const count = state(0);

              return <button>{count /* stable accessor */ ()}</button>;
            }
        "#;

        let result = match transform_component_module(source, "probe.wc.tsx") {
            Ok(result) => result,
            Err(error) => panic!("transform failed: {error}"),
        };

        assert!(
            result
                .code
                .contains("if (__naosShouldUpdate([\"count\"], dirtySources))")
        );
    }

    #[test]
    fn transform_component_module_should_generate_lifecycle_callbacks() {
        let source = r#"
            import { onConnected, onDisconnected, state } from "@naos-ui/core";

            export function LifecycleProbe() {
              const status = state("idle");

              onConnected(() => {
                status.set("connected");
              });
              onDisconnected(() => {
                status.set("disconnected");
              });

              return <span data-status={status()} />;
            }
        "#;

        let result = match transform_component_module(source, "lifecycle-probe.wc.tsx") {
            Ok(result) => result,
            Err(error) => panic!("transform failed: {error}"),
        };

        assert!(result.code.contains("connectedCallback()"));
        assert!(result.code.contains("disconnectedCallback()"));
        assert!(
            result
                .code
                .contains("const { status } = this.#createBindings();")
        );
        assert!(result.code.contains("status.set(\"connected\");"));
        assert!(result.code.contains("status.set(\"disconnected\");"));
    }

    #[test]
    fn transform_component_module_should_generate_element_refs() {
        let source = r#"
            import { onConnected, state } from "@naos-ui/core";

            export function RefProbe() {
              let button: HTMLButtonElement | null = null;
              const count = state(0);

              onConnected(() => {
                button?.setAttribute("data-connected", "true");
              });

              return (
                <section>
                  <button
                    ref={button}
                    data-count={count()}
                    onClick={() => {
                      button?.focus();
                      count.set(count() + 1);
                    }}
                  >
                    Clicks {count()}
                  </button>
                  <span ref={(element) => element.setAttribute("data-ref", "callback")} />
                </section>
              );
            }
        "#;

        let result = match transform_component_module(source, "ref-probe.wc.tsx") {
            Ok(result) => result,
            Err(error) => panic!("transform failed: {error}"),
        };

        assert_contains(&result.code, "#refs = {};");
        assert_contains(&result.code, "this.#refs.button = this.#node1;");
        assert_contains(&result.code, "this.#applyRefs();");
        assert_contains(
            &result.code,
            "((element) => element.setAttribute(\"data-ref\", \"callback\"))(this.#node2);",
        );
        assert_contains(&result.code, "const button = this.#refs.button ?? null;");
        assert_contains(&result.code, "return { count, button };");
        assert_contains(
            &result.code,
            "const { count, button } = this.#createBindings();",
        );
        assert_contains(
            &result.code,
            "button?.setAttribute(\"data-connected\", \"true\");",
        );
        assert_contains(&result.code, "button?.focus();");
        assert_contains(
            &result.code,
            "this.#node1 = this.#requiredHydrationElement(\"node1\");",
        );
        assert_not_contains(&result.code, "setAttribute(\"ref\"");
        assert_not_contains(&result.code, "this.#shouldUpdate([\"button\"]");
    }

    #[test]
    fn render_declarative_shadow_dom_module_should_omit_element_refs() {
        let source = r#"
            import { state } from "@naos-ui/core";

            export function RefProbe() {
              let button: HTMLButtonElement | null = null;
              const count = state(0);

              return (
                <button
                  ref={button}
                  data-count={count()}
                  onClick={() => button?.focus()}
                >
                  {count()}
                </button>
              );
            }
        "#;

        let result = match render_declarative_shadow_dom_module(source, "ref-probe.wc.tsx", None) {
            Ok(result) => result,
            Err(error) => panic!("DSD render failed: {error}"),
        };

        assert_contains(&result.template_html, "data-count=\"0\"");
        assert_contains(&result.template_html, ">0<");
        assert_not_contains(&result.template_html, "ref=");
        assert_not_contains(&result.template_html, "button?.focus");
        assert_not_contains(&result.template_html, "onClick");
    }

    #[test]
    fn transform_component_module_should_reject_ref_binding_name_conflicts() {
        let source = r#"
            import { state } from "@naos-ui/core";

            export function RefConflict() {
              const count = state(0);

              return <button ref={count}>{count()}</button>;
            }
        "#;

        let error = transform_component_module(source, "ref-conflict.wc.tsx")
            .expect_err("conflicting ref binding should be rejected");

        assert!(error.to_string().contains("conflicts"));
        assert!(error.to_string().contains("count"));
    }

    #[test]
    fn transform_component_module_should_reject_refs_inside_dynamic_list_rows() {
        let source = r#"
            import { state } from "@naos-ui/core";

            export function RefList() {
              let row: HTMLButtonElement | null = null;
              const items = state(["A", "B"]);

              return (
                <ul>
                  {items().map((item) => (
                    <li key={item} ref={row}>{item}</li>
                  ))}
                </ul>
              );
            }
        "#;

        let error = transform_component_module(source, "ref-list.wc.tsx")
            .expect_err("dynamic row refs should be rejected");

        assert!(error.to_string().contains("ref"));
        assert!(error.to_string().contains("dynamic list row"));
    }

    #[test]
    fn transform_component_module_should_initialize_state_from_props_in_instance_context() {
        let source = r#"
            import { state } from "@naos-ui/core";

            export function Snapshot({
              checked = false,
              label = "Ready",
              step = 1,
            }: SnapshotProps = {}) {
              const selected = state(checked);
              const text = state(label);
              const count = state(step);

              return (
                <button
                  aria-pressed={selected()}
                  data-count={count()}
                  data-label={label}
                  data-step={step}
                >
                  {text()}
                </button>
              );
            }
        "#;

        let result = match transform_component_module(source, "snapshot.wc.tsx") {
            Ok(result) => result,
            Err(error) => panic!("transform failed: {error}"),
        };

        assert!(result.code.contains("#state = {};"));
        assert!(result.code.contains("#initializeState()"));
        assert!(result.code.contains("const checked = this.#props.checked;"));
        assert!(result.code.contains("this.#state.selected = checked;"));
        assert!(result.code.contains("this.#state.text = label;"));
        assert!(result.code.contains("this.#state.count = step;"));
        assert!(!result.code.contains("#state = {\n    selected: checked"));

        assert_eq!(
            occurrence_count(&result.code, "initState: () => this.#initializeState(),"),
            1,
            "state setup should be owned by the kernel mount path"
        );

        let connected_callback = section_between(
            &result.code,
            "  connectedCallback() {",
            "\n  attributeChangedCallback",
        );
        assert_contains(connected_callback, "__naosConnect(this[__naosKernel]);");

        let attribute_changed = section_between(
            &result.code,
            "  attributeChangedCallback",
            "\n  #initializeState()",
        );
        assert_not_contains(attribute_changed, "#initializeState");
        assert_contains(
            attribute_changed,
            "__naosAttrChanged(this[__naosKernel], name, oldValue, newValue);",
        );
        assert_contains(
            &result.code,
            "checked: { source: \"checked\", attribute: \"checked\", coerce: (value) => Boolean(value), reflect: true },",
        );
        assert_contains(
            &result.code,
            "\"step\": { prop: \"step\", parse: (value) => Number.isFinite(Number(value)) ? Number(value) : 1 },",
        );

        assert_contains(&result.code, "const label = this.#props.label;");
        assert_contains(&result.code, "const step = this.#props.step;");
        assert_contains(
            &result.code,
            "const count = __naosStateAccessor(this[__naosKernel], \"count\");",
        );
        assert_contains(
            &result.code,
            "return { checked, label, step, selected, text, count };",
        );
        assert_contains(
            &result.code,
            "if (__naosShouldUpdate([\"label\"], dirtySources))",
        );
        assert_contains(
            &result.code,
            "if (__naosShouldUpdate([\"step\"], dirtySources))",
        );
        assert_contains(
            &result.code,
            "if (__naosShouldUpdate([\"count\"], dirtySources))",
        );
        assert_contains(
            &result.code,
            "if (__naosShouldUpdate([\"selected\"], dirtySources))",
        );
        assert_contains(
            &result.code,
            "if (__naosShouldUpdate([\"text\"], dirtySources))",
        );
    }

    #[test]
    fn transform_component_module_should_generate_form_associated_control_helpers() {
        let source = r#"
            import { formControl, state } from "@naos-ui/core";

            export function Check({
              checked = false,
              disabled = false,
              value = "on",
            }: CheckProps = {}) {
              const selected = state(checked);
              const form = formControl({
                value: () => selected() ? value : null,
                reset: () => {
                  selected.set(checked);
                },
                disabled,
              });
              void form;

              return (
                <button
                  disabled={disabled}
                  aria-pressed={selected()}
                  onClick={() => selected.update((current) => !current)}
                >
                  {value}
                </button>
              );
            }
        "#;

        let result = match transform_component_module(source, "check.wc.tsx") {
            Ok(result) => result,
            Err(error) => panic!("transform failed: {error}"),
        };

        assert!(result.code.contains("static formAssociated = true;"));
        assert!(
            result
                .code
                .contains("this.#internals = this.attachInternals();")
        );
        assert!(result.code.contains("#syncFormValue(dirtySources)"));
        assert!(
            result
                .code
                .contains("this.#internals.setFormValue(selected() ? value : null);")
        );
        assert!(result.code.contains("formResetCallback()"));
        assert!(result.code.contains("selected.set(checked);"));
        assert!(result.code.contains("formDisabledCallback(disabled)"));
        assert!(result.code.contains("this.disabled = disabled;"));
    }

    #[test]
    fn transform_component_module_should_map_common_dom_event_attribute_names() {
        let source = r#"
            import { on } from "@naos-ui/core";

            export function KeyboardButton() {
              return (
                <button
                  onKeyDown={() => {}}
                  onPointerDown={() => {}}
                  onPointerMove={() => {}}
                  onPointerOver={() => {}}
                  onPointerLeave={() => {}}
                  onPointerCancel={() => {}}
                  onContextMenu={() => {}}
                  onBeforeInput={() => {}}
                >
                  Move
                </button>
              );
            }
        "#;

        let result = match transform_component_module(source, "keyboard-button.wc.tsx") {
            Ok(result) => result,
            Err(error) => panic!("transform failed: {error}"),
        };

        assert!(result.code.contains("listen as __naosListen"));
        assert!(
            result
                .code
                .contains("\"keydown\", (event, __naosEventSignal)")
        );
        assert!(
            result
                .code
                .contains("\"pointerdown\", (event, __naosEventSignal)")
        );
        assert!(
            result
                .code
                .contains("\"pointermove\", (event, __naosEventSignal)")
        );
        assert!(
            result
                .code
                .contains("\"pointerover\", (event, __naosEventSignal)")
        );
        assert!(
            result
                .code
                .contains("\"pointerleave\", (event, __naosEventSignal)")
        );
        assert!(
            result
                .code
                .contains("\"pointercancel\", (event, __naosEventSignal)")
        );
        assert!(
            result
                .code
                .contains("\"contextmenu\", (event, __naosEventSignal)")
        );
        assert!(
            result
                .code
                .contains("\"beforeinput\", (event, __naosEventSignal)")
        );
        assert!(
            !result
                .code
                .contains("\"key-down\", (event, __naosEventSignal)")
        );
        assert!(
            !result
                .code
                .contains("\"pointer-down\", (event, __naosEventSignal)")
        );
    }

    #[test]
    fn transform_component_module_should_lower_event_handlers_and_options_from_ast() {
        let source = r#"
            import { on } from "@naos-ui/core";

            export function EventOptions() {
              const handleInput = async (event, signal) => {
                if (!signal.aborted) event.preventDefault();
              };
              return (
                <section>
                  <button onClick={(event) => event.preventDefault()}>Bare</button>
                  <input onBeforeInput={on(handleInput, { capture: true, passive: false, once: true })} />
                </section>
              );
            }
        "#;

        let result = match transform_component_module(source, "event-options.wc.tsx") {
            Ok(result) => result,
            Err(error) => panic!("transform failed: {error}"),
        };

        assert!(
            result
                .code
                .contains("((event) => event.preventDefault())(event")
        );
        assert!(
            result
                .code
                .contains("handleInput(event, __naosEventSignal);")
        );
        assert!(
            result
                .code
                .contains("}, { capture: true, passive: false, once: true });")
        );
    }

    #[test]
    fn transform_component_module_should_reject_string_first_event_helpers() {
        let source = r#"
            import { on } from "@naos-ui/core";

            export function LegacyEvent() {
              return <button onClick={on("click", () => {})}>Legacy</button>;
            }
        "#;

        assert_diagnostic(
            transform_component_module(source, "legacy-event.wc.tsx"),
            "legacy-event.wc.tsx",
            DIAGNOSTIC_CODE_UNSUPPORTED_EVENT_HANDLER,
            "JSX attribute supplies the event name",
            "on(handler, options?)",
        );
        assert_diagnostic_source_span(
            transform_component_module(source, "legacy-event.wc.tsx"),
            source,
            "legacy-event.wc.tsx",
            "on(\"click\", () => {})",
        );
    }

    #[test]
    fn transform_component_module_should_generate_control_flow_and_web_composition_helpers() {
        let source = r#"
            import { Show, computed, effect, event, host, on, state } from "@naos-ui/core";

            export function ToggleList({ visible = true }: ToggleListProps = {}) {
              const pressed = state(false);
              const items = computed(() => pressed() ? ["On"] : ["Off"]);
              const toggled = event<boolean>("toggle-change");

              effect(() => {
                const { element, signal } = host();
                element.dataset.effect = signal.aborted ? "off" : "on";
                return () => {
                  delete element.dataset.effect;
                };
              });

              return (
                <button
                  part="root control"
                  data-state={pressed() ? "on" : "off"}
                  aria-pressed={pressed()}
                  onClick={() => {
                    pressed.update((value) => !value);
                    toggled.emit(pressed());
                  }}
                >
                  <Show when={visible} fallback={<span part="label">Hidden</span>}>
                    <span part="label">Visible</span>
                  </Show>
                  {items().map((item, index) => (
                      <span key={item} part="indicator" data-index={index}>
                        {item}
                      </span>
                  ))}
                </button>
              );
            }
        "#;

        let result = match transform_component_module(source, "toggle-list.wc.tsx") {
            Ok(result) => result,
            Err(error) => panic!("transform failed: {error}"),
        };

        assert!(result.code.contains("data-naos-control\", \"show"));
        assert!(result.code.contains(
            "this.#node1Content.style.display = this.#node1Content.hidden ? \"none\" : \"contents\";"
        ));
        assert!(result.code.contains(
            "this.#node1Fallback.style.display = this.#node1Fallback.hidden ? \"none\" : \"contents\";"
        ));
        assert!(result.code.contains("data-naos-control\", \"for"));
        assert!(result.code.contains(".replaceChildren("));
        assert!(result.code.contains("listen as __naosListen"));
        assert!(!result.code.contains("on(\"click\""));
        assert!(result.code.contains("__naosCreateKernel(this, {"));
        assert!(
            result
                .code
                .contains("const host = __naosHostApi(this[__naosKernel]);")
        );
        assert!(result.code.contains("__naosConnect(this[__naosKernel]);"));
        assert!(
            result
                .code
                .contains("__naosDisconnect(this[__naosKernel]);")
        );
        assert!(!result.code.contains("  #flush() {"));
        assert!(!result.code.contains("#eventAbortControllers = new Set();"));
        assert!(!result.code.contains("new AbortController()"));
    }

    #[test]
    fn transform_component_module_should_generate_switch_match_control_flow() {
        let source = r#"
            import { Match, Switch, state } from "@naos-ui/core";

            export function StatusPanel() {
              const status = state("loading");

              return (
                <section>
                  <Switch>
                    <Match when={status() === "loading"}>
                      <p part="status">Loading</p>
                    </Match>
                    <Match when={status() === "error"}>
                      <p part="status error">Error</p>
                    </Match>
                    <Match when={status() === "empty"}>
                      <p part="status">Empty</p>
                    </Match>
                    <Match>
                      <p part="status">Ready</p>
                    </Match>
                  </Switch>
                </section>
              );
            }
        "#;

        let result = match transform_component_module(source, "status-panel.wc.tsx") {
            Ok(result) => result,
            Err(error) => panic!("transform failed: {error}"),
        };

        assert!(result.code.contains("data-naos-control\", \"switch"));
        assert!(result.code.contains("let node1Matched = false;"));
        assert!(
            result
                .code
                .contains("const node1Match0When = Boolean(status() === \"loading\");")
        );
        assert!(
            result
                .code
                .contains("this.#node1Match0.hidden = node1Matched || !node1Match0When; this.#node1Match0.style.display = this.#node1Match0.hidden ? \"none\" : \"contents\";")
        );
        assert!(
            result
                .code
                .contains("node1Matched = node1Matched || node1Match1When;")
        );
        assert!(
            result
                .code
                .contains("this.#node1Match3.hidden = node1Matched; this.#node1Match3.style.display = this.#node1Match3.hidden ? \"none\" : \"contents\";")
        );
        assert!(
            result
                .code
                .contains("if (__naosShouldUpdate([\"status\"], dirtySources))")
        );
    }

    #[test]
    fn transform_component_module_should_generate_for_and_index_reconcilers() {
        let source = r#"
            import { For, Index, on, state } from "@naos-ui/core";

            export function ListProbe() {
              const rows = state([{ id: "a", label: "Alpha" }, { id: "b", label: "Beta" }]);
              const names = state(["Alpha", "Beta"]);

              return (
                <section>
                  <For each={rows()}>
                    {(row, index) => (
                      <button
                        key={row.id}
                        data-id={row.id}
                        data-index={index}
                        onClick={on(async (event, signal) => {
                          event.preventDefault();
                          if (signal.aborted) return;
                          rows.update((current) => current.filter((item) => item.id !== row.id));
                        }, { capture: true })}
                      >
                        {row.label}
                      </button>
                    )}
                  </For>
                  <Index each={names()}>
                    {(name, index) => (
                      <input data-index={index} value={name()} />
                    )}
                  </Index>
                </section>
              );
            }
        "#;

        let result = match transform_component_module(source, "list-probe.wc.tsx") {
            Ok(result) => result,
            Err(error) => panic!("transform failed: {error}"),
        };

        assert!(result.code.contains("#node1Records = new Map();"));
        assert!(result.code.contains("#node2Records = new Map();"));
        assert!(result.code.contains("this.#node1Records.get(for1Key)"));
        assert!(result.code.contains("this.#node2Records.get(for2Key)"));
        assert!(
            result
                .code
                .contains("const name = () => node2Record.value;")
        );
        assert!(
            result.code.contains(
                "__naosSetAttr(node2Record.for2Node0, \"value\", for2Node0_value_value);"
            )
        );
        assert!(result.code.contains("ListenerclickDispose: null"));
        assert!(
            result
                .code
                .contains("node1StaleRecord.for1Node0ListenerclickDispose?.();")
        );
        assert!(result.code.contains(
            "node1Record.for1Node0ListenerclickDispose = __naosListen(this[__naosKernel]"
        ));
        assert!(result.code.contains("}, { capture: true });"));
        assert!(
            result
                .code
                .contains("reconcileKeyed as __naosReconcileKeyed")
        );
        assert!(
            result
                .code
                .contains("__naosReconcileKeyed(this.#node1, node1Nodes);")
        );
        assert!(
            result
                .code
                .contains("__naosReconcileKeyed(this.#node2, node2Nodes);")
        );
        assert!(!result.code.contains("this.#node1.replaceChildren("));
        assert!(!result.code.contains("this.#node2.replaceChildren("));
        assert!(!result.code.contains(".map(("));
        assert!(!result.code.contains("@naos-ui/motion"));
        assert!(!result.code.contains("__naosFlipMovedElements"));
    }

    #[test]
    fn transform_component_module_should_generate_keyed_for_flip_motion() {
        let source = r#"
            import { For, state } from "@naos-ui/core";

            export function FlipListProbe() {
              const rows = state([{ id: "a", label: "Alpha" }, { id: "b", label: "Beta" }]);

              return (
                <section>
                  <For each={rows()} motion="flip">
                    {(row, index) => (
                      <button key={row.id} data-index={index}>
                        {row.label}
                      </button>
                    )}
                  </For>
                </section>
              );
            }
        "#;

        let result = match transform_component_module(source, "flip-list-probe.wc.tsx") {
            Ok(result) => result,
            Err(error) => panic!("transform failed: {error}"),
        };

        assert!(result.code.contains(
            "import { flipMovedElements as __naosFlipMovedElements } from \"@naos-ui/motion\";"
        ));
        assert!(result.code.contains("const node1FlipRects = new Map();"));
        assert!(result.code.contains(
            "node1FlipRects.set(node1FlipRecord.node, node1FlipRecord.node.getBoundingClientRect());"
        ));
        assert!(
            result
                .code
                .contains("__naosReconcileKeyed(this.#node1, node1Nodes);")
        );
        assert!(
            result
                .code
                .contains("__naosFlipMovedElements(node1FlipRects);")
        );
    }

    #[test]
    fn transform_component_module_should_lower_keyed_selector_bindings() {
        let source = r#"
            import { For, state } from "@naos-ui/core";

            export function SelectorProbe() {
              const rows = state([{ id: "a", label: "Alpha" }, { id: "b", label: "Beta" }]);
              const selected = state("a");
              const isSelected = (id: string) => selected() === id;

              return (
                <section>
                  <For each={rows()}>
                    {(row) => (
                      <button
                        key={row.id}
                        aria-selected={isSelected(row.id)}
                        data-state={isSelected(row.id) ? "selected" : "idle"}
                      >
                        {row.label}
                      </button>
                    )}
                  </For>
                </section>
              );
            }
        "#;

        let result = match transform_component_module(source, "selector-probe.wc.tsx") {
            Ok(result) => result,
            Err(error) => panic!("transform failed: {error}"),
        };

        assert!(result.code.contains("keyedSelectors: {"));
        assert!(result.code.contains("\"selected\": [\"isSelected\"],"));
        assert!(
            result
                .code
                .contains("const isSelected = (id) => selected() === id;")
        );
        assert!(
            result.code.contains(
                "const selected = __naosStateAccessor(this[__naosKernel], \"selected\");"
            )
        );
        assert!(
            result
                .code
                .contains("__naosRegisterKeyedBinding(this[__naosKernel], \"isSelected\", row.id,")
        );
        assert_eq!(
            result
                .code
                .matches("__naosRegisterKeyedBinding(this[__naosKernel], \"isSelected\", row.id,")
                .count(),
            2
        );
        assert!(
            result
                .code
                .contains("__naosUnregisterKeyedBindings(this[__naosKernel], node1StaleRecord);")
        );
        assert!(result.code.contains("const row = node1Record.value;"));
        assert!(
            result
                .code
                .contains("if (__naosShouldUpdate([\"rows\"], dirtySources))")
        );
        assert!(
            !result
                .code
                .contains("if (__naosShouldUpdate([\"rows\", \"selected\"], dirtySources))")
        );
    }

    #[test]
    fn generated_output_should_delegate_shared_kernel_helpers_without_inline_copies() {
        let source = r#"
            import { effect, For, state } from "@naos-ui/core";

            export function SharedKernelProbe() {
              const rows = state([{ id: "a", label: "Alpha" }]);
              const selected = state("a");
              const isSelected = (id: string) => selected() === id;

              effect(() => {
                document.body.dataset.selected = selected();
              });

              return (
                <section data-selected={selected()}>
                  <button onClick={() => selected.set("a")}>Select</button>
                  <For each={rows()}>
                    {(row) => <button key={row.id} aria-selected={isSelected(row.id)}>{row.label}</button>}
                  </For>
                </section>
              );
            }
        "#;

        let result = transform_component_module(source, "shared-kernel-probe.wc.tsx")
            .expect("shared-kernel probe should compile");

        assert_contains(&result.code, "setAttr as __naosSetAttr");
        assert_contains(&result.code, "listen as __naosListen");
        assert_contains(&result.code, "runEffect as __naosRunEffect");
        assert_contains(&result.code, "reconcileKeyed as __naosReconcileKeyed");
        assert_contains(
            &result.code,
            "registerKeyedBinding as __naosRegisterKeyedBinding",
        );
        assert_not_contains(&result.code, "#effectCleanups");
        assert_not_contains(&result.code, "#keyedBindingRegistry");
        assert_not_contains(&result.code, "#runKeyedBindings");
        assert_not_contains(&result.code, "new AbortController()");
        assert_not_contains(&result.code, ".insertBefore(");
    }

    #[test]
    fn generated_static_components_should_skip_empty_kernel_shell_members() {
        let source = r#"
            export function Board() {
              return <section aria-label="Board" />;
            }
        "#;

        let result = transform_component_module(source, "board.wc.tsx")
            .expect("static board should compile");

        assert_not_contains(&result.code, "#createBindings()");
        assert_not_contains(&result.code, "#installEventListeners()");
        assert_not_contains(&result.code, "#update(dirtySources)");
        assert_not_contains(&result.code, "static get observedAttributes()");
        assert_not_contains(&result.code, "#props = {");
        assert_not_contains(&result.code, "#state = {};");
        assert_not_contains(&result.code, "markDirty as __naosMarkDirty");
        assert_not_contains(&result.code, "flushSync as __naosFlushSync");
    }

    #[test]
    fn transform_component_module_should_reject_unkeyed_map_jsx_children() {
        let source = r#"
            import { computed } from "@naos-ui/core";

            export function List() {
              const items = computed(() => ["One", "Two"]);

              return (
                <ul>
                  {items().map((item) => <li>{item}</li>)}
                </ul>
              );
            }
        "#;

        let error = transform_component_module(source, "list.wc.tsx")
            .expect_err("unkeyed map JSX child should be rejected");

        assert!(error.to_string().contains("require a key attribute"));
    }

    #[test]
    fn transform_component_module_should_reject_map_block_bodies() {
        let source = r#"
            import { computed } from "@naos-ui/core";

            export function List() {
              const items = computed(() => ["One", "Two"]);

              return (
                <ul>
                  {items().map((item) => {
                    return <li key={item}>{item}</li>;
                  })}
                </ul>
              );
            }
        "#;

        let error = transform_component_module(source, "list.wc.tsx")
            .expect_err("map block body should be rejected");

        assert!(error.to_string().contains("expression body"));
    }

    #[test]
    fn transform_component_module_should_reject_non_jsx_map_returns() {
        let source = r#"
            import { computed } from "@naos-ui/core";

            export function List() {
              const items = computed(() => ["One", "Two"]);

              return <ul>{items().map((item) => item)}</ul>;
            }
        "#;

        let error = transform_component_module(source, "list.wc.tsx")
            .expect_err("non-JSX map return should be rejected");

        assert!(error.to_string().contains("must return a JSX element"));
    }

    #[test]
    fn transform_component_module_should_reject_conditional_jsx_children() {
        let source = r#"
            import { state } from "@naos-ui/core";

            export function Status() {
              const ready = state(false);

              return (
                <section>
                  {ready() ? <span>Ready</span> : <span>Waiting</span>}
                </section>
              );
            }
        "#;

        let error = transform_component_module(source, "status.wc.tsx")
            .expect_err("conditional JSX child should be rejected");

        assert!(
            error
                .to_string()
                .contains("Use explicit <Show> or <Switch>")
        );
    }

    #[test]
    fn transform_component_module_should_reject_invalid_switch_match_structure() {
        let source = r#"
            import { Match, Switch, state } from "@naos-ui/core";

            export function StatusPanel() {
              const ready = state(false);

              return (
                <Switch>
                  <Match>Default</Match>
                  <Match when={ready()}>Ready</Match>
                </Switch>
              );
            }
        "#;

        let error = transform_component_module(source, "status-panel.wc.tsx")
            .expect_err("default Match before conditional Match should be rejected");

        assert!(
            error
                .to_string()
                .contains("default <Match> must be the last arm")
        );
    }

    #[test]
    fn transform_component_module_should_reject_match_outside_switch() {
        let source = r#"
            import { Match, state } from "@naos-ui/core";

            export function StatusPanel() {
              const ready = state(false);

              return <Match when={ready()}>Ready</Match>;
            }
        "#;

        let error = transform_component_module(source, "status-panel.wc.tsx")
            .expect_err("Match outside Switch should be rejected");

        assert!(error.to_string().contains("direct child of <Switch>"));
    }

    #[test]
    fn transform_component_module_should_rewrite_nested_pascal_components() {
        let source = r#"
            import { Counter as BaseCounter } from "./counter.wc.tsx";

            export function Dashboard() {
              return (
                <section>
                  <BaseCounter initialCount={1} onValueChange={(event) => {
                    console.log(event.detail);
                  }} />
                </section>
              );
            }
        "#;

        let result = match transform_component_module(source, "dashboard.wc.tsx") {
            Ok(result) => result,
            Err(error) => panic!("transform failed: {error}"),
        };

        assert!(result.code.contains("import \"./counter.wc.tsx\";"));
        assert!(
            result
                .code
                .contains("document.createElement(\"x-counter\")")
        );
        assert!(result.code.contains("initial-count"));
        assert!(
            result
                .code
                .contains("\"value-change\", (event, __naosEventSignal)")
        );
    }

    #[test]
    fn transform_component_module_should_generate_native_jsx_spread_attributes() {
        let source = r#"
            import { computed, state } from "@naos-ui/core";

            export function SpreadButton() {
              const active = state(false);
              const triggerProps = computed(() => ({
                "aria-selected": active(),
                className: "from-spread",
                hidden: false,
                onKeyDown(event) {
                  event.preventDefault();
                },
                onPointerMove(event) {
                  event.preventDefault();
                },
                onPointerOver(event) {
                  event.preventDefault();
                },
                onPointerLeave(event) {
                  event.preventDefault();
                },
                onPointerCancel(event) {
                  event.preventDefault();
                },
                style: { color: active() ? "red" : "blue" },
                tabIndex: 0,
              }));

              return (
                <button part="before" {...triggerProps()} part="after" data-state={active() ? "on" : "off"}>
                  Press
                </button>
              );
            }
        "#;

        let result = match transform_component_module(source, "spread-button.wc.tsx") {
            Ok(result) => result,
            Err(error) => panic!("transform failed: {error}"),
        };

        assert!(result.code.contains(
            "#node0Spread0 = { names: new Set(), listeners: new Map(), styles: new Set(), raw: false };"
        ));
        assert!(result.code.contains(
            "__naosApplySpreadAttributes(this.#node0, this.#node0Spread0, triggerProps());"
        ));
        assert!(
            result
                .code
                .contains("applySpreadAttributes as __naosApplySpreadAttributes")
        );
        assert!(!result.code.contains("#applySpreadAttributes"));
        assert!(!result.code.contains("#applySpreadValue"));
        assert!(
            result
                .code
                .contains("const { active, triggerProps } = this.#createBindings();")
        );
        let spread_index = result
            .code
            .find("__naosApplySpreadAttributes(this.#node0, this.#node0Spread0, triggerProps());")
            .expect("spread update should be generated");
        let explicit_after_index = result.code[spread_index..]
            .find("this.#node0.setAttribute(\"part\", \"after\");")
            .expect("explicit attribute after spread should be re-applied during update");
        assert!(explicit_after_index > 0);
        assert!(result.code[spread_index..].contains(
            "if (__naosShouldUpdate(null, dirtySources)) {\n      const node0_data_state_value = active() ? \"on\" : \"off\";"
        ));
    }

    #[test]
    fn transform_component_module_should_lower_inspect_to_dev_tracing() {
        let source = r#"
            import { computed, inspect, state } from "@naos-ui/core";

            export function Probe() {
              const count = state(0);
              const doubled = computed(() => count() * 2);

              inspect(count(), doubled());

              return (
                <button onClick={() => count.set(count() + 1)}>{count()}</button>
              );
            }
        "#;

        let result = match transform_component_module(source, "probe.wc.tsx") {
            Ok(result) => result,
            Err(error) => panic!("transform failed: {error}"),
        };

        assert!(result.code.contains(
            "if (this.#isDevelopment()) console.debug(\"[naos] <\" + this.localName + \"> inspect(count(), doubled())\", count(), doubled());"
        ));
        // The tracing step rides the dependency-gated update path.
        let inspect_index = result
            .code
            .find("> inspect(count(), doubled())")
            .expect("inspect step should be generated");
        let gate_index = result.code[..inspect_index]
            .rfind("__naosShouldUpdate(")
            .expect("inspect step should be dependency gated");
        assert!(result.code[gate_index..inspect_index].contains("\"count\""));
    }

    #[test]
    fn transform_component_module_should_reject_empty_inspect() {
        let source = r#"
            import { inspect, state } from "@naos-ui/core";

            export function Probe() {
              const count = state(0);

              inspect();

              return <span>{count()}</span>;
            }
        "#;

        let error = transform_component_module(source, "probe.wc.tsx")
            .expect_err("empty inspect should be rejected");
        assert!(
            error
                .to_string()
                .contains("inspect() requires at least one value expression.")
        );
    }

    #[test]
    fn transform_component_module_should_expose_clx_class_helper() {
        let source = r#"
            import { clx, state } from "@naos-ui/core";

            export function Chip() {
              const active = state(false);

              return (
                <span
                  class={clx("chip", active() && "chip--active", { "chip--idle": !active() })}
                  onClick={() => active.set(!active())}
                >
                  Chip
                </span>
              );
            }
        "#;

        let result = match transform_component_module(source, "chip.wc.tsx") {
            Ok(result) => result,
            Err(error) => panic!("transform failed: {error}"),
        };

        assert!(result.code.contains("clx as __naosClx"));
        assert!(!result.code.contains("function __naosClx(...inputs) {"));
        assert!(result.code.contains("const clx = __naosClx;"));
        assert!(
            result
                .code
                .contains("const { active, clx } = this.#createBindings();")
        );
        assert!(result.code.contains(
            "clx(\"chip\", active() && \"chip--active\", { \"chip--idle\": !active() })"
        ));
        assert!(!result.code.contains("import { clx"));
    }

    #[test]
    fn transform_component_module_should_respect_clx_import_alias() {
        let source = r#"
            import { clx as classNames, state } from "@naos-ui/core";

            export function Tag() {
              const active = state(false);

              return (
                <span
                  class={classNames({ active: active() })}
                  onClick={() => active.set(!active())}
                >
                  Tag
                </span>
              );
            }
        "#;

        let result = match transform_component_module(source, "tag.wc.tsx") {
            Ok(result) => result,
            Err(error) => panic!("transform failed: {error}"),
        };

        assert!(result.code.contains("const classNames = __naosClx;"));
        assert!(
            result
                .code
                .contains("const { active, classNames } = this.#createBindings();")
        );
    }

    #[test]
    fn transform_component_module_should_apply_style_objects_with_custom_properties() {
        let source = r#"
            import { state } from "@naos-ui/core";

            export function Meter() {
              const level = state(0);

              return (
                <div style={{ "--meter-level": String(level()), opacity: level() > 0 ? "1" : false }}>
                  <button onClick={() => level.set(level() + 1)}>Raise</button>
                </div>
              );
            }
        "#;

        let result = match transform_component_module(source, "meter.wc.tsx") {
            Ok(result) => result,
            Err(error) => panic!("transform failed: {error}"),
        };

        assert!(
            result
                .code
                .contains("#node0StyleCache = { styles: new Set(), raw: false };")
        );
        assert!(result.code.contains(
            "__naosApplyStyleValue(this.#node0, this.#node0StyleCache, ({ \"--meter-level\": String(level()), opacity: level() > 0 ? \"1\" : false }));"
        ));
        assert!(
            result
                .code
                .contains("applyStyleValue as __naosApplyStyleValue")
        );
        assert!(!result.code.contains("#applyStyleValue"));
        // Style objects alone must not import the full spread helper.
        assert!(!result.code.contains("applySpreadAttributes as"));
    }

    #[test]
    fn transform_component_module_should_keep_static_style_strings_as_attributes() {
        let source = r#"
            import { state } from "@naos-ui/core";

            export function Banner() {
              const open = state(false);

              return (
                <div style="color: red" data-open={open() ? "yes" : "no"}>
                  <button onClick={() => open.set(!open())}>Toggle</button>
                </div>
              );
            }
        "#;

        let result = match transform_component_module(source, "banner.wc.tsx") {
            Ok(result) => result,
            Err(error) => panic!("transform failed: {error}"),
        };

        assert!(
            result
                .code
                .contains("node0.setAttribute(\"style\", \"color: red\");")
        );
        assert!(!result.code.contains("#applyStyleValue"));
        assert!(!result.code.contains("__naosClx"));
    }

    #[test]
    fn transform_component_module_should_reject_jsx_spread_on_pascal_components() {
        let source = r#"
            import { computed } from "@naos-ui/core";
            import { Counter } from "./counter.wc.tsx";

            export function Dashboard() {
              const counterProps = computed(() => ({ initialCount: 1 }));

              return <Counter {...counterProps()} />;
            }
        "#;

        let error = transform_component_module(source, "dashboard.wc.tsx")
            .expect_err("component spread should be rejected");

        assert!(
            error
                .to_string()
                .contains("JSX spread attributes are supported only on native elements")
        );
    }

    #[test]
    fn transform_component_module_should_generate_slots_and_shadow_styles() {
        let source = r#"
            import { type ComponentOptions } from "@naos-ui/core";
            import css from "./button.css?inline";

            export const options = {
              styles: [css],
            } satisfies ComponentOptions;

            export function Button() {
              return (
                <button part="button">
                  <slot name="icon" />
                  <slot />
                </button>
              );
            }
        "#;

        let result = match transform_component_module(source, "button.wc.tsx") {
            Ok(result) => result,
            Err(error) => panic!("transform failed: {error}"),
        };

        assert!(
            result
                .code
                .contains("import css from \"./button.css?inline\";")
        );
        assert!(result.code.contains("__naosLazySheet([css])"));
        assert!(result.code.contains("styles: __naosComponentStyles"));
        assert!(result.code.contains("document.createElement(\"slot\")"));
        assert!(result.code.contains("setAttribute(\"name\", \"icon\")"));
        assert!(result.code.contains("setAttribute(\"part\", \"button\")"));
    }

    #[test]
    fn render_declarative_shadow_dom_module_should_serialize_counter_shell() {
        let source = r#"
            import { event, state, type ComponentOptions } from "@naos-ui/core";

            export const options = {
              styles: [":host { display: inline-block; }"],
            } satisfies ComponentOptions;

            export function Counter({ label = "Count" }: CounterProps = {}) {
              const count = state(0);
              const change = event<number>("change");

              return (
                <button part="button" data-count={count()} onClick={() => change.emit(count())}>
                  {`${label}: ${count()}`}
                </button>
              );
            }
        "#;

        let result = match render_declarative_shadow_dom_module(
            source,
            "counter.wc.tsx",
            Some(r#"{"label":"Clicks"}"#),
        ) {
            Ok(result) => result,
            Err(error) => panic!("DSD render failed: {error}"),
        };

        assert_eq!(result.tag_name, "x-counter");
        assert!(result.uses_declarative_shadow_dom);
        assert!(result.html.starts_with("<x-counter label=\"Clicks\">"));
        assert!(
            result
                .template_html
                .contains("<template shadowrootmode=\"open\">")
        );
        assert!(
            result
                .template_html
                .contains("<style>:host { display: inline-block; }</style>")
        );
        assert!(result.template_html.contains("data-naos-root=\"\""));
        assert!(result.template_html.contains("data-naos-node=\"node0\""));
        assert!(result.template_html.contains("data-count=\"0\""));
        assert!(result.template_html.contains("data-naos-text=\"text0\""));
        assert!(result.template_html.contains("Clicks: 0"));
        assert!(!result.template_html.contains("onClick"));
    }

    #[test]
    fn render_declarative_shadow_dom_module_should_serialize_resolved_inline_css() {
        let source = r#"
            import { type ComponentOptions } from "@naos-ui/core";
            import css from "./counter.css?inline";

            export const options = {
              styles: [css],
            } satisfies ComponentOptions;

            export function Counter() {
              return <button>Count</button>;
            }
        "#;

        let result = match render_declarative_shadow_dom_module_with_inline_styles(
            source,
            "counter.wc.tsx",
            None,
            Some(r#"{"css":":host { display: block; }"}"#),
        ) {
            Ok(result) => result,
            Err(error) => panic!("DSD render failed: {error}"),
        };

        assert!(
            result
                .template_html
                .contains("<style>:host { display: block; }</style>")
        );
    }

    #[test]
    fn render_declarative_shadow_dom_module_should_serialize_switch_match_control_flow() {
        let source = r#"
            import { Match, Switch, state } from "@naos-ui/core";

            export function StatusPanel() {
              const loading = state(false);
              const failed = state(false);

              return (
                <section>
                  <Switch>
                    <Match when={loading()}>
                      <p>Loading</p>
                    </Match>
                    <Match when={failed()}>
                      <p>Error</p>
                    </Match>
                    <Match>
                      <p>Ready</p>
                    </Match>
                  </Switch>
                </section>
              );
            }
        "#;

        let result = match render_declarative_shadow_dom_module(source, "status-panel.wc.tsx", None)
        {
            Ok(result) => result,
            Err(error) => panic!("DSD render failed: {error}"),
        };

        assert!(
            result
                .template_html
                .contains("data-naos-control=\"switch\"")
        );
        assert!(
            result
                .template_html
                .contains("<span style=\"display: none\" data-naos-node=\"node1Match0\" hidden>")
        );
        assert!(
            result
                .template_html
                .contains("<span style=\"display: none\" data-naos-node=\"node1Match1\" hidden>")
        );
        assert!(
            result
                .template_html
                .contains("<span style=\"display: contents\" data-naos-node=\"node1Match2\">")
        );
        assert!(result.template_html.contains(">Ready<"));
    }

    #[test]
    fn render_declarative_shadow_dom_module_should_mark_unsupported_dynamic_values() {
        let source = r#"
            import { computed, state } from "@naos-ui/core";

            export function Counter({ label = "Count" }: CounterProps = {}) {
              const count = state(0);
              const text = computed(() => `${label}: ${count()}`);

              return <button>{text()}</button>;
            }
        "#;

        let result = match render_declarative_shadow_dom_module(source, "counter.wc.tsx", None) {
            Ok(result) => result,
            Err(error) => panic!("DSD render failed: {error}"),
        };

        assert!(result.template_html.contains("data-naos-text=\"text0\""));
        assert!(!result.template_html.contains("Count: 0"));
    }

    #[test]
    fn render_declarative_shadow_dom_module_should_evaluate_literal_initial_values() {
        let source = r#"
            import { state } from "@naos-ui/core";

            export function Snapshot({ label = "Count" }: SnapshotProps = {}) {
              const items = state(["A", label]);
              const meta = state({ name: label, count: 0 });
              const unsupported = state(makeValue());

              return (
                <section data-items={items()} data-meta={meta()}>
                  {`${label}: ${items()}`}
                  {unsupported()}
                </section>
              );
            }
        "#;

        let result = match render_declarative_shadow_dom_module(source, "snapshot.wc.tsx", None) {
            Ok(result) => result,
            Err(error) => panic!("DSD render failed: {error}"),
        };

        assert!(
            result
                .template_html
                .contains("data-items=\"[&quot;A&quot;,&quot;Count&quot;]\"")
        );
        assert!(
            result
                .template_html
                .contains("data-meta=\"{&quot;count&quot;:0,&quot;name&quot;:&quot;Count&quot;}\"")
        );
        assert!(result.template_html.contains("Count: [\"A\",\"Count\"]"));
        assert!(
            result
                .template_html
                .contains("data-naos-text=\"text1\"></span>")
        );
    }

    const PRIMITIVE_CONTRACT_SOURCE: &str = r#"
        import { Show, computed, event, on, state, type ComponentOptions } from "@naos-ui/core";
        import css from "./toggle.css?inline";

        export const options = {
          styles: [css],
        } satisfies ComponentOptions;

        export function Toggle({ label = "Power", disabled = false }: ToggleProps = {}) {
          const pressed = state(false);
          const stateLabel = computed(() => pressed() ? "On" : "Off");
          const indicators = computed(() => pressed() ? ["Pressed", "Active"] : ["Idle"]);
          const changed = event<boolean>("toggle-change");

          return (
            <button
              part="root control"
              data-state={pressed() ? "on" : "off"}
              data-disabled={disabled || undefined}
              aria-pressed={pressed()}
              disabled={disabled}
              onClick={() => {
                if (disabled) return;
                pressed.update((value) => !value);
                changed.emit(pressed());
              }}
            >
              <span part="label">{label}</span>
              <Show when={pressed()} fallback={<span part="indicator">Off</span>}>
                <span part="indicator">{stateLabel()}</span>
              </Show>
              {indicators().map((item, index) => (
                <span key={item} part="indicator" data-index={index}>
                  {item}
                </span>
              ))}
              <slot />
            </button>
          );
        }
    "#;

    #[test]
    fn generated_custom_element_contract_should_cover_primitive_public_surface() {
        let result = match transform_component_module(PRIMITIVE_CONTRACT_SOURCE, "toggle.wc.tsx") {
            Ok(result) => result,
            Err(error) => panic!("transform failed: {error}"),
        };

        assert_contains(&result.code, "class ToggleElement extends HTMLElement");
        assert_contains(
            &result.code,
            "__naosDefineComponent(\"x-toggle\", ToggleElement, __naosComponentMetadata)",
        );
        assert_contains(&result.code, "static get observedAttributes() {");
        assert_contains(&result.code, "return [\"label\", \"disabled\"];");
        assert_contains(
            &result.code,
            "__naosDefineProps(ToggleElement, __naosComponentSpec);",
        );
        assert_contains(&result.code, "label: { source: \"label\"");
        assert_contains(&result.code, "disabled: { source: \"disabled\"");
        assert_contains(&result.code, "setAttribute(\"part\", \"root control\")");
        assert_contains(&result.code, "setAttr as __naosSetAttr");
        assert_contains(&result.code, "__naosSetAttr(this.#node0, \"data-state\",");
        assert_contains(&result.code, "__naosSetAttr(this.#node0, \"aria-pressed\",");
        assert_contains(&result.code, "disabled: { source: \"disabled\"");
        assert_contains(&result.code, "document.createElement(\"slot\")");
        assert_contains(
            &result.code,
            "__naosEmitter(this[__naosKernel], \"toggle-change\")",
        );
        assert_contains(
            &result.code,
            "const __naosComponentStyles = __naosLazySheet([css]);",
        );
        assert_contains(&result.code, "styles: __naosComponentStyles,");
    }

    #[test]
    fn generated_dsd_contract_should_cover_static_output_and_internal_markers() {
        let result = match render_declarative_shadow_dom_module_with_inline_styles(
            PRIMITIVE_CONTRACT_SOURCE,
            "toggle.wc.tsx",
            Some(r#"{"label":"Power"}"#),
            Some(r#"{"css":":host { display: inline-block; }"}"#),
        ) {
            Ok(result) => result,
            Err(error) => panic!("DSD render failed: {error}"),
        };

        assert_eq!(result.tag_name, "x-toggle");
        assert_eq!(result.class_name, "ToggleElement");
        assert_eq!(result.export_name.as_deref(), Some("Toggle"));
        assert!(result.uses_declarative_shadow_dom);
        assert!(result.html.starts_with("<x-toggle label=\"Power\">"));
        assert_contains(&result.template_html, "<template shadowrootmode=\"open\">");
        assert_contains(
            &result.template_html,
            "<style>:host { display: inline-block; }</style>",
        );
        assert_contains(&result.template_html, "part=\"root control\"");
        assert_contains(&result.template_html, "data-state=\"off\"");
        assert_contains(&result.template_html, "aria-pressed=\"false\"");
        assert_contains(&result.template_html, "<slot data-naos-node=");
        assert_contains(&result.template_html, "data-naos-root=\"\"");
        assert_contains(&result.template_html, "data-naos-node=\"node0\"");
        assert_contains(&result.template_html, "data-naos-text=\"text0\"");
        assert_contains(&result.template_html, "data-naos-control=\"show\"");
        assert_contains(&result.template_html, "data-naos-control=\"for\"");
        assert_not_contains(&result.template_html, "addEventListener");
        assert_not_contains(&result.template_html, "toggle-change");
        assert_not_contains(&result.template_html, "CustomEvent");
    }

    #[test]
    fn render_declarative_shadow_dom_module_should_reject_non_object_props() {
        let source = r#"
            export function Counter() {
              return <button>Count</button>;
            }
        "#;

        let error = render_declarative_shadow_dom_module(source, "counter.wc.tsx", Some("[]"))
            .expect_err("non-object props should be rejected");

        assert!(error.to_string().contains("DSD prerender props"));
    }

    fn assert_contains(haystack: &str, needle: &str) {
        assert!(
            haystack.contains(needle),
            "expected generated output to contain `{needle}`"
        );
    }

    fn assert_not_contains(haystack: &str, needle: &str) {
        assert!(
            !haystack.contains(needle),
            "expected generated output not to contain `{needle}`"
        );
    }

    fn occurrence_count(haystack: &str, needle: &str) -> usize {
        haystack.match_indices(needle).count()
    }

    fn section_between<'a>(haystack: &'a str, start: &str, end: &str) -> &'a str {
        let after_start = haystack
            .split_once(start)
            .unwrap_or_else(|| {
                panic!("expected generated output to contain section start `{start}`")
            })
            .1;
        after_start
            .split_once(end)
            .unwrap_or_else(|| panic!("expected generated output to contain section end `{end}`"))
            .0
    }

    #[test]
    fn location_for_span_should_resolve_one_based_lines_and_columns() {
        let source = "const a = 1\nconst bug = 2\n";
        let loc = location_for_span(source, DiagnosticSpan { start: 18, end: 21 })
            .expect("span should resolve");
        assert_eq!((loc.start_line, loc.start_column), (2, 7));
        assert_eq!((loc.end_line, loc.end_column), (2, 10));
    }

    #[test]
    fn location_for_span_should_count_columns_in_characters() {
        let source = "const \u{fc} = 1\n";
        let one_offset = source.find('1').expect("literal");
        let loc = location_for_span(
            source,
            DiagnosticSpan {
                start: one_offset,
                end: one_offset + 1,
            },
        )
        .expect("span should resolve");
        assert_eq!((loc.start_line, loc.start_column), (1, 11));
    }

    #[test]
    fn location_for_span_should_reject_out_of_bounds_spans() {
        assert!(location_for_span("short", DiagnosticSpan { start: 3, end: 99 }).is_none());
    }

    #[test]
    fn transform_diagnostics_should_resolve_line_and_column_from_source() {
        let source = "import { state } from \"@naos-ui/core\"\n\nexport function Probe() {\n  const ready = state(false)\n  return (\n    <section>\n      {ready() ? <b>Y</b> : <b>N</b>}\n    </section>\n  )\n}\n";
        let error =
            transform_component_module_with_package(source, "probe.wc.tsx", &test_package())
                .expect_err("conditional JSX should be rejected");
        let diagnostic = &error.diagnostics_with_source("probe.wc.tsx", Some(source))[0];
        let loc = diagnostic
            .loc
            .expect("diagnostic should resolve a location");
        assert_eq!((loc.start_line, loc.start_column), (6, 5));
    }
}
