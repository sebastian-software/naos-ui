use std::collections::{BTreeMap, BTreeSet};
use std::fmt::Write as _;

use oxc_allocator::Allocator;
use oxc_ast::ast::{
    ArrowFunctionExpression, BlockStatement, CallExpression, FormalParameters, Function,
    IdentifierReference, VariableDeclarator,
};
use oxc_ast_visit::{Visit, walk};
use oxc_parser::Parser;
use oxc_span::SourceType;
use oxc_syntax::scope::ScopeFlags;

use crate::error::{
    CompilerError, CompilerResult, DIAGNOSTIC_CODE_UNSUPPORTED_CONDITIONAL_JSX,
    DIAGNOSTIC_CODE_UNSUPPORTED_LIST_RENDERER, DIAGNOSTIC_CODE_UNSUPPORTED_SHOW_FALLBACK,
    DIAGNOSTIC_CODE_UNSUPPORTED_SWITCH_MATCH, DIAGNOSTIC_HINT_LISTS, DIAGNOSTIC_HINT_SHOW,
    DIAGNOSTIC_HINT_SWITCH, dsd_input, unsupported, unsupported_at, unsupported_with_code_at,
};
use crate::model::{
    AttributeValue, ComponentModule, ComputedDefinition, DeclarativeShadowDomRenderResult,
    DiagnosticSpan, EffectDefinition, EventDefinition, FormControlDefinition,
    KeyedSelectorDefinition, PackageContext, PropDefinition, PropKind, SourceMap, StateDefinition,
    TemplateAttribute, TemplateChild, TemplateElement, TemplateList, TemplateListKey,
    TemplateListKind, TemplateListMotion, TransformResult,
};
use crate::naming::{
    custom_element_tag_for_component, event_name_from_attribute, is_pascal_case_identifier,
    kebab_case_identifier,
};
use crate::parse::analyze_component_module;
use serde_json::Value as JsonValue;

/// Transforms a TSX module into a native Custom Element JavaScript module.
///
/// # Errors
///
/// Returns [`CompilerError`] when analysis fails or the TSX template uses a
/// pattern outside the current compiler milestone.
pub fn transform_component_module(
    source: &str,
    filename: &str,
    package: &PackageContext,
) -> CompilerResult<TransformResult> {
    let module = analyze_component_module(source, filename, package)?;
    let mut generator = CodeGenerator::new(&module);
    let code = generator.generate(&module.template)?;
    let map = Some(source_map_for_transform(source, filename, &code));
    let has_changed = code != source;
    Ok(TransformResult {
        code,
        map,
        has_changed,
        tag_name: module.tag_name.clone(),
        class_name: module.class_name.clone(),
        export_name: module.export_name.clone(),
        shadow: module.options.shadow,
        style_imports: module.style_imports.clone(),
        package: module.package.clone(),
    })
}

/// Prerenders a TSX module into Declarative Shadow DOM host HTML.
///
/// The `props_json` argument is an optional JSON object with initial host prop
/// values. The returned host HTML uses Declarative Shadow DOM.
///
/// # Errors
///
/// Returns [`CompilerError`] when analysis fails, the template cannot be parsed,
/// or `props_json` is not a JSON object.
pub fn render_declarative_shadow_dom_module(
    source: &str,
    filename: &str,
    package: &PackageContext,
    props_json: Option<&str>,
) -> CompilerResult<DeclarativeShadowDomRenderResult> {
    render_declarative_shadow_dom_module_with_inline_styles(
        source, filename, package, props_json, None,
    )
}

/// Prerenders a TSX module with explicit inline style values.
///
/// The `inline_styles_json` argument is an optional JSON object keyed by local
/// `?inline` style import binding names.
///
/// # Errors
///
/// Returns [`CompilerError`] when analysis fails, the template cannot be parsed,
/// `props_json` is not a JSON object, or `inline_styles_json` is not a string
/// object.
pub fn render_declarative_shadow_dom_module_with_inline_styles(
    source: &str,
    filename: &str,
    package: &PackageContext,
    props_json: Option<&str>,
    inline_styles_json: Option<&str>,
) -> CompilerResult<DeclarativeShadowDomRenderResult> {
    let module = analyze_component_module(source, filename, package)?;
    let props = parse_prerender_props(props_json)?;
    let inline_styles = parse_inline_styles(inline_styles_json)?;
    let mut renderer = DeclarativeShadowDomRenderer::new(&module, props, inline_styles)?;
    renderer.render(&module.template)
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum ReactiveDependencies {
    Known(BTreeSet<String>),
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct UpdateStep {
    lines: Vec<String>,
    dependencies: ReactiveDependencies,
}

impl UpdateStep {
    fn new(line: String, dependencies: ReactiveDependencies) -> Self {
        Self {
            lines: vec![line],
            dependencies,
        }
    }

    fn lines(lines: Vec<String>, dependencies: ReactiveDependencies) -> Self {
        Self {
            lines,
            dependencies,
        }
    }
}

struct CodeGenerator<'a> {
    module: &'a ComponentModule,
    next_node_index: usize,
    next_text_index: usize,
    node_fields: Vec<String>,
    element_ref_names: Vec<String>,
    list_record_fields: Vec<String>,
    spread_fields: Vec<String>,
    text_fields: Vec<String>,
    mount_lines: Vec<String>,
    ref_lines: Vec<String>,
    listener_lines: Vec<String>,
    update_steps: Vec<UpdateStep>,
    uses_spread_attributes: bool,
    uses_motion_flip: bool,
}

impl<'a> CodeGenerator<'a> {
    fn new(module: &'a ComponentModule) -> Self {
        Self {
            module,
            next_node_index: 0,
            next_text_index: 0,
            node_fields: Vec::new(),
            element_ref_names: Vec::new(),
            list_record_fields: Vec::new(),
            spread_fields: Vec::new(),
            text_fields: Vec::new(),
            mount_lines: Vec::new(),
            ref_lines: Vec::new(),
            listener_lines: Vec::new(),
            update_steps: Vec::new(),
            uses_spread_attributes: false,
            uses_motion_flip: false,
        }
    }

    fn generate(&mut self, root: &TemplateElement) -> CompilerResult<String> {
        self.collect_element_refs(root)?;
        let root_variable = self.emit_element(root)?;
        self.mount_lines
            .push(format!("this.#root.append({root_variable});"));

        let mut code = String::new();
        self.emit_runtime_imports(&mut code)?;
        self.emit_style_imports(&mut code)?;
        self.emit_component_imports(&mut code)?;
        self.emit_component_style_sheet(&mut code)?;
        writeln!(
            code,
            "class {} extends HTMLElement {{",
            self.module.class_name
        )
        .map_err(format_error)?;
        self.emit_form_associated_flag(&mut code)?;
        self.emit_observed_attributes(&mut code)?;
        self.emit_fields(&mut code)?;
        self.emit_constructor(&mut code)?;
        self.emit_lifecycle(&mut code)?;
        self.emit_prop_accessors(&mut code)?;
        self.emit_state_initializer(&mut code)?;
        self.emit_form_callbacks(&mut code)?;
        self.emit_mount(&mut code)?;
        self.emit_hydration(&mut code)?;
        self.emit_bindings(&mut code)?;
        self.emit_effects(&mut code)?;
        self.emit_flush(&mut code)?;
        self.emit_spread_helpers(&mut code)?;
        self.emit_update(&mut code)?;
        writeln!(code, "}}").map_err(format_error)?;
        self.emit_exports(&mut code)?;
        Ok(code)
    }

    fn emit_component_imports(&self, code: &mut String) -> CompilerResult<()> {
        let mut sources = Vec::new();
        for component_import in &self.module.component_imports {
            if sources
                .iter()
                .any(|source| source == &component_import.source)
            {
                continue;
            }
            sources.push(component_import.source.clone());
            writeln!(
                code,
                "import \"{}\";",
                escape_js_string(&component_import.source)
            )
            .map_err(format_error)?;
        }
        if !sources.is_empty() {
            writeln!(code).map_err(format_error)?;
        }
        Ok(())
    }

    fn emit_component_style_sheet(&self, code: &mut String) -> CompilerResult<()> {
        if self.module.options.styles.is_empty() {
            return Ok(());
        }
        writeln!(code, "let __naosComponentStyleSheet;").map_err(format_error)?;
        writeln!(code, "function __naosComponentStyles() {{").map_err(format_error)?;
        writeln!(code, "  if (!__naosComponentStyleSheet) {{").map_err(format_error)?;
        writeln!(code, "    __naosComponentStyleSheet = new CSSStyleSheet();")
            .map_err(format_error)?;
        writeln!(
            code,
            "    __naosComponentStyleSheet.replaceSync([{}].join(\"\\n\"));",
            self.module.options.styles.join(", ")
        )
        .map_err(format_error)?;
        writeln!(code, "  }}").map_err(format_error)?;
        writeln!(code, "  return __naosComponentStyleSheet;").map_err(format_error)?;
        writeln!(code, "}}").map_err(format_error)?;
        writeln!(code).map_err(format_error)?;
        Ok(())
    }

    fn push_update_line(&mut self, line: String, dependencies: ReactiveDependencies) {
        self.update_steps.push(UpdateStep::new(line, dependencies));
    }

    fn push_update_lines(&mut self, lines: Vec<String>, dependencies: ReactiveDependencies) {
        self.update_steps
            .push(UpdateStep::lines(lines, dependencies));
    }

    fn dependencies_for_expression(&self, expression: &str) -> ReactiveDependencies {
        expression_dependencies(expression, self.module)
    }

    fn binding_names(&self) -> Vec<String> {
        binding_names_with_refs(self.module, &self.element_ref_names)
    }

    fn collect_element_refs(&mut self, element: &TemplateElement) -> CompilerResult<()> {
        for attribute in &element.attributes {
            let TemplateAttribute::Named { name, value } = attribute else {
                continue;
            };
            if name != "ref" {
                continue;
            }
            let AttributeValue::Expression(expression) = value else {
                return Err(unsupported_at(
                    "JSX `ref` must use a braced value.",
                    element.span,
                ));
            };
            let expression = expression.trim();
            if is_identifier(expression) {
                if binding_names(self.module)
                    .iter()
                    .any(|name| name == expression)
                {
                    return Err(unsupported_at(
                        format!(
                            "JSX ref variable `{expression}` conflicts with an existing component binding."
                        ),
                        element.span,
                    ));
                }
                if !self.element_ref_names.iter().any(|name| name == expression) {
                    self.element_ref_names.push(expression.to_owned());
                }
            } else if !is_ref_callback_expression(expression) {
                return Err(unsupported_at(
                    "JSX `ref` supports an identifier variable or arrow-function callback.",
                    element.span,
                ));
            }
        }

        for child in &element.children {
            match child {
                TemplateChild::Element(child_element) => {
                    self.collect_element_refs(child_element)?;
                }
                TemplateChild::List(renderer) => {
                    self.collect_element_refs(&renderer.template)?;
                }
                TemplateChild::Expression(_) | TemplateChild::Text(_) => {}
            }
        }
        Ok(())
    }

    fn dependencies_for_expression_without_keyed_selectors(
        &self,
        expression: &str,
    ) -> ReactiveDependencies {
        expression_dependencies_without_keyed_selectors(expression, self.module)
    }

    fn dependencies_for_list_renderer(&self, renderer: &ListRenderer) -> ReactiveDependencies {
        let mut expressions = vec![renderer.each_expression.as_str()];
        if let TemplateListKind::ItemKeyed {
            key: TemplateListKey::Expression(key),
        } = &renderer.kind
        {
            expressions.push(key);
        }
        collect_template_expressions(&renderer.template, &mut expressions);

        let mut dependencies = BTreeSet::new();
        for expression in expressions {
            match self.dependencies_for_expression_without_keyed_selectors(expression) {
                ReactiveDependencies::Known(sources) => dependencies.extend(sources),
                ReactiveDependencies::Unknown => return ReactiveDependencies::Unknown,
            }
        }
        ReactiveDependencies::Known(dependencies)
    }

    fn uses_scheduled_updates(&self) -> bool {
        !self.module.states.is_empty() || self.module.uses_host_helpers
    }

    fn uses_event_abort_signals(&self) -> bool {
        !self.listener_lines.is_empty()
    }

    fn uses_keyed_selectors(&self) -> bool {
        !self.module.keyed_selectors.is_empty()
    }

    fn emit_runtime_imports(&self, code: &mut String) -> CompilerResult<()> {
        if self.uses_scheduled_updates() {
            writeln!(
                code,
                "import {{ scheduleNaosUpdate as __scheduleNaosUpdate }} from \"@naos-ui/runtime\";"
            )
            .map_err(format_error)?;
        }
        if self.uses_motion_flip {
            writeln!(
                code,
                "import {{ flipMovedElements as __naosFlipMovedElements }} from \"@naos-ui/motion\";"
            )
            .map_err(format_error)?;
        }
        for runtime_import in &self.module.runtime_imports {
            writeln!(code, "{}", runtime_import.source).map_err(format_error)?;
        }
        if self.uses_scheduled_updates()
            || self.uses_motion_flip
            || !self.module.runtime_imports.is_empty()
        {
            writeln!(code).map_err(format_error)?;
        }
        Ok(())
    }

    fn emit_style_imports(&self, code: &mut String) -> CompilerResult<()> {
        for style_import in &self.module.style_imports {
            writeln!(
                code,
                "import {} from \"{}\";",
                style_import.local_name,
                escape_js_string(&style_import.source)
            )
            .map_err(format_error)?;
        }
        if !self.module.style_imports.is_empty() {
            writeln!(code).map_err(format_error)?;
        }
        Ok(())
    }

    fn emit_observed_attributes(&self, code: &mut String) -> CompilerResult<()> {
        let attributes = self
            .module
            .props
            .iter()
            .map(|prop| format!("\"{}\"", prop.attribute_name))
            .collect::<Vec<_>>()
            .join(", ");
        writeln!(code, "  static get observedAttributes() {{").map_err(format_error)?;
        writeln!(code, "    return [{attributes}];").map_err(format_error)?;
        writeln!(code, "  }}").map_err(format_error)?;
        Ok(())
    }

    fn emit_form_associated_flag(&self, code: &mut String) -> CompilerResult<()> {
        if self.module.form_controls.is_empty() {
            return Ok(());
        }
        writeln!(code, "  static formAssociated = true;").map_err(format_error)?;
        Ok(())
    }

    fn emit_fields(&self, code: &mut String) -> CompilerResult<()> {
        writeln!(code, "  #root;").map_err(format_error)?;
        writeln!(code, "  #mounted = false;").map_err(format_error)?;
        writeln!(code, "  #usesDeclarativeRoot = false;").map_err(format_error)?;
        writeln!(code, "  #dirtySources = new Set();").map_err(format_error)?;
        writeln!(code, "  #needsFullUpdate = true;").map_err(format_error)?;
        if self.module.uses_host_helpers {
            writeln!(code, "  #hostId = \"\";").map_err(format_error)?;
        }
        if self.uses_scheduled_updates() {
            writeln!(code, "  #flushScheduled = false;").map_err(format_error)?;
        }
        if self.module.uses_host_helpers {
            writeln!(code, "  #abortController = new AbortController();").map_err(format_error)?;
            writeln!(code, "  #updateAbortController = new AbortController();")
                .map_err(format_error)?;
            writeln!(code, "  #pendingUpdateResolvers = [];").map_err(format_error)?;
            writeln!(code, "  #queuedHostTasks = [];").map_err(format_error)?;
        }
        if self.uses_event_abort_signals() {
            writeln!(code, "  #eventAbortControllers = new Set();").map_err(format_error)?;
        }
        if !self.module.effects.is_empty() {
            writeln!(code, "  #effectsConnected = false;").map_err(format_error)?;
            writeln!(code, "  #effectCleanups = [];").map_err(format_error)?;
        }
        if !self.module.computed.is_empty() {
            writeln!(code, "  #computedCache = new Map();").map_err(format_error)?;
        }
        if !self.element_ref_names.is_empty() {
            writeln!(code, "  #refs = {{}};").map_err(format_error)?;
        }
        if self.uses_keyed_selectors() {
            writeln!(code, "  #keyedBindingRegistry = new Map();").map_err(format_error)?;
        }
        if !self.module.form_controls.is_empty() {
            writeln!(code, "  #internals;").map_err(format_error)?;
        }
        writeln!(code, "  #props = {{").map_err(format_error)?;
        for prop in &self.module.props {
            writeln!(
                code,
                "    {}: {},",
                prop.local_name,
                default_value_for_prop(prop)
            )
            .map_err(format_error)?;
        }
        writeln!(code, "  }};").map_err(format_error)?;
        writeln!(code, "  #state = {{}};").map_err(format_error)?;
        for field in &self.node_fields {
            writeln!(code, "  #{field};").map_err(format_error)?;
        }
        for field in &self.list_record_fields {
            writeln!(code, "  #{field} = new Map();").map_err(format_error)?;
        }
        for field in &self.spread_fields {
            writeln!(
                code,
                "  #{field} = {{ names: new Set(), listeners: new Map(), styles: new Set() }};"
            )
            .map_err(format_error)?;
        }
        for field in &self.text_fields {
            writeln!(code, "  #{field};").map_err(format_error)?;
        }
        Ok(())
    }

    fn emit_constructor(&self, code: &mut String) -> CompilerResult<()> {
        writeln!(code, "  constructor() {{").map_err(format_error)?;
        writeln!(code, "    super();").map_err(format_error)?;
        if !self.module.form_controls.is_empty() {
            writeln!(code, "    this.#internals = this.attachInternals();")
                .map_err(format_error)?;
        }
        if self.module.options.shadow {
            writeln!(code, "    const existingRoot = this.shadowRoot;").map_err(format_error)?;
            writeln!(code, "    if (existingRoot) {{").map_err(format_error)?;
            writeln!(code, "      this.#root = existingRoot;").map_err(format_error)?;
            writeln!(code, "      this.#usesDeclarativeRoot = true;").map_err(format_error)?;
            writeln!(code, "    }} else {{").map_err(format_error)?;
            writeln!(
                code,
                "      this.#root = this.attachShadow({{ mode: \"open\" }});"
            )
            .map_err(format_error)?;
            writeln!(code, "    }}").map_err(format_error)?;
        } else {
            writeln!(code, "    this.#root = this;").map_err(format_error)?;
        }
        writeln!(code, "  }}").map_err(format_error)?;
        Ok(())
    }

    fn emit_lifecycle(&self, code: &mut String) -> CompilerResult<()> {
        writeln!(code, "  connectedCallback() {{").map_err(format_error)?;
        if !self.module.options.shadow && !self.module.options.styles.is_empty() {
            // Light-DOM styles adopt into the current root node on every
            // connect so re-parenting into another shadow root stays styled.
            writeln!(code, "    this.#adoptStyles();").map_err(format_error)?;
        }
        writeln!(code, "    if (!this.#mounted) {{").map_err(format_error)?;
        if self.module.uses_host_helpers {
            writeln!(code, "      this.#ensureHostId();").map_err(format_error)?;
        }
        writeln!(code, "      this.#initializeState();").map_err(format_error)?;
        writeln!(code, "      if (this.#usesDeclarativeRoot) {{").map_err(format_error)?;
        writeln!(code, "        this.#hydrate();").map_err(format_error)?;
        writeln!(code, "      }} else {{").map_err(format_error)?;
        writeln!(code, "        this.#mount();").map_err(format_error)?;
        writeln!(code, "      }}").map_err(format_error)?;
        writeln!(code, "      this.#mounted = true;").map_err(format_error)?;
        writeln!(code, "    }} else {{").map_err(format_error)?;
        writeln!(code, "      this.#markAllDirty();").map_err(format_error)?;
        writeln!(code, "    }}").map_err(format_error)?;
        if !self.module.effects.is_empty() {
            writeln!(code, "    this.#effectsConnected = true;").map_err(format_error)?;
        }
        self.emit_lifecycle_callback_lines(code, &self.module.connected_callbacks)?;
        writeln!(code, "    this.#flushSync();").map_err(format_error)?;
        writeln!(code, "  }}").map_err(format_error)?;
        if self.module.uses_host_helpers
            || !self.module.effects.is_empty()
            || !self.module.disconnected_callbacks.is_empty()
        {
            writeln!(code, "  disconnectedCallback() {{").map_err(format_error)?;
            if !self.module.effects.is_empty() {
                writeln!(code, "    this.#effectsConnected = false;").map_err(format_error)?;
            }
            self.emit_lifecycle_callback_lines(code, &self.module.disconnected_callbacks)?;
            if self.uses_event_abort_signals() {
                writeln!(code, "    this.#abortEventHandlers();").map_err(format_error)?;
            }
            if self.module.uses_host_helpers {
                writeln!(code, "    this.#abortController.abort();").map_err(format_error)?;
                writeln!(code, "    this.#abortHostUpdateScope();").map_err(format_error)?;
            }
            if !self.module.effects.is_empty() {
                writeln!(code, "    this.#cleanupEffects();").map_err(format_error)?;
            }
            if self.module.uses_host_helpers {
                writeln!(code, "    this.#abortController = new AbortController();")
                    .map_err(format_error)?;
            }
            writeln!(code, "  }}").map_err(format_error)?;
        }
        writeln!(
            code,
            "  attributeChangedCallback(name, oldValue, newValue) {{"
        )
        .map_err(format_error)?;
        writeln!(code, "    if (oldValue === newValue) return;").map_err(format_error)?;
        writeln!(code, "    switch (name) {{").map_err(format_error)?;
        for prop in &self.module.props {
            writeln!(code, "      case \"{}\":", prop.attribute_name).map_err(format_error)?;
            writeln!(
                code,
                "        this.#props.{} = {};",
                prop.local_name,
                attr_parse_expression(prop)
            )
            .map_err(format_error)?;
            writeln!(code, "        this.#markDirty(\"{}\");", prop.local_name)
                .map_err(format_error)?;
            writeln!(code, "        break;").map_err(format_error)?;
        }
        writeln!(code, "    }}").map_err(format_error)?;
        writeln!(code, "    this.#flushSync();").map_err(format_error)?;
        writeln!(code, "  }}").map_err(format_error)?;
        Ok(())
    }

    fn emit_lifecycle_callback_lines(
        &self,
        code: &mut String,
        callbacks: &[crate::model::LifecycleCallbackDefinition],
    ) -> CompilerResult<()> {
        if callbacks.is_empty() {
            return Ok(());
        }
        let names = self.binding_names().join(", ");
        if !names.is_empty() {
            writeln!(code, "    const {{ {names} }} = this.#createBindings();")
                .map_err(format_error)?;
        }
        for callback in callbacks {
            for line in callback
                .body
                .lines()
                .map(str::trim)
                .filter(|line| !line.is_empty())
            {
                writeln!(code, "    {line}").map_err(format_error)?;
            }
        }
        Ok(())
    }

    fn emit_prop_accessors(&self, code: &mut String) -> CompilerResult<()> {
        for prop in &self.module.props {
            writeln!(code, "  get {}() {{", prop.prop_name).map_err(format_error)?;
            writeln!(code, "    return this.#props.{};", prop.local_name).map_err(format_error)?;
            writeln!(code, "  }}").map_err(format_error)?;
            writeln!(code, "  set {}(value) {{", prop.prop_name).map_err(format_error)?;
            writeln!(
                code,
                "    const nextValue = {};",
                setter_parse_expression(prop)
            )
            .map_err(format_error)?;
            writeln!(code, "    this.#props.{} = nextValue;", prop.local_name)
                .map_err(format_error)?;
            writeln!(code, "    this.#markDirty(\"{}\");", prop.local_name)
                .map_err(format_error)?;
            self.emit_attribute_sync(code, prop)?;
            writeln!(code, "    this.#flushSync();").map_err(format_error)?;
            writeln!(code, "  }}").map_err(format_error)?;
        }
        Ok(())
    }

    fn emit_state_initializer(&self, code: &mut String) -> CompilerResult<()> {
        writeln!(code, "  #initializeState() {{").map_err(format_error)?;
        for prop in &self.module.props {
            writeln!(
                code,
                "    const {} = this.#props.{};",
                prop.local_name, prop.local_name
            )
            .map_err(format_error)?;
        }
        for state in &self.module.states {
            writeln!(
                code,
                "    this.#state.{} = {};",
                state.local_name, state.initial_value
            )
            .map_err(format_error)?;
        }
        writeln!(code, "  }}").map_err(format_error)?;
        Ok(())
    }

    fn emit_form_callbacks(&self, code: &mut String) -> CompilerResult<()> {
        let Some(form_control) = self.module.form_controls.first() else {
            return Ok(());
        };

        self.emit_sync_form_value(code, form_control)?;
        self.emit_form_reset_callback(code, form_control)?;
        self.emit_form_disabled_callback(code, form_control)?;
        Ok(())
    }

    fn emit_sync_form_value(
        &self,
        code: &mut String,
        form_control: &FormControlDefinition,
    ) -> CompilerResult<()> {
        writeln!(code, "  #syncFormValue(dirtySources) {{").map_err(format_error)?;
        writeln!(code, "    if (!this.#mounted) return;").map_err(format_error)?;
        writeln!(
            code,
            "    if (!this.#shouldUpdate({}, dirtySources)) return;",
            dependencies_argument(
                &self.dependencies_for_expression(&form_control.value_expression)
            )
        )
        .map_err(format_error)?;
        let names = self.binding_names().join(", ");
        if !names.is_empty() {
            writeln!(code, "    const {{ {names} }} = this.#createBindings();")
                .map_err(format_error)?;
        }
        writeln!(
            code,
            "    this.#internals.setFormValue({});",
            form_control.value_expression
        )
        .map_err(format_error)?;
        writeln!(code, "  }}").map_err(format_error)?;
        Ok(())
    }

    fn emit_form_reset_callback(
        &self,
        code: &mut String,
        form_control: &FormControlDefinition,
    ) -> CompilerResult<()> {
        writeln!(code, "  formResetCallback() {{").map_err(format_error)?;
        if let Some(reset_body) = &form_control.reset_body {
            let names = self.binding_names().join(", ");
            if !names.is_empty() {
                writeln!(code, "    const {{ {names} }} = this.#createBindings();")
                    .map_err(format_error)?;
            }
            for line in reset_body
                .lines()
                .map(str::trim)
                .filter(|line| !line.is_empty())
            {
                writeln!(code, "    {line}").map_err(format_error)?;
            }
        } else {
            writeln!(code, "    this.#initializeState();").map_err(format_error)?;
            writeln!(code, "    this.#markAllDirty();").map_err(format_error)?;
        }
        writeln!(code, "    this.#flushSync();").map_err(format_error)?;
        writeln!(code, "  }}").map_err(format_error)?;
        Ok(())
    }

    fn emit_form_disabled_callback(
        &self,
        code: &mut String,
        form_control: &FormControlDefinition,
    ) -> CompilerResult<()> {
        writeln!(code, "  formDisabledCallback(disabled) {{").map_err(format_error)?;
        if let Some(disabled_expression) = &form_control.disabled_expression
            && let Some(prop) = self.module.props.iter().find(|prop| {
                prop.local_name == disabled_expression.trim()
                    && matches!(prop.kind, PropKind::Boolean)
            })
        {
            writeln!(code, "    this.{} = disabled;", prop.prop_name).map_err(format_error)?;
        }
        writeln!(code, "    this.#flushSync();").map_err(format_error)?;
        writeln!(code, "  }}").map_err(format_error)?;
        Ok(())
    }

    fn emit_attribute_sync(&self, code: &mut String, prop: &PropDefinition) -> CompilerResult<()> {
        match prop.kind {
            PropKind::Boolean => {
                writeln!(code, "    if (nextValue) {{").map_err(format_error)?;
                writeln!(
                    code,
                    "      this.setAttribute(\"{}\", \"\");",
                    prop.attribute_name
                )
                .map_err(format_error)?;
                writeln!(code, "    }} else {{").map_err(format_error)?;
                writeln!(
                    code,
                    "      this.removeAttribute(\"{}\");",
                    prop.attribute_name
                )
                .map_err(format_error)?;
                writeln!(code, "    }}").map_err(format_error)?;
            }
            PropKind::Number | PropKind::String => {
                writeln!(
                    code,
                    "    if (this.getAttribute(\"{}\") !== String(nextValue)) {{",
                    prop.attribute_name
                )
                .map_err(format_error)?;
                writeln!(
                    code,
                    "      this.setAttribute(\"{}\", String(nextValue));",
                    prop.attribute_name
                )
                .map_err(format_error)?;
                writeln!(code, "    }}").map_err(format_error)?;
            }
        }
        Ok(())
    }

    fn emit_mount(&self, code: &mut String) -> CompilerResult<()> {
        if !self.module.options.styles.is_empty() {
            writeln!(code, "  #adoptStyles() {{").map_err(format_error)?;
            if self.module.options.shadow {
                writeln!(
                    code,
                    "    this.#root.adoptedStyleSheets = [__naosComponentStyles()];"
                )
                .map_err(format_error)?;
            } else {
                writeln!(code, "    const root = this.getRootNode();").map_err(format_error)?;
                writeln!(code, "    const sheet = __naosComponentStyles();")
                    .map_err(format_error)?;
                writeln!(code, "    if (!root.adoptedStyleSheets.includes(sheet)) {{")
                    .map_err(format_error)?;
                writeln!(
                    code,
                    "      root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];"
                )
                .map_err(format_error)?;
                writeln!(code, "    }}").map_err(format_error)?;
            }
            writeln!(code, "  }}").map_err(format_error)?;
        }
        writeln!(code, "  #mount() {{").map_err(format_error)?;
        if self.module.options.shadow && !self.module.options.styles.is_empty() {
            writeln!(code, "    this.#adoptStyles();").map_err(format_error)?;
        }
        for line in &self.mount_lines {
            writeln!(code, "    {line}").map_err(format_error)?;
        }
        if !self.ref_lines.is_empty() {
            writeln!(code, "    this.#applyRefs();").map_err(format_error)?;
        }
        writeln!(code, "    this.#installEventListeners();").map_err(format_error)?;
        writeln!(code, "  }}").map_err(format_error)?;
        Ok(())
    }

    fn emit_hydration(&self, code: &mut String) -> CompilerResult<()> {
        writeln!(code, "  #hydrate() {{").map_err(format_error)?;
        writeln!(code, "    try {{").map_err(format_error)?;
        for field in &self.node_fields {
            writeln!(
                code,
                "      this.#{field} = this.#requiredHydrationElement(\"{field}\");"
            )
            .map_err(format_error)?;
        }
        for field in &self.text_fields {
            writeln!(
                code,
                "      this.#{field} = this.#requiredHydrationText(\"{field}\");"
            )
            .map_err(format_error)?;
        }
        if !self.ref_lines.is_empty() {
            writeln!(code, "      this.#applyRefs();").map_err(format_error)?;
        }
        writeln!(code, "      this.#installEventListeners();").map_err(format_error)?;
        writeln!(code, "    }} catch (error) {{").map_err(format_error)?;
        writeln!(code, "      if (this.#isDevelopment()) {{").map_err(format_error)?;
        writeln!(code, "        throw error;").map_err(format_error)?;
        writeln!(code, "      }}").map_err(format_error)?;
        writeln!(code, "      this.#remount();").map_err(format_error)?;
        writeln!(code, "    }}").map_err(format_error)?;
        writeln!(code, "  }}").map_err(format_error)?;
        writeln!(code, "  #remount() {{").map_err(format_error)?;
        writeln!(code, "    this.#root.replaceChildren();").map_err(format_error)?;
        writeln!(code, "    this.#mount();").map_err(format_error)?;
        writeln!(code, "  }}").map_err(format_error)?;
        writeln!(code, "  #requiredHydrationElement(marker) {{").map_err(format_error)?;
        writeln!(
            code,
            "    const node = this.#root.querySelector(`[data-naos-node=\"${{marker}}\"]`);"
        )
        .map_err(format_error)?;
        writeln!(code, "    if (!(node instanceof Element)) {{").map_err(format_error)?;
        writeln!(
            code,
            "      throw this.#hydrationError(`missing [data-naos-node=\"${{marker}}\"]`);"
        )
        .map_err(format_error)?;
        writeln!(code, "    }}").map_err(format_error)?;
        writeln!(code, "    return node;").map_err(format_error)?;
        writeln!(code, "  }}").map_err(format_error)?;
        writeln!(code, "  #requiredHydrationText(marker) {{").map_err(format_error)?;
        writeln!(
            code,
            "    const markerElement = this.#root.querySelector(`[data-naos-text=\"${{marker}}\"]`);"
        )
        .map_err(format_error)?;
        writeln!(code, "    if (!(markerElement instanceof Element)) {{").map_err(format_error)?;
        writeln!(
            code,
            "      throw this.#hydrationError(`missing [data-naos-text=\"${{marker}}\"]`);"
        )
        .map_err(format_error)?;
        writeln!(code, "    }}").map_err(format_error)?;
        writeln!(code, "    let node = markerElement.firstChild;").map_err(format_error)?;
        writeln!(code, "    if (!node) {{").map_err(format_error)?;
        writeln!(code, "      node = document.createTextNode(\"\");").map_err(format_error)?;
        writeln!(code, "      markerElement.append(node);").map_err(format_error)?;
        writeln!(code, "    }}").map_err(format_error)?;
        writeln!(code, "    if (node.nodeType !== Node.TEXT_NODE) {{").map_err(format_error)?;
        writeln!(
            code,
            "      throw this.#hydrationError(`expected text for [data-naos-text=\"${{marker}}\"]`);"
        )
        .map_err(format_error)?;
        writeln!(code, "    }}").map_err(format_error)?;
        writeln!(code, "    return node;").map_err(format_error)?;
        writeln!(code, "  }}").map_err(format_error)?;
        writeln!(code, "  #hydrationError(reason) {{").map_err(format_error)?;
        writeln!(
            code,
            "    return new Error(`Naos hydration mismatch for <${{this.localName}}>: ${{reason}}.`);"
        )
        .map_err(format_error)?;
        writeln!(code, "  }}").map_err(format_error)?;
        writeln!(code, "  #isDevelopment() {{").map_err(format_error)?;
        writeln!(code, "    return import.meta.env?.DEV ?? true;").map_err(format_error)?;
        writeln!(code, "  }}").map_err(format_error)?;
        writeln!(code, "  #installEventListeners() {{").map_err(format_error)?;
        for line in &self.listener_lines {
            writeln!(code, "    {line}").map_err(format_error)?;
        }
        writeln!(code, "  }}").map_err(format_error)?;
        if !self.ref_lines.is_empty() {
            writeln!(code, "  #applyRefs() {{").map_err(format_error)?;
            for line in &self.ref_lines {
                writeln!(code, "    {line}").map_err(format_error)?;
            }
            writeln!(code, "  }}").map_err(format_error)?;
        }
        Ok(())
    }

    fn emit_bindings(&self, code: &mut String) -> CompilerResult<()> {
        writeln!(code, "  #createBindings() {{").map_err(format_error)?;
        for prop in &self.module.props {
            writeln!(
                code,
                "    const {} = this.#props.{};",
                prop.local_name, prop.local_name
            )
            .map_err(format_error)?;
        }
        for state in &self.module.states {
            self.emit_state_binding(code, state)?;
        }
        for computed in &self.module.computed {
            self.emit_computed_binding(code, computed)?;
        }
        for selector in &self.module.keyed_selectors {
            self.emit_keyed_selector_binding(code, selector)?;
        }
        for event in &self.module.events {
            self.emit_event_binding(code, event)?;
        }
        for ref_name in &self.element_ref_names {
            writeln!(
                code,
                "    const {ref_name} = this.#refs.{ref_name} ?? null;"
            )
            .map_err(format_error)?;
        }
        if self.module.uses_host_helpers {
            writeln!(code, "    const host = () => ({{").map_err(format_error)?;
            writeln!(code, "      id: this.#hostId,").map_err(format_error)?;
            writeln!(code, "      element: this,").map_err(format_error)?;
            writeln!(code, "      root: this.#root,").map_err(format_error)?;
            writeln!(code, "      props: this.#props,").map_err(format_error)?;
            writeln!(code, "      signal: this.#abortController.signal,").map_err(format_error)?;
            writeln!(
                code,
                "      update: () => new Promise((resolve) => {{ this.#pendingUpdateResolvers.push(resolve); this.#markAllDirty(); this.#scheduleFlush(); }}),"
            )
            .map_err(format_error)?;
            writeln!(
                code,
                "      queueTask: (task) => {{ this.#queuedHostTasks.push(task); this.#scheduleFlush(); }},"
            )
            .map_err(format_error)?;
            writeln!(code, "      flushSync: () => this.#flushSync(),").map_err(format_error)?;
            writeln!(code, "    }});").map_err(format_error)?;
        }
        let names = self.binding_names().join(", ");
        writeln!(code, "    return {{ {names} }};").map_err(format_error)?;
        writeln!(code, "  }}").map_err(format_error)?;
        Ok(())
    }

    fn emit_state_binding(&self, code: &mut String, state: &StateDefinition) -> CompilerResult<()> {
        writeln!(
            code,
            "    const {} = () => this.#state.{};",
            state.local_name, state.local_name
        )
        .map_err(format_error)?;
        let keyed_selectors = self
            .module
            .keyed_selectors
            .iter()
            .filter(|selector| selector.source_name == state.local_name)
            .collect::<Vec<_>>();
        if keyed_selectors.is_empty() {
            writeln!(
                code,
                "    {}.set = (value) => {{ if (Object.is(this.#state.{}, value)) return; this.#state.{} = value; this.#markDirty(\"{}\"); this.#scheduleFlush(); }};",
                state.local_name, state.local_name, state.local_name, state.local_name
            )
            .map_err(format_error)?;
        } else {
            writeln!(code, "    {}.set = (value) => {{", state.local_name).map_err(format_error)?;
            writeln!(
                code,
                "      const previousValue = this.#state.{};",
                state.local_name
            )
            .map_err(format_error)?;
            writeln!(code, "      if (Object.is(previousValue, value)) return;")
                .map_err(format_error)?;
            writeln!(code, "      this.#state.{} = value;", state.local_name)
                .map_err(format_error)?;
            writeln!(code, "      this.#markDirty(\"{}\");", state.local_name)
                .map_err(format_error)?;
            for selector in keyed_selectors {
                writeln!(
                    code,
                    "      this.#markKeyedSelectorDirty(\"{}\", previousValue, value);",
                    escape_js_string(&selector.local_name)
                )
                .map_err(format_error)?;
            }
            writeln!(code, "      this.#scheduleFlush();").map_err(format_error)?;
            writeln!(code, "    }};").map_err(format_error)?;
        }
        writeln!(
            code,
            "    {}.update = (updater) => {{ {}.set(updater({}())); }};",
            state.local_name, state.local_name, state.local_name
        )
        .map_err(format_error)?;
        Ok(())
    }

    fn emit_keyed_selector_binding(
        &self,
        code: &mut String,
        selector: &KeyedSelectorDefinition,
    ) -> CompilerResult<()> {
        writeln!(
            code,
            "    const {} = ({}) => {}() === {};",
            selector.local_name,
            selector.parameter_name,
            selector.source_name,
            selector.parameter_name
        )
        .map_err(format_error)?;
        Ok(())
    }

    fn emit_computed_binding(
        &self,
        code: &mut String,
        computed: &ComputedDefinition,
    ) -> CompilerResult<()> {
        writeln!(code, "    const {} = () => {{", computed.local_name).map_err(format_error)?;
        writeln!(
            code,
            "      if (!this.#computedCache.has(\"{}\")) {{",
            computed.local_name
        )
        .map_err(format_error)?;
        writeln!(
            code,
            "        this.#computedCache.set(\"{}\", ({}));",
            computed.local_name, computed.expression
        )
        .map_err(format_error)?;
        writeln!(code, "      }}").map_err(format_error)?;
        writeln!(
            code,
            "      return this.#computedCache.get(\"{}\");",
            computed.local_name
        )
        .map_err(format_error)?;
        writeln!(code, "    }};").map_err(format_error)?;
        Ok(())
    }

    fn emit_event_binding(&self, code: &mut String, event: &EventDefinition) -> CompilerResult<()> {
        writeln!(code, "    const {} = {{", event.local_name).map_err(format_error)?;
        writeln!(code, "      emit: (detail) => {{").map_err(format_error)?;
        writeln!(code, "        this.dispatchEvent(new CustomEvent(\"{}\", {{ detail, bubbles: true, composed: true, cancelable: false }}));", event.event_name)
            .map_err(format_error)?;
        writeln!(code, "      }}").map_err(format_error)?;
        writeln!(code, "    }};").map_err(format_error)?;
        Ok(())
    }

    fn emit_effects(&self, code: &mut String) -> CompilerResult<()> {
        if self.module.effects.is_empty() {
            return Ok(());
        }
        writeln!(code, "  #cleanupEffects() {{").map_err(format_error)?;
        writeln!(
            code,
            "    for (let index = 0; index < this.#effectCleanups.length; index += 1) {{"
        )
        .map_err(format_error)?;
        writeln!(code, "      this.#cleanupEffect(index);").map_err(format_error)?;
        writeln!(code, "    }}").map_err(format_error)?;
        writeln!(code, "  }}").map_err(format_error)?;
        writeln!(code, "  #cleanupEffect(index) {{").map_err(format_error)?;
        writeln!(code, "    const cleanup = this.#effectCleanups[index];").map_err(format_error)?;
        writeln!(code, "    if (typeof cleanup === \"function\") cleanup();")
            .map_err(format_error)?;
        writeln!(code, "    this.#effectCleanups[index] = undefined;").map_err(format_error)?;
        writeln!(code, "  }}").map_err(format_error)?;
        writeln!(code, "  #runEffects(dirtySources) {{").map_err(format_error)?;
        writeln!(code, "    if (!this.#effectsConnected) return;").map_err(format_error)?;
        let names = self.binding_names().join(", ");
        if !names.is_empty() {
            writeln!(code, "    const {{ {names} }} = this.#createBindings();")
                .map_err(format_error)?;
        }
        for (index, effect) in self.module.effects.iter().enumerate() {
            let dependencies = self.dependencies_for_expression(&effect.body);
            writeln!(
                code,
                "    if (this.#shouldUpdate({}, dirtySources)) {{",
                dependencies_argument(&dependencies)
            )
            .map_err(format_error)?;
            writeln!(code, "      this.#cleanupEffect({index});").map_err(format_error)?;
            self.emit_effect_body(code, index, effect)?;
            writeln!(code, "    }}").map_err(format_error)?;
        }
        writeln!(code, "  }}").map_err(format_error)?;
        Ok(())
    }

    fn emit_effect_body(
        &self,
        code: &mut String,
        index: usize,
        effect: &EffectDefinition,
    ) -> CompilerResult<()> {
        writeln!(code, "      const cleanup{index} = (() => {{").map_err(format_error)?;
        for line in effect
            .body
            .lines()
            .map(str::trim)
            .filter(|line| !line.is_empty())
        {
            writeln!(code, "        {line}").map_err(format_error)?;
        }
        writeln!(code, "      }})();").map_err(format_error)?;
        writeln!(code, "      if (typeof cleanup{index} === \"function\") {{")
            .map_err(format_error)?;
        writeln!(
            code,
            "        this.#effectCleanups[{index}] = cleanup{index};"
        )
        .map_err(format_error)?;
        writeln!(code, "      }}").map_err(format_error)?;
        Ok(())
    }

    fn emit_flush(&self, code: &mut String) -> CompilerResult<()> {
        if self.uses_scheduled_updates() {
            writeln!(code, "  #scheduleFlush() {{").map_err(format_error)?;
            writeln!(code, "    if (this.#flushScheduled) return;").map_err(format_error)?;
            writeln!(code, "    this.#flushScheduled = true;").map_err(format_error)?;
            writeln!(code, "    __scheduleNaosUpdate(() => {{").map_err(format_error)?;
            writeln!(code, "      if (!this.#flushScheduled) return;").map_err(format_error)?;
            writeln!(code, "      this.#flushScheduled = false;").map_err(format_error)?;
            writeln!(code, "      this.#flush();").map_err(format_error)?;
            writeln!(code, "    }});").map_err(format_error)?;
            writeln!(code, "  }}").map_err(format_error)?;
        }
        writeln!(code, "  #reportError(error) {{").map_err(format_error)?;
        writeln!(
            code,
            "    this.dispatchEvent(new CustomEvent(\"naos-error\", {{ detail: {{ error }}, bubbles: true, composed: true, cancelable: false }}));"
        )
        .map_err(format_error)?;
        writeln!(code, "    const reporter = globalThis.reportError;").map_err(format_error)?;
        writeln!(code, "    if (typeof reporter === \"function\") {{").map_err(format_error)?;
        writeln!(code, "      reporter.call(globalThis, error);").map_err(format_error)?;
        writeln!(code, "      return;").map_err(format_error)?;
        writeln!(code, "    }}").map_err(format_error)?;
        writeln!(code, "    setTimeout(() => {{ throw error; }}, 0);").map_err(format_error)?;
        writeln!(code, "  }}").map_err(format_error)?;
        writeln!(code, "  #markDirty(source) {{").map_err(format_error)?;
        writeln!(code, "    this.#dirtySources.add(source);").map_err(format_error)?;
        if !self.module.computed.is_empty() {
            writeln!(code, "    this.#computedCache.clear();").map_err(format_error)?;
        }
        writeln!(code, "  }}").map_err(format_error)?;
        if self.uses_keyed_selectors() {
            writeln!(
                code,
                "  #markKeyedSelectorDirty(selector, previousValue, nextValue) {{"
            )
            .map_err(format_error)?;
            writeln!(code, "    if (Object.is(previousValue, nextValue)) return;")
                .map_err(format_error)?;
            writeln!(
                code,
                "    this.#dirtySources.add(this.#keyedSelectorToken(selector, previousValue));"
            )
            .map_err(format_error)?;
            writeln!(
                code,
                "    this.#dirtySources.add(this.#keyedSelectorToken(selector, nextValue));"
            )
            .map_err(format_error)?;
            writeln!(code, "  }}").map_err(format_error)?;
            writeln!(code, "  #keyedSelectorToken(selector, key) {{").map_err(format_error)?;
            writeln!(
                code,
                "    const type = key === null ? \"null\" : typeof key;"
            )
            .map_err(format_error)?;
            writeln!(
                code,
                "    return `@naos-ui:keyed:${{selector}}:${{type}}:${{String(key)}}`;"
            )
            .map_err(format_error)?;
            writeln!(code, "  }}").map_err(format_error)?;
            writeln!(
                code,
                "  #registerKeyedBinding(selector, key, record, bindingName, update) {{"
            )
            .map_err(format_error)?;
            writeln!(
                code,
                "    const token = this.#keyedSelectorToken(selector, key);"
            )
            .map_err(format_error)?;
            writeln!(code, "    record.__naosKeyedBindings ??= new Map();")
                .map_err(format_error)?;
            writeln!(
                code,
                "    const previousToken = record.__naosKeyedBindings.get(bindingName);"
            )
            .map_err(format_error)?;
            writeln!(
                code,
                "    if (previousToken && previousToken !== token) this.#unregisterKeyedBindingToken(previousToken, record, bindingName);"
            )
            .map_err(format_error)?;
            writeln!(
                code,
                "    let recordBindings = this.#keyedBindingRegistry.get(token);"
            )
            .map_err(format_error)?;
            writeln!(code, "    if (!recordBindings) {{").map_err(format_error)?;
            writeln!(code, "      recordBindings = new Map();").map_err(format_error)?;
            writeln!(
                code,
                "      this.#keyedBindingRegistry.set(token, recordBindings);"
            )
            .map_err(format_error)?;
            writeln!(code, "    }}").map_err(format_error)?;
            writeln!(code, "    let bindings = recordBindings.get(record);")
                .map_err(format_error)?;
            writeln!(code, "    if (!bindings) {{").map_err(format_error)?;
            writeln!(code, "      bindings = new Map();").map_err(format_error)?;
            writeln!(code, "      recordBindings.set(record, bindings);").map_err(format_error)?;
            writeln!(code, "    }}").map_err(format_error)?;
            writeln!(code, "    bindings.set(bindingName, update);").map_err(format_error)?;
            writeln!(
                code,
                "    record.__naosKeyedBindings.set(bindingName, token);"
            )
            .map_err(format_error)?;
            writeln!(code, "  }}").map_err(format_error)?;
            writeln!(
                code,
                "  #unregisterKeyedBindingToken(token, record, bindingName) {{"
            )
            .map_err(format_error)?;
            writeln!(
                code,
                "    const recordBindings = this.#keyedBindingRegistry.get(token);"
            )
            .map_err(format_error)?;
            writeln!(code, "    if (!recordBindings) return;").map_err(format_error)?;
            writeln!(code, "    const bindings = recordBindings.get(record);")
                .map_err(format_error)?;
            writeln!(code, "    if (!bindings) return;").map_err(format_error)?;
            writeln!(code, "    bindings.delete(bindingName);").map_err(format_error)?;
            writeln!(
                code,
                "    if (bindings.size === 0) recordBindings.delete(record);"
            )
            .map_err(format_error)?;
            writeln!(
                code,
                "    if (recordBindings.size === 0) this.#keyedBindingRegistry.delete(token);"
            )
            .map_err(format_error)?;
            writeln!(code, "  }}").map_err(format_error)?;
            writeln!(code, "  #unregisterKeyedBindings(record) {{").map_err(format_error)?;
            writeln!(code, "    if (!record.__naosKeyedBindings) return;").map_err(format_error)?;
            writeln!(
                code,
                "    for (const [bindingName, token] of record.__naosKeyedBindings.entries()) {{"
            )
            .map_err(format_error)?;
            writeln!(
                code,
                "      this.#unregisterKeyedBindingToken(token, record, bindingName);"
            )
            .map_err(format_error)?;
            writeln!(code, "    }}").map_err(format_error)?;
            writeln!(code, "    record.__naosKeyedBindings.clear();").map_err(format_error)?;
            writeln!(code, "  }}").map_err(format_error)?;
            writeln!(code, "  #runKeyedBindings(dirtySources) {{").map_err(format_error)?;
            writeln!(code, "    if (dirtySources === null) return;").map_err(format_error)?;
            writeln!(code, "    for (const source of dirtySources) {{").map_err(format_error)?;
            writeln!(
                code,
                "      const recordBindings = this.#keyedBindingRegistry.get(source);"
            )
            .map_err(format_error)?;
            writeln!(code, "      if (!recordBindings) continue;").map_err(format_error)?;
            writeln!(
                code,
                "      for (const bindings of Array.from(recordBindings.values())) {{"
            )
            .map_err(format_error)?;
            writeln!(
                code,
                "        for (const update of Array.from(bindings.values())) update();"
            )
            .map_err(format_error)?;
            writeln!(code, "      }}").map_err(format_error)?;
            writeln!(code, "    }}").map_err(format_error)?;
            writeln!(code, "  }}").map_err(format_error)?;
        }
        if self.module.uses_host_helpers {
            writeln!(code, "  #ensureHostId() {{").map_err(format_error)?;
            writeln!(code, "    if (this.#hostId) return;").map_err(format_error)?;
            writeln!(code, "    if (this.id) {{").map_err(format_error)?;
            writeln!(code, "      this.#hostId = this.id;").map_err(format_error)?;
            writeln!(code, "      return;").map_err(format_error)?;
            writeln!(code, "    }}").map_err(format_error)?;
            writeln!(code, "    const root = this.getRootNode();").map_err(format_error)?;
            writeln!(
                code,
                "    const siblings = typeof root.querySelectorAll === \"function\" ? Array.from(root.querySelectorAll(this.localName)) : [];"
            )
            .map_err(format_error)?;
            writeln!(code, "    const index = siblings.indexOf(this);").map_err(format_error)?;
            writeln!(
                code,
                "    this.#hostId = `${{this.localName}}-${{index < 0 ? 1 : index + 1}}`;"
            )
            .map_err(format_error)?;
            writeln!(code, "  }}").map_err(format_error)?;
            writeln!(code, "  #beginHostUpdateScope() {{").map_err(format_error)?;
            writeln!(code, "    this.#updateAbortController.abort();").map_err(format_error)?;
            writeln!(
                code,
                "    this.#updateAbortController = new AbortController();"
            )
            .map_err(format_error)?;
            writeln!(code, "  }}").map_err(format_error)?;
            writeln!(code, "  #finishHostUpdateScope() {{").map_err(format_error)?;
            writeln!(
                code,
                "    const signal = this.#updateAbortController.signal;"
            )
            .map_err(format_error)?;
            writeln!(code, "    const resolvers = this.#pendingUpdateResolvers;")
                .map_err(format_error)?;
            writeln!(code, "    this.#pendingUpdateResolvers = [];").map_err(format_error)?;
            writeln!(
                code,
                "    for (const resolve of resolvers) resolve(signal);"
            )
            .map_err(format_error)?;
            writeln!(code, "    const tasks = this.#queuedHostTasks;").map_err(format_error)?;
            writeln!(code, "    this.#queuedHostTasks = [];").map_err(format_error)?;
            writeln!(code, "    for (const task of tasks) {{").map_err(format_error)?;
            writeln!(code, "      try {{").map_err(format_error)?;
            writeln!(code, "        task();").map_err(format_error)?;
            writeln!(code, "      }} catch (error) {{").map_err(format_error)?;
            writeln!(code, "        this.#reportError(error);").map_err(format_error)?;
            writeln!(code, "      }}").map_err(format_error)?;
            writeln!(code, "    }}").map_err(format_error)?;
            writeln!(code, "  }}").map_err(format_error)?;
            writeln!(code, "  #abortHostUpdateScope() {{").map_err(format_error)?;
            writeln!(code, "    this.#updateAbortController.abort();").map_err(format_error)?;
            writeln!(
                code,
                "    const signal = this.#updateAbortController.signal;"
            )
            .map_err(format_error)?;
            writeln!(code, "    const resolvers = this.#pendingUpdateResolvers;")
                .map_err(format_error)?;
            writeln!(code, "    this.#pendingUpdateResolvers = [];").map_err(format_error)?;
            writeln!(
                code,
                "    for (const resolve of resolvers) resolve(signal);"
            )
            .map_err(format_error)?;
            writeln!(code, "    this.#queuedHostTasks = [];").map_err(format_error)?;
            writeln!(
                code,
                "    this.#updateAbortController = new AbortController();"
            )
            .map_err(format_error)?;
            writeln!(code, "  }}").map_err(format_error)?;
        }
        if self.uses_event_abort_signals() {
            writeln!(code, "  #abortEventHandlers() {{").map_err(format_error)?;
            writeln!(
                code,
                "    for (const controller of Array.from(this.#eventAbortControllers)) controller.abort();"
            )
            .map_err(format_error)?;
            writeln!(code, "    this.#eventAbortControllers.clear();").map_err(format_error)?;
            writeln!(code, "  }}").map_err(format_error)?;
        }
        writeln!(code, "  #markAllDirty() {{").map_err(format_error)?;
        writeln!(code, "    this.#needsFullUpdate = true;").map_err(format_error)?;
        writeln!(code, "    this.#dirtySources.clear();").map_err(format_error)?;
        if !self.module.computed.is_empty() {
            writeln!(code, "    this.#computedCache.clear();").map_err(format_error)?;
        }
        writeln!(code, "  }}").map_err(format_error)?;
        writeln!(code, "  #flushSync() {{").map_err(format_error)?;
        if self.uses_scheduled_updates() {
            writeln!(code, "    this.#flushScheduled = false;").map_err(format_error)?;
        }
        writeln!(code, "    this.#flush();").map_err(format_error)?;
        writeln!(code, "  }}").map_err(format_error)?;
        writeln!(code, "  #flush() {{").map_err(format_error)?;
        writeln!(code, "    if (!this.#mounted) return;").map_err(format_error)?;
        writeln!(code, "    let flushError;").map_err(format_error)?;
        writeln!(code, "    let didFail = false;").map_err(format_error)?;
        if self.module.uses_host_helpers {
            writeln!(code, "    this.#beginHostUpdateScope();").map_err(format_error)?;
        }
        writeln!(code, "    try {{").map_err(format_error)?;
        writeln!(
            code,
            "      const dirtySources = this.#consumeDirtySources();"
        )
        .map_err(format_error)?;
        if !self.module.computed.is_empty() {
            writeln!(code, "      this.#computedCache.clear();").map_err(format_error)?;
        }
        writeln!(code, "      this.#update(dirtySources);").map_err(format_error)?;
        if self.uses_keyed_selectors() {
            writeln!(code, "      this.#runKeyedBindings(dirtySources);").map_err(format_error)?;
        }
        if !self.module.form_controls.is_empty() {
            writeln!(code, "      this.#syncFormValue(dirtySources);").map_err(format_error)?;
        }
        if !self.module.effects.is_empty() {
            writeln!(code, "      this.#runEffects(dirtySources);").map_err(format_error)?;
        }
        writeln!(code, "    }} catch (error) {{").map_err(format_error)?;
        writeln!(code, "      flushError = error;").map_err(format_error)?;
        writeln!(code, "      didFail = true;").map_err(format_error)?;
        writeln!(code, "      this.#markAllDirty();").map_err(format_error)?;
        if self.module.uses_host_helpers {
            writeln!(code, "    }} finally {{").map_err(format_error)?;
            writeln!(code, "      this.#finishHostUpdateScope();").map_err(format_error)?;
        }
        writeln!(code, "    }}").map_err(format_error)?;
        writeln!(code, "    if (didFail) this.#reportError(flushError);").map_err(format_error)?;
        writeln!(code, "  }}").map_err(format_error)?;
        writeln!(code, "  #consumeDirtySources() {{").map_err(format_error)?;
        writeln!(code, "    if (this.#needsFullUpdate) {{").map_err(format_error)?;
        writeln!(code, "      this.#needsFullUpdate = false;").map_err(format_error)?;
        writeln!(code, "      this.#dirtySources.clear();").map_err(format_error)?;
        writeln!(code, "      return null;").map_err(format_error)?;
        writeln!(code, "    }}").map_err(format_error)?;
        writeln!(code, "    const dirtySources = this.#dirtySources;").map_err(format_error)?;
        writeln!(code, "    this.#dirtySources = new Set();").map_err(format_error)?;
        writeln!(code, "    return dirtySources;").map_err(format_error)?;
        writeln!(code, "  }}").map_err(format_error)?;
        writeln!(code, "  #shouldUpdate(dependencies, dirtySources) {{").map_err(format_error)?;
        writeln!(
            code,
            "    if (dirtySources === null || dependencies === null) return true;"
        )
        .map_err(format_error)?;
        writeln!(code, "    for (const source of dependencies) {{").map_err(format_error)?;
        writeln!(code, "      if (dirtySources.has(source)) return true;").map_err(format_error)?;
        writeln!(code, "    }}").map_err(format_error)?;
        writeln!(code, "    return false;").map_err(format_error)?;
        writeln!(code, "  }}").map_err(format_error)?;
        Ok(())
    }

    fn emit_spread_helpers(&self, code: &mut String) -> CompilerResult<()> {
        if !self.uses_spread_attributes {
            return Ok(());
        }
        writeln!(code, "  #applySpreadAttributes(target, cache, values) {{")
            .map_err(format_error)?;
        writeln!(code, "    const next = values ?? {{}};").map_err(format_error)?;
        writeln!(code, "    const seen = new Set();").map_err(format_error)?;
        writeln!(
            code,
            "    for (const [name, value] of Object.entries(next)) {{"
        )
        .map_err(format_error)?;
        writeln!(code, "      seen.add(name);").map_err(format_error)?;
        writeln!(
            code,
            "      this.#applySpreadValue(target, cache, name, value);"
        )
        .map_err(format_error)?;
        writeln!(code, "    }}").map_err(format_error)?;
        writeln!(code, "    for (const name of Array.from(cache.names)) {{")
            .map_err(format_error)?;
        writeln!(
            code,
            "      if (!seen.has(name)) this.#removeSpreadValue(target, cache, name);"
        )
        .map_err(format_error)?;
        writeln!(code, "    }}").map_err(format_error)?;
        writeln!(code, "    cache.names = seen;").map_err(format_error)?;
        writeln!(code, "  }}").map_err(format_error)?;
        writeln!(code, "  #applySpreadValue(target, cache, name, value) {{")
            .map_err(format_error)?;
        writeln!(
            code,
            "    const eventName = this.#eventNameFromSpreadKey(name);"
        )
        .map_err(format_error)?;
        writeln!(code, "    if (eventName) {{").map_err(format_error)?;
        writeln!(code, "      const previous = cache.listeners.get(name);")
            .map_err(format_error)?;
        writeln!(
            code,
            "      if (previous) target.removeEventListener(eventName, previous);"
        )
        .map_err(format_error)?;
        writeln!(code, "      if (typeof value === \"function\") {{").map_err(format_error)?;
        writeln!(code, "        target.addEventListener(eventName, value);")
            .map_err(format_error)?;
        writeln!(code, "        cache.listeners.set(name, value);").map_err(format_error)?;
        writeln!(code, "      }} else {{").map_err(format_error)?;
        writeln!(code, "        cache.listeners.delete(name);").map_err(format_error)?;
        writeln!(code, "      }}").map_err(format_error)?;
        writeln!(code, "      return;").map_err(format_error)?;
        writeln!(code, "    }}").map_err(format_error)?;
        writeln!(
            code,
            "    if (name === \"style\" && value && typeof value === \"object\") {{"
        )
        .map_err(format_error)?;
        writeln!(code, "      this.#applySpreadStyles(target, cache, value);")
            .map_err(format_error)?;
        writeln!(code, "      return;").map_err(format_error)?;
        writeln!(code, "    }}").map_err(format_error)?;
        writeln!(
            code,
            "    const attributeName = this.#attributeNameFromSpreadKey(name);"
        )
        .map_err(format_error)?;
        writeln!(
            code,
            "    if (value == null || (value === false && !attributeName.startsWith(\"aria-\"))) {{"
        )
        .map_err(format_error)?;
        writeln!(code, "      target.removeAttribute(attributeName);").map_err(format_error)?;
        writeln!(code, "    }} else {{").map_err(format_error)?;
        writeln!(
            code,
            "      const attributeValue = attributeName.startsWith(\"aria-\") ? String(value) : value === true ? \"\" : String(value);"
        )
        .map_err(format_error)?;
        writeln!(
            code,
            "      target.setAttribute(attributeName, attributeValue);"
        )
        .map_err(format_error)?;
        writeln!(code, "    }}").map_err(format_error)?;
        writeln!(code, "    if (name in target && !attributeName.startsWith(\"aria-\") && !attributeName.startsWith(\"data-\")) {{")
            .map_err(format_error)?;
        writeln!(
            code,
            "      try {{ target[name] = value == null ? \"\" : value; }} catch {{}}"
        )
        .map_err(format_error)?;
        writeln!(code, "    }}").map_err(format_error)?;
        writeln!(code, "  }}").map_err(format_error)?;
        writeln!(code, "  #removeSpreadValue(target, cache, name) {{").map_err(format_error)?;
        writeln!(
            code,
            "    const eventName = this.#eventNameFromSpreadKey(name);"
        )
        .map_err(format_error)?;
        writeln!(code, "    if (eventName) {{").map_err(format_error)?;
        writeln!(code, "      const previous = cache.listeners.get(name);")
            .map_err(format_error)?;
        writeln!(
            code,
            "      if (previous) target.removeEventListener(eventName, previous);"
        )
        .map_err(format_error)?;
        writeln!(code, "      cache.listeners.delete(name);").map_err(format_error)?;
        writeln!(code, "      return;").map_err(format_error)?;
        writeln!(code, "    }}").map_err(format_error)?;
        writeln!(code, "    if (name === \"style\") {{").map_err(format_error)?;
        writeln!(
            code,
            "      for (const property of cache.styles) target.style[property] = \"\";"
        )
        .map_err(format_error)?;
        writeln!(code, "      cache.styles.clear();").map_err(format_error)?;
        writeln!(code, "      return;").map_err(format_error)?;
        writeln!(code, "    }}").map_err(format_error)?;
        writeln!(
            code,
            "    const attributeName = this.#attributeNameFromSpreadKey(name);"
        )
        .map_err(format_error)?;
        writeln!(code, "    target.removeAttribute(attributeName);").map_err(format_error)?;
        writeln!(code, "    if (name in target && !attributeName.startsWith(\"aria-\") && !attributeName.startsWith(\"data-\")) {{")
            .map_err(format_error)?;
        writeln!(code, "      try {{ target[name] = false; }} catch {{}}").map_err(format_error)?;
        writeln!(code, "    }}").map_err(format_error)?;
        writeln!(code, "  }}").map_err(format_error)?;
        writeln!(code, "  #applySpreadStyles(target, cache, styles) {{").map_err(format_error)?;
        writeln!(code, "    const seen = new Set();").map_err(format_error)?;
        writeln!(
            code,
            "    for (const [property, value] of Object.entries(styles)) {{"
        )
        .map_err(format_error)?;
        writeln!(code, "      seen.add(property);").map_err(format_error)?;
        writeln!(
            code,
            "      target.style[property] = value == null ? \"\" : String(value);"
        )
        .map_err(format_error)?;
        writeln!(code, "    }}").map_err(format_error)?;
        writeln!(
            code,
            "    for (const property of Array.from(cache.styles)) {{"
        )
        .map_err(format_error)?;
        writeln!(
            code,
            "      if (!seen.has(property)) target.style[property] = \"\";"
        )
        .map_err(format_error)?;
        writeln!(code, "    }}").map_err(format_error)?;
        writeln!(code, "    cache.styles = seen;").map_err(format_error)?;
        writeln!(code, "  }}").map_err(format_error)?;
        writeln!(code, "  #attributeNameFromSpreadKey(name) {{").map_err(format_error)?;
        writeln!(code, "    if (name === \"className\") return \"class\";")
            .map_err(format_error)?;
        writeln!(code, "    if (name === \"htmlFor\") return \"for\";").map_err(format_error)?;
        writeln!(code, "    return name;").map_err(format_error)?;
        writeln!(code, "  }}").map_err(format_error)?;
        writeln!(code, "  #eventNameFromSpreadKey(name) {{").map_err(format_error)?;
        writeln!(code, "    if (!/^on[A-Z]/.test(name)) return null;").map_err(format_error)?;
        writeln!(code, "    const eventName = name.slice(2).replace(/([A-Z])/g, \"-$1\").replace(/^-/, \"\").toLowerCase();")
            .map_err(format_error)?;
        writeln!(code, "    return {{ \"before-input\": \"beforeinput\", \"context-menu\": \"contextmenu\", \"key-down\": \"keydown\", \"key-up\": \"keyup\", \"pointer-cancel\": \"pointercancel\", \"pointer-down\": \"pointerdown\", \"pointer-enter\": \"pointerenter\", \"pointer-leave\": \"pointerleave\", \"pointer-move\": \"pointermove\", \"pointer-out\": \"pointerout\", \"pointer-over\": \"pointerover\", \"pointer-up\": \"pointerup\", \"focus-in\": \"focusin\", \"focus-out\": \"focusout\" }}[eventName] ?? eventName;")
            .map_err(format_error)?;
        writeln!(code, "  }}").map_err(format_error)?;
        Ok(())
    }

    fn emit_update(&self, code: &mut String) -> CompilerResult<()> {
        writeln!(code, "  #update(dirtySources) {{").map_err(format_error)?;
        writeln!(code, "    if (!this.#mounted) return;").map_err(format_error)?;
        let names = self.binding_names().join(", ");
        if !names.is_empty() {
            writeln!(code, "    const {{ {names} }} = this.#createBindings();")
                .map_err(format_error)?;
        }
        for step in &self.update_steps {
            writeln!(
                code,
                "    if (this.#shouldUpdate({}, dirtySources)) {{",
                dependencies_argument(&step.dependencies)
            )
            .map_err(format_error)?;
            for line in &step.lines {
                writeln!(code, "      {line}").map_err(format_error)?;
            }
            writeln!(code, "    }}").map_err(format_error)?;
        }
        writeln!(code, "  }}").map_err(format_error)?;
        Ok(())
    }

    fn emit_exports(&self, code: &mut String) -> CompilerResult<()> {
        let package_version = self.module.package.version.as_ref().map_or_else(
            || "null".to_owned(),
            |version| format!("\"{}\"", escape_js_string(version)),
        );
        writeln!(
            code,
            "const __naosMetadataKey = Symbol.for(\"naos.component.metadata\");"
        )
        .map_err(format_error)?;
        writeln!(
            code,
            "const __naosComponentMetadata = Object.freeze({{ packageName: \"{}\", packageVersion: {}, tagName: \"{}\" }});",
            escape_js_string(&self.module.package.name),
            package_version,
            escape_js_string(&self.module.tag_name)
        )
        .map_err(format_error)?;
        writeln!(
            code,
            "Object.defineProperty({}, __naosMetadataKey, {{ value: __naosComponentMetadata }});",
            self.module.class_name
        )
        .map_err(format_error)?;
        writeln!(code, "let __naosRegistrationWarningEmitted = false;").map_err(format_error)?;
        writeln!(code, "function __naosDefineComponent() {{").map_err(format_error)?;
        writeln!(
            code,
            "  const registered = customElements.get(\"{}\");",
            self.module.tag_name
        )
        .map_err(format_error)?;
        writeln!(code, "  if (!registered) {{").map_err(format_error)?;
        writeln!(
            code,
            "    customElements.define(\"{}\", {});",
            self.module.tag_name, self.module.class_name
        )
        .map_err(format_error)?;
        writeln!(code, "    return;").map_err(format_error)?;
        writeln!(code, "  }}").map_err(format_error)?;
        writeln!(
            code,
            "  if (registered === {}) return;",
            self.module.class_name
        )
        .map_err(format_error)?;
        writeln!(code, "  const metadata = registered[__naosMetadataKey];")
            .map_err(format_error)?;
        writeln!(
            code,
            "  if (metadata?.packageName === __naosComponentMetadata.packageName && metadata?.packageVersion === __naosComponentMetadata.packageVersion) return;"
        )
        .map_err(format_error)?;
        writeln!(code, "  if (__naosRegistrationWarningEmitted) return;").map_err(format_error)?;
        writeln!(code, "  __naosRegistrationWarningEmitted = true;").map_err(format_error)?;
        writeln!(
            code,
            "  const registeredOwner = metadata?.packageName && metadata?.packageVersion ? `${{metadata.packageName}}@${{metadata.packageVersion}}` : \"unknown\";"
        )
        .map_err(format_error)?;
        writeln!(
            code,
            "  const attemptedOwner = __naosComponentMetadata.packageVersion ? `${{__naosComponentMetadata.packageName}}@${{__naosComponentMetadata.packageVersion}}` : `${{__naosComponentMetadata.packageName}}@unknown`;"
        )
        .map_err(format_error)?;
        writeln!(
            code,
            "  console.warn(`naos-ui: <${{__naosComponentMetadata.tagName}}> is already registered by ${{registeredOwner}} (attempted: ${{attemptedOwner}}). Running two versions of the same package on one page is not supported; the first registration wins.`);"
        )
        .map_err(format_error)?;
        writeln!(code, "}}").map_err(format_error)?;
        if self.module.options.define {
            writeln!(code, "__naosDefineComponent();").map_err(format_error)?;
        } else {
            writeln!(code, "export function {}() {{", self.define_function_name())
                .map_err(format_error)?;
            writeln!(code, "  __naosDefineComponent();").map_err(format_error)?;
            writeln!(code, "}}").map_err(format_error)?;
        }
        if let Some(export_name) = &self.module.export_name {
            writeln!(
                code,
                "export {{ {} as {} }};",
                self.module.class_name, export_name
            )
            .map_err(format_error)?;
        } else {
            writeln!(code, "export {{ {} }};", self.module.class_name).map_err(format_error)?;
        }
        writeln!(code, "export default {};", self.module.class_name).map_err(format_error)?;
        Ok(())
    }

    fn define_function_name(&self) -> String {
        self.module
            .export_name
            .as_ref()
            .map(|export_name| format!("define{export_name}"))
            .unwrap_or_else(|| format!("define{}", self.module.class_name))
    }

    fn emit_element(&mut self, element: &TemplateElement) -> CompilerResult<String> {
        if element.tag_name == "Show" {
            return self.emit_show_control(element);
        }
        if element.tag_name == "Switch" {
            return self.emit_switch_control(element);
        }
        if element.tag_name == "Match" {
            return Err(unsupported_with_code_at(
                DIAGNOSTIC_CODE_UNSUPPORTED_SWITCH_MATCH,
                "<Match> can only be used as a direct child of <Switch>.",
                DIAGNOSTIC_HINT_SWITCH,
                element.span,
            ));
        }
        if element.tag_name == "For" {
            return self.emit_for_control(element);
        }
        if element.tag_name == "Index" {
            return self.emit_index_control(element);
        }

        let index = self.next_node_index;
        self.next_node_index += 1;
        let variable = format!("node{index}");
        let field = format!("node{index}");
        let tag_name = self.element_tag_name(&element.tag_name)?;
        let is_component_element = is_pascal_case_identifier(&element.tag_name);
        self.node_fields.push(field.clone());
        self.mount_lines.push(format!(
            "const {variable} = document.createElement(\"{}\");",
            escape_js_string(&tag_name)
        ));
        self.mount_lines
            .push(format!("this.#{field} = {variable};"));

        let field_reference = format!("this.#{field}");
        let mut follows_spread = false;
        for attribute in &element.attributes {
            self.emit_attribute(
                &variable,
                &field_reference,
                &field,
                attribute,
                is_component_element,
                follows_spread,
                element.span,
            )?;
            if matches!(attribute, TemplateAttribute::Spread { .. }) {
                follows_spread = true;
            }
        }

        for child in &element.children {
            self.emit_child(&variable, child, element.span)?;
        }

        Ok(variable)
    }

    fn emit_child(
        &mut self,
        parent_variable: &str,
        child: &TemplateChild,
        parent_span: Option<DiagnosticSpan>,
    ) -> CompilerResult<()> {
        match child {
            TemplateChild::Element(child_element) => {
                let child_variable = self.emit_element(child_element)?;
                self.mount_lines
                    .push(format!("{parent_variable}.append({child_variable});"));
            }
            TemplateChild::List(renderer) => {
                let child_variable = self.emit_list_control(renderer)?;
                self.mount_lines
                    .push(format!("{parent_variable}.append({child_variable});"));
            }
            TemplateChild::Expression(expression) => {
                self.emit_expression(parent_variable, expression, parent_span)?;
            }
            TemplateChild::Text(text) => {
                self.emit_text(parent_variable, text);
            }
        }
        Ok(())
    }

    fn emit_show_control(&mut self, element: &TemplateElement) -> CompilerResult<String> {
        let when = required_expression_attribute(element, "when")?.to_owned();
        let index = self.next_node_index;
        self.next_node_index += 1;
        let variable = format!("node{index}");
        let field = format!("node{index}");
        let content_variable = format!("{variable}Content");
        let content_field = format!("{field}Content");
        let fallback_variable = format!("{variable}Fallback");
        let fallback_field = format!("{field}Fallback");

        self.node_fields.push(field.clone());
        self.node_fields.push(content_field.clone());
        self.node_fields.push(fallback_field.clone());
        self.mount_lines.push(format!(
            "const {variable} = document.createElement(\"span\");"
        ));
        self.mount_lines
            .push(format!("{variable}.style.display = \"contents\";"));
        self.mount_lines.push(format!(
            "{variable}.setAttribute(\"data-naos-control\", \"show\");"
        ));
        self.mount_lines
            .push(format!("this.#{field} = {variable};"));
        self.mount_lines.push(format!(
            "const {content_variable} = document.createElement(\"span\");"
        ));
        self.mount_lines
            .push(format!("{content_variable}.style.display = \"contents\";"));
        self.mount_lines
            .push(format!("this.#{content_field} = {content_variable};"));
        self.mount_lines.push(format!(
            "const {fallback_variable} = document.createElement(\"span\");"
        ));
        self.mount_lines
            .push(format!("{fallback_variable}.style.display = \"contents\";"));
        self.mount_lines
            .push(format!("this.#{fallback_field} = {fallback_variable};"));
        self.mount_lines.push(format!(
            "{variable}.append({content_variable}, {fallback_variable});"
        ));

        for child in &element.children {
            self.emit_child(&content_variable, child, element.span)?;
        }
        if let Some(fallback) = optional_attribute(element, "fallback") {
            self.emit_show_fallback(&fallback_variable, fallback, element.span)?;
        }

        let condition_variable = format!("{field}When");
        self.push_update_lines(
            vec![
                format!("const {condition_variable} = Boolean({when});"),
                format!(
                    "this.#{content_field}.hidden = !{condition_variable}; this.#{fallback_field}.hidden = {condition_variable};"
                ),
            ],
            self.dependencies_for_expression(&when),
        );

        Ok(variable)
    }

    fn emit_show_fallback(
        &mut self,
        fallback_variable: &str,
        attribute: &TemplateAttribute,
        span: Option<DiagnosticSpan>,
    ) -> CompilerResult<()> {
        let TemplateAttribute::Named { value, .. } = attribute else {
            return Err(unsupported_at(
                "Show fallback does not support JSX spread attributes.",
                span,
            ));
        };
        match value {
            AttributeValue::Expression(expression) => {
                let trimmed = expression.trim();
                self.emit_expression(fallback_variable, trimmed, span)?;
            }
            AttributeValue::Element(fallback) => {
                let fallback_child = self.emit_element(fallback)?;
                self.mount_lines
                    .push(format!("{fallback_variable}.append({fallback_child});"));
            }
            AttributeValue::Static(value) => {
                self.emit_text(fallback_variable, value);
            }
            AttributeValue::Boolean => {
                return Err(unsupported_with_code_at(
                    DIAGNOSTIC_CODE_UNSUPPORTED_SHOW_FALLBACK,
                    "Show fallback must have a value.",
                    DIAGNOSTIC_HINT_SHOW,
                    span,
                ));
            }
            AttributeValue::EventHandler(_) => {
                return Err(unsupported_at(
                    "Show fallback cannot be an event handler.",
                    span,
                ));
            }
        }
        Ok(())
    }

    fn emit_switch_control(&mut self, element: &TemplateElement) -> CompilerResult<String> {
        let matches = parse_switch_matches(element)?;
        let index = self.next_node_index;
        self.next_node_index += 1;
        let variable = format!("node{index}");
        let field = format!("node{index}");

        self.node_fields.push(field.clone());
        self.mount_lines.push(format!(
            "const {variable} = document.createElement(\"span\");"
        ));
        self.mount_lines
            .push(format!("{variable}.style.display = \"contents\";"));
        self.mount_lines.push(format!(
            "{variable}.setAttribute(\"data-naos-control\", \"switch\");"
        ));
        self.mount_lines
            .push(format!("this.#{field} = {variable};"));

        let mut branch_fields = Vec::new();
        for (match_index, switch_match) in matches.iter().enumerate() {
            let branch_variable = format!("{variable}Match{match_index}");
            let branch_field = format!("{field}Match{match_index}");
            self.node_fields.push(branch_field.clone());
            self.mount_lines.push(format!(
                "const {branch_variable} = document.createElement(\"span\");"
            ));
            self.mount_lines
                .push(format!("{branch_variable}.style.display = \"contents\";"));
            self.mount_lines
                .push(format!("this.#{branch_field} = {branch_variable};"));
            self.mount_lines
                .push(format!("{variable}.append({branch_variable});"));
            for child in &switch_match.children {
                self.emit_child(&branch_variable, child, element.span)?;
            }
            branch_fields.push(branch_field);
        }

        let matched_variable = format!("{field}Matched");
        let mut update_lines = vec![format!("let {matched_variable} = false;")];
        let mut dependencies = BTreeSet::new();
        let mut has_unknown_dependencies = false;
        for (match_index, switch_match) in matches.iter().enumerate() {
            let branch_field = &branch_fields[match_index];
            if let Some(when) = &switch_match.when {
                let condition_variable = format!("{field}Match{match_index}When");
                update_lines.push(format!("const {condition_variable} = Boolean({when});"));
                update_lines.push(format!(
                    "this.#{branch_field}.hidden = {matched_variable} || !{condition_variable};"
                ));
                update_lines.push(format!(
                    "{matched_variable} = {matched_variable} || {condition_variable};"
                ));
                match self.dependencies_for_expression(when) {
                    ReactiveDependencies::Known(sources) => {
                        dependencies.extend(sources);
                    }
                    ReactiveDependencies::Unknown => {
                        has_unknown_dependencies = true;
                    }
                }
            } else {
                update_lines.push(format!("this.#{branch_field}.hidden = {matched_variable};"));
                update_lines.push(format!("{matched_variable} = true;"));
            }
        }

        let dependencies = if has_unknown_dependencies {
            ReactiveDependencies::Unknown
        } else {
            ReactiveDependencies::Known(dependencies)
        };
        self.push_update_lines(update_lines, dependencies);

        Ok(variable)
    }

    fn emit_for_control(&mut self, element: &TemplateElement) -> CompilerResult<String> {
        let renderer = parse_for_renderer(element)?;
        self.emit_list_control(renderer)
    }

    fn emit_index_control(&mut self, element: &TemplateElement) -> CompilerResult<String> {
        let renderer = parse_index_renderer(element)?;
        self.emit_list_control(renderer)
    }

    fn emit_list_control(&mut self, renderer: &ListRenderer) -> CompilerResult<String> {
        let index = self.next_node_index;
        self.next_node_index += 1;
        let variable = format!("node{index}");
        let field = format!("node{index}");
        let records_field = format!("{field}Records");
        let items_variable = format!("{field}Items");
        let next_records_variable = format!("{field}NextRecords");
        let nodes_variable = format!("{field}Nodes");
        let loop_index_variable = format!("{field}Index");
        let record_variable = format!("{field}Record");
        let cursor_variable = format!("{field}Cursor");
        let ordered_node_variable = format!("{field}OrderedNode");
        let next_sibling_variable = format!("{field}NextSibling");
        let retained_records_variable = format!("{field}RetainedRecords");
        let stale_record_variable = format!("{field}StaleRecord");
        let flip_rects_variable = format!("{field}FlipRects");
        let flip_record_variable = format!("{field}FlipRecord");
        let render_prefix = format!("for{index}");
        let row_template =
            self.emit_list_row_template(&renderer.template, &render_prefix, &record_variable)?;
        let uses_flip = matches!(renderer.motion, Some(TemplateListMotion::Flip));
        if uses_flip {
            self.uses_motion_flip = true;
        }

        self.node_fields.push(field.clone());
        self.list_record_fields.push(records_field.clone());
        self.mount_lines.push(format!(
            "const {variable} = document.createElement(\"span\");"
        ));
        self.mount_lines
            .push(format!("{variable}.style.display = \"contents\";"));
        self.mount_lines.push(format!(
            "{variable}.setAttribute(\"data-naos-control\", \"for\");"
        ));
        self.mount_lines
            .push(format!("this.#{field} = {variable};"));

        let mut update_lines = vec![format!(
            "const {items_variable} = Array.from(({}) ?? []);",
            renderer.each_expression
        )];
        if uses_flip {
            update_lines.push(format!("const {flip_rects_variable} = new Map();"));
            update_lines.push(format!(
                "for (const {flip_record_variable} of this.#{records_field}.values()) {{"
            ));
            update_lines.push(format!(
                "  {flip_rects_variable}.set({flip_record_variable}.node, {flip_record_variable}.node.getBoundingClientRect());"
            ));
            update_lines.push("}".to_owned());
        }
        update_lines.extend([
            format!("const {next_records_variable} = new Map();"),
            format!("const {nodes_variable} = [];"),
            format!(
                "for (let {loop_index_variable} = 0; {loop_index_variable} < {items_variable}.length; {loop_index_variable} += 1) {{"
            ),
            format!("  const {} = {loop_index_variable};", renderer.index_name),
        ]);
        match &renderer.kind {
            TemplateListKind::ItemKeyed { key } => {
                let key_expression = list_key_expression(key);
                update_lines.push(format!(
                    "  const {} = {items_variable}[{loop_index_variable}];",
                    renderer.item_name
                ));
                update_lines.push(format!("  const {render_prefix}Key = {key_expression};"));
            }
            TemplateListKind::IndexKeyed => {
                update_lines.push(format!(
                    "  const {render_prefix}Key = {loop_index_variable};"
                ));
            }
        }
        update_lines.extend([
            format!("  let {record_variable} = this.#{records_field}.get({render_prefix}Key);"),
            format!("  if (!{record_variable}) {{"),
        ]);
        for line in &row_template.create_lines {
            update_lines.push(format!("    {line}"));
        }
        update_lines.push(format!(
            "    {record_variable} = {{ {} }};",
            row_template.record_properties.join(", ")
        ));
        update_lines.push("  }".to_owned());
        match &renderer.kind {
            TemplateListKind::ItemKeyed { .. } => {
                update_lines.push(format!(
                    "  {record_variable}.value = {};",
                    renderer.item_name
                ));
            }
            TemplateListKind::IndexKeyed => {
                update_lines.push(format!(
                    "  {record_variable}.value = {items_variable}[{loop_index_variable}];"
                ));
                update_lines.push(format!(
                    "  const {} = () => {record_variable}.value;",
                    renderer.item_name
                ));
            }
        }
        update_lines.push(format!(
            "  {record_variable}.index = {loop_index_variable};"
        ));
        let mut binding_index = 0usize;
        for update_line in &row_template.update_lines {
            if let Some(keyed_selector) = &update_line.keyed_selector {
                let binding_name = format!("{render_prefix}Binding{binding_index}");
                binding_index += 1;
                update_lines.push(format!("  {record_variable}.{binding_name} = () => {{"));
                for line in list_row_binding_scope_lines(renderer, &record_variable) {
                    update_lines.push(format!("    {line}"));
                }
                update_lines.push(format!("    {}", update_line.line));
                update_lines.push("  };".to_owned());
                update_lines.push(format!("  {record_variable}.{binding_name}();"));
                update_lines.push(format!(
                    "  this.#registerKeyedBinding(\"{}\", {}, {record_variable}, \"{}\", {record_variable}.{binding_name});",
                    escape_js_string(&keyed_selector.selector_name),
                    keyed_selector.key_expression,
                    escape_js_string(&binding_name)
                ));
            } else {
                update_lines.push(format!("  {}", update_line.line));
            }
        }
        update_lines.push(format!(
            "  {next_records_variable}.set({render_prefix}Key, {record_variable});"
        ));
        update_lines.push(format!("  {nodes_variable}.push({record_variable}.node);"));
        update_lines.push("}".to_owned());
        if self.uses_keyed_selectors() || row_template.uses_event_abort_signals {
            update_lines.push(format!(
                "const {retained_records_variable} = new Set({next_records_variable}.values());"
            ));
            update_lines.push(format!(
                "for (const {stale_record_variable} of this.#{records_field}.values()) {{"
            ));
            update_lines.push(format!(
                "  if (!{retained_records_variable}.has({stale_record_variable})) {{"
            ));
            if self.uses_keyed_selectors() {
                update_lines.push(format!(
                    "    this.#unregisterKeyedBindings({stale_record_variable});"
                ));
            }
            if row_template.uses_event_abort_signals {
                update_lines.push(format!(
                    "    for (const controller of Array.from({stale_record_variable}.__naosEventAbortControllers)) controller.abort();"
                ));
                update_lines.push(format!(
                    "    {stale_record_variable}.__naosEventAbortControllers.clear();"
                ));
            }
            update_lines.push("  }".to_owned());
            update_lines.push("}".to_owned());
        }
        update_lines.push(format!("this.#{records_field} = {next_records_variable};"));
        update_lines.push(format!("let {cursor_variable} = this.#{field}.firstChild;"));
        update_lines.push(format!(
            "for (const {ordered_node_variable} of {nodes_variable}) {{"
        ));
        update_lines.push(format!(
            "  if ({cursor_variable} === {ordered_node_variable}) {{"
        ));
        update_lines.push(format!(
            "    {cursor_variable} = {cursor_variable}.nextSibling;"
        ));
        update_lines.push("  } else {".to_owned());
        update_lines.push(format!(
            "    this.#{field}.insertBefore({ordered_node_variable}, {cursor_variable});"
        ));
        update_lines.push("  }".to_owned());
        update_lines.push("}".to_owned());
        update_lines.push(format!("while ({cursor_variable}) {{"));
        update_lines.push(format!(
            "  const {next_sibling_variable} = {cursor_variable}.nextSibling;"
        ));
        update_lines.push(format!("  this.#{field}.removeChild({cursor_variable});"));
        update_lines.push(format!("  {cursor_variable} = {next_sibling_variable};"));
        update_lines.push("}".to_owned());
        if uses_flip {
            update_lines.push(format!("__naosFlipMovedElements({flip_rects_variable});"));
        }
        self.push_update_lines(update_lines, self.dependencies_for_list_renderer(renderer));

        Ok(variable)
    }

    fn emit_list_row_template(
        &mut self,
        element: &TemplateElement,
        prefix: &str,
        record_variable: &str,
    ) -> CompilerResult<ListRowTemplate> {
        let mut build = ListRowBuild {
            prefix: prefix.to_owned(),
            record_variable: record_variable.to_owned(),
            next_index: 0,
            create_lines: Vec::new(),
            record_properties: Vec::new(),
            update_lines: Vec::new(),
            uses_event_abort_signals: false,
        };
        let root_variable = self.emit_list_row_element(element, &mut build)?;
        build
            .record_properties
            .insert(0, format!("node: {root_variable}"));
        if build.uses_event_abort_signals {
            build
                .record_properties
                .push("__naosEventAbortControllers: new Set()".to_owned());
        }
        Ok(ListRowTemplate {
            create_lines: build.create_lines,
            record_properties: build.record_properties,
            update_lines: build.update_lines,
            uses_event_abort_signals: build.uses_event_abort_signals,
        })
    }

    fn push_list_row_update_line(&self, build: &mut ListRowBuild, expression: &str, line: String) {
        build.update_lines.push(ListRowUpdateLine {
            line,
            keyed_selector: keyed_selector_use_for_expression(
                expression,
                &self.module.keyed_selectors,
            ),
        });
    }

    fn emit_list_row_element(
        &mut self,
        element: &TemplateElement,
        build: &mut ListRowBuild,
    ) -> CompilerResult<String> {
        let index = build.next_index;
        build.next_index += 1;
        let variable = format!("{}Node{index}", build.prefix);
        let tag_name = self.element_tag_name(&element.tag_name)?;
        let is_component_element = is_pascal_case_identifier(&element.tag_name);
        build.create_lines.push(format!(
            "const {variable} = document.createElement(\"{}\");",
            escape_js_string(&tag_name)
        ));
        build.record_properties.push(variable.clone());

        let mut follows_spread = false;
        for attribute in &element.attributes {
            self.emit_list_row_attribute(
                &variable,
                attribute,
                is_component_element,
                follows_spread,
                build,
                element.span,
            )?;
            if matches!(attribute, TemplateAttribute::Spread { .. }) {
                follows_spread = true;
            }
        }

        for child in &element.children {
            match child {
                TemplateChild::Element(child_element) => {
                    let child_variable = self.emit_list_row_element(child_element, build)?;
                    build
                        .create_lines
                        .push(format!("{variable}.append({child_variable});"));
                }
                TemplateChild::List(_) => {
                    return Err(unsupported_with_code_at(
                        DIAGNOSTIC_CODE_UNSUPPORTED_LIST_RENDERER,
                        "Nested dynamic lists are not supported in list row templates.",
                        DIAGNOSTIC_HINT_LISTS,
                        element.span,
                    ));
                }
                TemplateChild::Expression(expression) => {
                    let text_variable = format!("{}Text{}", build.prefix, build.next_index);
                    build.next_index += 1;
                    build.create_lines.push(format!(
                        "const {text_variable} = document.createTextNode(\"\");"
                    ));
                    build
                        .create_lines
                        .push(format!("{variable}.append({text_variable});"));
                    build.record_properties.push(text_variable.clone());
                    self.push_list_row_update_line(
                        build,
                        expression,
                        format!(
                            "{}.{text_variable}.data = String({});",
                            build.record_variable,
                            expression.trim()
                        ),
                    );
                }
                TemplateChild::Text(text) => {
                    if let Some(expression) = text_expression(text) {
                        let text_variable = format!("{}Text{}", build.prefix, build.next_index);
                        build.next_index += 1;
                        build.create_lines.push(format!(
                            "const {text_variable} = document.createTextNode(\"\");"
                        ));
                        build
                            .create_lines
                            .push(format!("{variable}.append({text_variable});"));
                        build.record_properties.push(text_variable.clone());
                        self.push_list_row_update_line(
                            build,
                            &expression,
                            format!(
                                "{}.{text_variable}.data = {expression};",
                                build.record_variable
                            ),
                        );
                    }
                }
            }
        }

        Ok(variable)
    }

    fn emit_list_row_attribute(
        &mut self,
        variable: &str,
        attribute: &TemplateAttribute,
        is_component_element: bool,
        follows_spread: bool,
        build: &mut ListRowBuild,
        span: Option<DiagnosticSpan>,
    ) -> CompilerResult<()> {
        let (name, value) = match attribute {
            TemplateAttribute::Named { name, value } => (name, value),
            TemplateAttribute::Spread { expression } => {
                if is_component_element {
                    return Err(unsupported_at(
                        "JSX spread attributes are supported only on native elements.",
                        span,
                    ));
                }
                self.uses_spread_attributes = true;
                let spread_cache = format!("{variable}Spread{}", build.record_properties.len());
                build.create_lines.push(format!(
                    "const {spread_cache} = {{ names: new Set(), listeners: new Map(), styles: new Set() }};"
                ));
                build.record_properties.push(spread_cache.clone());
                build.update_lines.push(ListRowUpdateLine::plain(format!(
                    "this.#applySpreadAttributes({}.{variable}, {}.{spread_cache}, {expression});",
                    build.record_variable, build.record_variable
                )));
                return Ok(());
            }
        };
        if name == "key" {
            return Ok(());
        }
        if name == "ref" {
            return Err(unsupported_at(
                "JSX `ref` is not currently supported inside dynamic list row templates.",
                span,
            ));
        }
        if let Some(event_name) = event_name_from_attribute(name) {
            let AttributeValue::EventHandler(event_handler) = value else {
                return Err(unsupported_at(
                    format!(
                        "Event attribute `{}` must use a braced handler expression.",
                        name
                    ),
                    span,
                ));
            };
            let listener_property = format!("{variable}Listener{}", event_name.replace('-', "_"));
            let listener_abort_property = format!("{listener_property}Abort");
            let listener_options_property = format!("{listener_property}Options");
            build.uses_event_abort_signals = true;
            build
                .record_properties
                .push(format!("{listener_property}: null"));
            build
                .record_properties
                .push(format!("{listener_abort_property}: null"));
            build
                .record_properties
                .push(format!("{listener_options_property}: null"));
            build.update_lines.push(ListRowUpdateLine::plain(format!(
                "if ({}.{listener_property}) {{ {}.{variable}.removeEventListener(\"{event_name}\", {}.{listener_property}, {}.{listener_options_property}?.capture ?? false); {}.{listener_abort_property}?.abort(); }}",
                build.record_variable, build.record_variable, build.record_variable, build.record_variable, build.record_variable
            )));
            let options_expression = event_handler
                .options_expression
                .as_deref()
                .unwrap_or("undefined");
            build.update_lines.push(ListRowUpdateLine::plain(format!(
                "{}.{listener_options_property} = {options_expression};",
                build.record_variable
            )));
            build.update_lines.push(ListRowUpdateLine::plain(format!(
                "{}.{listener_property} = (event) => {{",
                build.record_variable
            )));
            build.update_lines.push(ListRowUpdateLine::plain(format!(
                "  {}.{listener_abort_property} = new AbortController();",
                build.record_variable
            )));
            build.update_lines.push(ListRowUpdateLine::plain(format!(
                "  {}.__naosEventAbortControllers.add({}.{listener_abort_property});",
                build.record_variable, build.record_variable
            )));
            build.update_lines.push(ListRowUpdateLine::plain(format!(
                "  const __naosEventSignal = {}.{listener_abort_property}.signal;",
                build.record_variable
            )));
            build.update_lines.push(ListRowUpdateLine::plain(format!(
                "  __naosEventSignal.addEventListener(\"abort\", () => {}.__naosEventAbortControllers.delete({}.{listener_abort_property}), {{ once: true }});",
                build.record_variable, build.record_variable
            )));
            for line in handler_body(&event_handler.handler_expression, "__naosEventSignal")
                .lines()
                .map(str::trim)
                .filter(|line| !line.is_empty())
            {
                build
                    .update_lines
                    .push(ListRowUpdateLine::plain(format!("  {line}")));
            }
            build
                .update_lines
                .push(ListRowUpdateLine::plain("};".to_owned()));
            build.update_lines.push(ListRowUpdateLine::plain(format!(
                "{}.{variable}.addEventListener(\"{event_name}\", {}.{listener_property}, {}.{listener_options_property});",
                build.record_variable, build.record_variable, build.record_variable
            )));
            return Ok(());
        }

        let attribute_name = attribute_name_for_element(name, is_component_element);
        match value {
            AttributeValue::Boolean => {
                build.create_lines.push(format!(
                    "{variable}.setAttribute(\"{}\", \"\");",
                    attribute_name
                ));
                if follows_spread {
                    build.update_lines.push(ListRowUpdateLine::plain(format!(
                        "{}.{variable}.setAttribute(\"{}\", \"\");",
                        build.record_variable, attribute_name
                    )));
                }
            }
            AttributeValue::Static(value) => {
                build.create_lines.push(format!(
                    "{variable}.setAttribute(\"{}\", \"{}\");",
                    attribute_name,
                    escape_js_string(value)
                ));
                if follows_spread {
                    build.update_lines.push(ListRowUpdateLine::plain(format!(
                        "{}.{variable}.setAttribute(\"{}\", \"{}\");",
                        build.record_variable,
                        attribute_name,
                        escape_js_string(value)
                    )));
                }
            }
            AttributeValue::Expression(expression) => {
                self.push_list_row_update_line(
                    build,
                    expression,
                    dynamic_attribute_update(
                        &format!("{}.{variable}", build.record_variable),
                        variable,
                        &attribute_name,
                        expression,
                    ),
                );
            }
            AttributeValue::Element(_) => {
                return Err(unsupported_at(
                    "JSX element attribute values are supported only for Show fallback.",
                    span,
                ));
            }
            AttributeValue::EventHandler(_) => {
                return Err(unsupported_at(
                    "Event handlers must use an `on*` JSX attribute.",
                    span,
                ));
            }
        }
        Ok(())
    }

    fn emit_ref_binding(
        &mut self,
        field_reference: &str,
        value: &AttributeValue,
        span: Option<DiagnosticSpan>,
    ) -> CompilerResult<()> {
        let AttributeValue::Expression(expression) = value else {
            return Err(unsupported_at("JSX `ref` must use a braced value.", span));
        };
        let expression = expression.trim();
        if is_identifier(expression) {
            self.ref_lines
                .push(format!("this.#refs.{expression} = {field_reference};"));
            return Ok(());
        }
        if !is_ref_callback_expression(expression) {
            return Err(unsupported_at(
                "JSX `ref` supports an identifier variable or arrow-function callback.",
                span,
            ));
        }
        self.ref_lines.push("{".to_owned());
        let names = self.binding_names().join(", ");
        if !names.is_empty() {
            self.ref_lines
                .push(format!("  const {{ {names} }} = this.#createBindings();"));
        }
        self.ref_lines
            .push(format!("  ({expression})({field_reference});"));
        self.ref_lines.push("}".to_owned());
        Ok(())
    }

    fn element_tag_name(&self, tag_name: &str) -> CompilerResult<String> {
        if !is_pascal_case_identifier(tag_name) {
            return Ok(tag_name.to_owned());
        }
        let component_name = self
            .module
            .component_imports
            .iter()
            .find(|component_import| component_import.local_name == tag_name)
            .map(|component_import| component_import.imported_name.as_str())
            .unwrap_or(tag_name);
        custom_element_tag_for_component(component_name, &self.module.package)
    }

    #[allow(clippy::too_many_arguments)]
    fn emit_attribute(
        &mut self,
        variable: &str,
        field_reference: &str,
        field_name: &str,
        attribute: &TemplateAttribute,
        is_component_element: bool,
        follows_spread: bool,
        span: Option<DiagnosticSpan>,
    ) -> CompilerResult<()> {
        let (name, value) = match attribute {
            TemplateAttribute::Named { name, value } => (name, value),
            TemplateAttribute::Spread { expression } => {
                if is_component_element {
                    return Err(unsupported_at(
                        "JSX spread attributes are supported only on native elements.",
                        span,
                    ));
                }
                self.uses_spread_attributes = true;
                let spread_field = format!("{field_name}Spread{}", self.spread_fields.len());
                self.spread_fields.push(spread_field.clone());
                self.push_update_line(
                    format!(
                        "this.#applySpreadAttributes({field_reference}, this.#{spread_field}, {expression});"
                    ),
                    self.dependencies_for_expression(expression),
                );
                return Ok(());
            }
        };
        if name == "key" {
            return Ok(());
        }
        if name == "ref" {
            self.emit_ref_binding(field_reference, value, span)?;
            return Ok(());
        }
        if let Some(event_name) = event_name_from_attribute(name) {
            let AttributeValue::EventHandler(event_handler) = value else {
                return Err(unsupported_at(
                    format!(
                        "Event attribute `{}` must use a braced handler expression.",
                        name
                    ),
                    span,
                ));
            };
            let body = handler_body(&event_handler.handler_expression, "__naosEventSignal");
            let listener_abort_variable = format!(
                "{field_name}{}AbortController",
                event_name.replace('-', "_")
            );
            if event_handler.options_expression.is_some() {
                self.listener_lines.push("{".to_owned());
            }
            self.listener_lines
                .push(format!("let {listener_abort_variable} = null;"));
            self.listener_lines.push(format!(
                "{field_reference}.addEventListener(\"{event_name}\", (event) => {{"
            ));
            self.listener_lines.push(format!(
                "  if ({listener_abort_variable}) {listener_abort_variable}.abort();"
            ));
            self.listener_lines.push(format!(
                "  {listener_abort_variable} = new AbortController();"
            ));
            self.listener_lines.push(format!(
                "  this.#eventAbortControllers.add({listener_abort_variable});"
            ));
            self.listener_lines.push(format!(
                "  const __naosEventSignal = {listener_abort_variable}.signal;"
            ));
            self.listener_lines.push(format!(
                "  __naosEventSignal.addEventListener(\"abort\", () => this.#eventAbortControllers.delete({listener_abort_variable}), {{ once: true }});"
            ));
            let names = self.binding_names().join(", ");
            if !names.is_empty() {
                self.listener_lines
                    .push(format!("  const {{ {names} }} = this.#createBindings();"));
            }
            for line in body.lines().map(str::trim).filter(|line| !line.is_empty()) {
                self.listener_lines.push(format!("  {line}"));
            }
            match &event_handler.options_expression {
                Some(options) => {
                    self.listener_lines.push(format!("}}, {options});"));
                    self.listener_lines.push("}".to_owned());
                }
                None => self.listener_lines.push("});".to_owned()),
            }
            return Ok(());
        }

        let attribute_name = attribute_name_for_element(name, is_component_element);
        match value {
            AttributeValue::Boolean => {
                self.mount_lines.push(format!(
                    "{variable}.setAttribute(\"{}\", \"\");",
                    attribute_name
                ));
                if follows_spread {
                    self.push_update_line(
                        format!(
                            "{field_reference}.setAttribute(\"{}\", \"\");",
                            attribute_name
                        ),
                        ReactiveDependencies::Unknown,
                    );
                }
            }
            AttributeValue::Static(value) => {
                self.mount_lines.push(format!(
                    "{variable}.setAttribute(\"{}\", \"{}\");",
                    attribute_name,
                    escape_js_string(value)
                ));
                if follows_spread {
                    self.push_update_line(
                        format!(
                            "{field_reference}.setAttribute(\"{}\", \"{}\");",
                            attribute_name,
                            escape_js_string(value)
                        ),
                        ReactiveDependencies::Unknown,
                    );
                }
            }
            AttributeValue::Expression(expression) => {
                let dependencies = if follows_spread {
                    ReactiveDependencies::Unknown
                } else {
                    self.dependencies_for_expression(expression)
                };
                self.push_update_line(
                    dynamic_attribute_update(
                        field_reference,
                        field_name,
                        &attribute_name,
                        expression,
                    ),
                    dependencies,
                );
            }
            AttributeValue::Element(_) => {
                return Err(unsupported_at(
                    "JSX element attribute values are supported only for Show fallback.",
                    span,
                ));
            }
            AttributeValue::EventHandler(_) => {
                return Err(unsupported_at(
                    "Event handlers must use an `on*` JSX attribute.",
                    span,
                ));
            }
        }
        Ok(())
    }

    fn emit_text(&mut self, parent_variable: &str, text: &str) {
        let Some(expression) = text_expression(text) else {
            return;
        };
        let index = self.next_text_index;
        self.next_text_index += 1;
        let variable = format!("text{index}");
        let field = format!("text{index}");
        self.text_fields.push(field.clone());
        self.mount_lines
            .push(format!("const {variable} = document.createTextNode(\"\");"));
        self.mount_lines
            .push(format!("this.#{field} = {variable};"));
        self.mount_lines
            .push(format!("{parent_variable}.append({variable});"));
        self.push_update_line(
            format!("this.#{field}.data = {expression};"),
            self.dependencies_for_expression(&expression),
        );
    }

    fn emit_expression(
        &mut self,
        parent_variable: &str,
        expression: &str,
        span: Option<DiagnosticSpan>,
    ) -> CompilerResult<()> {
        let trimmed = expression.trim();
        if trimmed.is_empty() {
            return Ok(());
        }
        validate_child_expression(trimmed, span)?;
        let index = self.next_text_index;
        self.next_text_index += 1;
        let variable = format!("text{index}");
        let field = format!("text{index}");
        self.text_fields.push(field.clone());
        self.mount_lines
            .push(format!("const {variable} = document.createTextNode(\"\");"));
        self.mount_lines
            .push(format!("this.#{field} = {variable};"));
        self.mount_lines
            .push(format!("{parent_variable}.append({variable});"));
        self.push_update_line(
            format!("this.#{field}.data = String({trimmed});"),
            self.dependencies_for_expression(trimmed),
        );
        Ok(())
    }
}

fn dependencies_argument(dependencies: &ReactiveDependencies) -> String {
    match dependencies {
        ReactiveDependencies::Unknown => "null".to_owned(),
        ReactiveDependencies::Known(sources) => {
            let sources = sources
                .iter()
                .map(|source| format!("\"{}\"", escape_js_string(source)))
                .collect::<Vec<_>>()
                .join(", ");
            format!("[{sources}]")
        }
    }
}

fn list_key_expression(key: &TemplateListKey) -> String {
    match key {
        TemplateListKey::Expression(expression) => expression.clone(),
        TemplateListKey::Static(value) => format!("\"{}\"", escape_js_string(value)),
    }
}

fn collect_template_expressions<'a>(element: &'a TemplateElement, expressions: &mut Vec<&'a str>) {
    for attribute in &element.attributes {
        match attribute {
            TemplateAttribute::Spread { expression } => expressions.push(expression),
            TemplateAttribute::Named { value, .. } => match value {
                AttributeValue::Expression(expression) => expressions.push(expression),
                AttributeValue::Element(element) => {
                    collect_template_expressions(element, expressions);
                }
                AttributeValue::EventHandler(event_handler) => {
                    expressions.push(&event_handler.handler_expression);
                    if let Some(options) = &event_handler.options_expression {
                        expressions.push(options);
                    }
                }
                AttributeValue::Static(_) | AttributeValue::Boolean => {}
            },
        }
    }
    for child in &element.children {
        match child {
            TemplateChild::Element(element) => collect_template_expressions(element, expressions),
            TemplateChild::List(renderer) => {
                expressions.push(&renderer.each_expression);
                if let TemplateListKind::ItemKeyed {
                    key: TemplateListKey::Expression(key),
                } = &renderer.kind
                {
                    expressions.push(key);
                }
                collect_template_expressions(&renderer.template, expressions);
            }
            TemplateChild::Expression(expression) => expressions.push(expression),
            TemplateChild::Text(_) => {}
        }
    }
}

fn list_row_binding_scope_lines(renderer: &ListRenderer, record_variable: &str) -> Vec<String> {
    let mut lines = Vec::new();
    match &renderer.kind {
        TemplateListKind::ItemKeyed { .. } => {
            lines.push(format!(
                "const {} = {record_variable}.value;",
                renderer.item_name
            ));
        }
        TemplateListKind::IndexKeyed => {
            lines.push(format!(
                "const {} = () => {record_variable}.value;",
                renderer.item_name
            ));
        }
    }
    lines.push(format!(
        "const {} = {record_variable}.index;",
        renderer.index_name
    ));
    lines
}

fn keyed_selector_use_for_expression(
    expression: &str,
    selectors: &[KeyedSelectorDefinition],
) -> Option<KeyedSelectorUse> {
    let mut uses = Vec::new();
    for selector in selectors {
        collect_keyed_selector_uses(expression, selector, &mut uses);
    }
    if uses.len() == 1 { uses.pop() } else { None }
}

fn collect_keyed_selector_uses(
    expression: &str,
    selector: &KeyedSelectorDefinition,
    uses: &mut Vec<KeyedSelectorUse>,
) {
    let mut offset = 0usize;
    while let Some(relative_index) = expression[offset..].find(&selector.local_name) {
        let index = offset + relative_index;
        let after_name = index + selector.local_name.len();
        let before = expression[..index].chars().next_back();
        let after = expression[after_name..].chars().next();
        if before.is_some_and(is_dependency_identifier_char)
            || after.is_some_and(is_dependency_identifier_char)
            || previous_non_whitespace(expression, index) == Some('.')
        {
            offset = after_name;
            continue;
        }

        let mut open = after_name;
        while open < expression.len() {
            let Some(ch) = expression[open..].chars().next() else {
                break;
            };
            if !ch.is_whitespace() {
                break;
            }
            open += ch.len_utf8();
        }
        if !expression[open..].starts_with('(') {
            offset = after_name;
            continue;
        }
        let Ok(close) = find_matching_delimiter(expression, open, '(', ')') else {
            offset = after_name;
            continue;
        };
        let arguments = split_top_level_commas(&expression[open + 1..close]);
        if arguments.len() == 1 {
            let key_expression = arguments[0].trim();
            if !key_expression.is_empty() {
                uses.push(KeyedSelectorUse {
                    selector_name: selector.local_name.clone(),
                    key_expression: key_expression.to_owned(),
                });
            }
        }
        offset = close + 1;
    }
}

fn expression_dependencies(expression: &str, module: &ComponentModule) -> ReactiveDependencies {
    DependencyContext {
        module,
        visiting_computed: BTreeSet::new(),
        keyed_selector_mode: KeyedSelectorDependencyMode::IncludeSources,
    }
    .dependencies_for_expression(expression)
}

fn expression_dependencies_without_keyed_selectors(
    expression: &str,
    module: &ComponentModule,
) -> ReactiveDependencies {
    DependencyContext {
        module,
        visiting_computed: BTreeSet::new(),
        keyed_selector_mode: KeyedSelectorDependencyMode::IgnoreSources,
    }
    .dependencies_for_expression(expression)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum KeyedSelectorDependencyMode {
    IncludeSources,
    IgnoreSources,
}

struct DependencyContext<'a> {
    module: &'a ComponentModule,
    visiting_computed: BTreeSet<String>,
    keyed_selector_mode: KeyedSelectorDependencyMode,
}

impl<'a> DependencyContext<'a> {
    fn dependencies_for_expression(&mut self, expression: &str) -> ReactiveDependencies {
        let mut sources = BTreeSet::new();
        let mut unknown = false;

        let Some(identifier_uses) = identifier_uses(expression) else {
            return ReactiveDependencies::Unknown;
        };
        for identifier in identifier_uses {
            if self
                .module
                .props
                .iter()
                .any(|prop| prop.local_name == identifier.name)
            {
                sources.insert(identifier.name);
                continue;
            }
            if identifier.is_call
                && self
                    .module
                    .states
                    .iter()
                    .any(|state| state.local_name == identifier.name)
            {
                sources.insert(identifier.name);
                continue;
            }
            if identifier.is_call
                && self
                    .module
                    .computed
                    .iter()
                    .any(|computed| computed.local_name == identifier.name)
            {
                match self.dependencies_for_computed(&identifier.name) {
                    ReactiveDependencies::Known(computed_sources) => {
                        sources.extend(computed_sources);
                    }
                    ReactiveDependencies::Unknown => unknown = true,
                }
                continue;
            }
            if identifier.is_call
                && let Some(selector) = self
                    .module
                    .keyed_selectors
                    .iter()
                    .find(|selector| selector.local_name == identifier.name)
            {
                if self.keyed_selector_mode == KeyedSelectorDependencyMode::IncludeSources {
                    sources.insert(selector.source_name.clone());
                }
                continue;
            }
            if identifier.is_call && !is_allowed_dependency_call(&identifier.name) {
                unknown = true;
            }
        }

        if unknown {
            ReactiveDependencies::Unknown
        } else {
            ReactiveDependencies::Known(sources)
        }
    }

    fn dependencies_for_computed(&mut self, name: &str) -> ReactiveDependencies {
        if !self.visiting_computed.insert(name.to_owned()) {
            return ReactiveDependencies::Unknown;
        }
        let Some(computed) = self
            .module
            .computed
            .iter()
            .find(|computed| computed.local_name == name)
        else {
            self.visiting_computed.remove(name);
            return ReactiveDependencies::Unknown;
        };
        let dependencies = self.dependencies_for_expression(&computed.expression);
        self.visiting_computed.remove(name);
        dependencies
    }
}

struct IdentifierUse {
    name: String,
    is_call: bool,
}

fn identifier_uses(source: &str) -> Option<Vec<IdentifierUse>> {
    let allocator = Allocator::default();
    let mut visitor = DependencyVisitor::default();
    if let Ok(expression) = Parser::new(&allocator, source, SourceType::tsx()).parse_expression() {
        visitor.visit_expression(&expression);
        return Some(visitor.identifiers);
    }

    let parsed = Parser::new(&allocator, source, SourceType::tsx()).parse();
    if !parsed.errors.is_empty() {
        return None;
    }
    visitor.visit_program(&parsed.program);
    Some(visitor.identifiers)
}

#[derive(Default)]
struct DependencyVisitor {
    identifiers: Vec<IdentifierUse>,
    scopes: Vec<BTreeSet<String>>,
}

impl DependencyVisitor {
    fn is_shadowed(&self, name: &str) -> bool {
        self.scopes.iter().rev().any(|scope| scope.contains(name))
    }

    fn push_bindings<I>(&mut self, bindings: I)
    where
        I: IntoIterator<Item = String>,
    {
        self.scopes.push(bindings.into_iter().collect());
    }

    fn record(&mut self, name: &str, is_call: bool) {
        if !self.is_shadowed(name) {
            self.identifiers.push(IdentifierUse {
                name: name.to_owned(),
                is_call,
            });
        }
    }
}

impl<'a> Visit<'a> for DependencyVisitor {
    fn visit_identifier_reference(&mut self, identifier: &IdentifierReference<'a>) {
        self.record(identifier.name.as_str(), false);
    }

    fn visit_call_expression(&mut self, call: &CallExpression<'a>) {
        if let Some(identifier) = call.callee.get_identifier_reference() {
            self.record(identifier.name.as_str(), true);
        }
        walk::walk_call_expression(self, call);
    }

    fn visit_arrow_function_expression(&mut self, function: &ArrowFunctionExpression<'a>) {
        self.push_bindings(parameter_bindings(&function.params));
        walk::walk_arrow_function_expression(self, function);
        self.scopes.pop();
    }

    fn visit_function(&mut self, function: &Function<'a>, flags: ScopeFlags) {
        let mut bindings = parameter_bindings(&function.params);
        if let Some(identifier) = &function.id {
            bindings.push(identifier.name.to_string());
        }
        self.push_bindings(bindings);
        walk::walk_function(self, function, flags);
        self.scopes.pop();
    }

    fn visit_block_statement(&mut self, statement: &BlockStatement<'a>) {
        self.push_bindings(std::iter::empty());
        walk::walk_block_statement(self, statement);
        self.scopes.pop();
    }

    fn visit_variable_declarator(&mut self, declarator: &VariableDeclarator<'a>) {
        if let Some(scope) = self.scopes.last_mut() {
            scope.extend(
                declarator
                    .id
                    .get_binding_identifiers()
                    .into_iter()
                    .map(|identifier| identifier.name.to_string()),
            );
        }
        walk::walk_variable_declarator(self, declarator);
    }
}

fn parameter_bindings(parameters: &FormalParameters<'_>) -> Vec<String> {
    parameters
        .items
        .iter()
        .flat_map(|parameter| parameter.pattern.get_binding_identifiers())
        .map(|identifier| identifier.name.to_string())
        .chain(
            parameters
                .rest
                .iter()
                .flat_map(|rest| rest.rest.argument.get_binding_identifiers())
                .map(|identifier| identifier.name.to_string()),
        )
        .collect()
}

fn is_dependency_identifier_char(ch: char) -> bool {
    ch == '_' || ch == '$' || ch.is_ascii_alphanumeric()
}

fn previous_non_whitespace(source: &str, index: usize) -> Option<char> {
    source[..index].chars().rev().find(|ch| !ch.is_whitespace())
}

fn is_allowed_dependency_call(name: &str) -> bool {
    matches!(
        name,
        "String"
            | "Number"
            | "Boolean"
            | "BigInt"
            | "Symbol"
            | "Array"
            | "Object"
            | "Date"
            | "RegExp"
            | "Set"
            | "Map"
            | "WeakSet"
            | "WeakMap"
            | "Promise"
            | "encodeURI"
            | "encodeURIComponent"
            | "decodeURI"
            | "decodeURIComponent"
            | "isFinite"
            | "isNaN"
            | "parseFloat"
            | "parseInt"
            | "host"
    )
}

struct DeclarativeShadowDomRenderer<'a> {
    module: &'a ComponentModule,
    context: StaticEvaluationContext,
    next_node_index: usize,
    next_text_index: usize,
}

impl<'a> DeclarativeShadowDomRenderer<'a> {
    fn new(
        module: &'a ComponentModule,
        props: BTreeMap<String, StaticValue>,
        inline_styles: BTreeMap<String, StaticValue>,
    ) -> CompilerResult<Self> {
        Ok(Self {
            module,
            context: StaticEvaluationContext::for_module(module, props, inline_styles)?,
            next_node_index: 0,
            next_text_index: 0,
        })
    }

    fn render(
        &mut self,
        root: &TemplateElement,
    ) -> CompilerResult<DeclarativeShadowDomRenderResult> {
        let host_attributes = self.host_attributes();
        let template_html = if self.module.options.shadow {
            let mut template_html = String::from("<template shadowrootmode=\"open\">");
            for style in &self.module.options.styles {
                if let Some(StaticValue::String(css)) = evaluate_expression(style, &self.context) {
                    write!(template_html, "<style>{}</style>", escape_html_text(&css))
                        .map_err(format_error)?;
                }
            }
            template_html.push_str(&self.render_element(root, true)?);
            template_html.push_str("</template>");
            template_html
        } else {
            String::new()
        };

        let html = format!(
            "<{}{}>{}</{}>",
            self.module.tag_name, host_attributes, template_html, self.module.tag_name
        );

        Ok(DeclarativeShadowDomRenderResult {
            package: self.module.package.clone(),
            tag_name: self.module.tag_name.clone(),
            class_name: self.module.class_name.clone(),
            export_name: self.module.export_name.clone(),
            html,
            template_html,
            shadow: self.module.options.shadow,
            uses_declarative_shadow_dom: self.module.options.shadow,
        })
    }

    fn host_attributes(&self) -> String {
        let mut attributes = String::new();
        for prop in &self.module.props {
            let Some(value) = self.context.values.get(&prop.local_name) else {
                continue;
            };
            push_serialized_dynamic_attribute(&mut attributes, &prop.attribute_name, value, false);
        }
        attributes
    }

    fn render_element(
        &mut self,
        element: &TemplateElement,
        is_root: bool,
    ) -> CompilerResult<String> {
        if element.tag_name == "Show" {
            return self.render_show_control(element);
        }
        if element.tag_name == "Switch" {
            return self.render_switch_control(element);
        }
        if element.tag_name == "Match" {
            return Err(unsupported_with_code_at(
                DIAGNOSTIC_CODE_UNSUPPORTED_SWITCH_MATCH,
                "<Match> can only be used as a direct child of <Switch>.",
                DIAGNOSTIC_HINT_SWITCH,
                element.span,
            ));
        }
        if element.tag_name == "For" {
            return self.render_for_control();
        }
        if element.tag_name == "Index" {
            return self.render_index_control();
        }

        let field = self.next_node_field();
        let tag_name = self.element_tag_name(&element.tag_name)?;
        let is_component_element = is_pascal_case_identifier(&element.tag_name);
        let mut output = String::new();
        write!(output, "<{tag_name}").map_err(format_error)?;
        write!(
            output,
            " data-naos-node=\"{}\"",
            escape_html_attribute(&field)
        )
        .map_err(format_error)?;
        if is_root {
            output.push_str(" data-naos-root=\"\"");
        }
        for attribute in &element.attributes {
            self.render_attribute(&mut output, attribute, is_component_element, element.span)?;
        }
        output.push('>');
        for child in &element.children {
            output.push_str(&self.render_child(child, element.span)?);
        }
        write!(output, "</{tag_name}>").map_err(format_error)?;
        Ok(output)
    }

    fn render_child(
        &mut self,
        child: &TemplateChild,
        parent_span: Option<DiagnosticSpan>,
    ) -> CompilerResult<String> {
        match child {
            TemplateChild::Element(element) => self.render_element(element, false),
            TemplateChild::List(_) => self.render_list_control(),
            TemplateChild::Expression(expression) => {
                self.render_expression_text(expression, parent_span)
            }
            TemplateChild::Text(text) => self.render_text(text),
        }
    }

    fn render_attribute(
        &self,
        output: &mut String,
        attribute: &TemplateAttribute,
        is_component_element: bool,
        span: Option<DiagnosticSpan>,
    ) -> CompilerResult<()> {
        let TemplateAttribute::Named { name, value } = attribute else {
            if is_component_element {
                return Err(unsupported_at(
                    "JSX spread attributes are supported only on native elements.",
                    span,
                ));
            }
            return Ok(());
        };
        if name == "key" {
            return Ok(());
        }
        if name == "ref" {
            return Ok(());
        }
        if event_name_from_attribute(name).is_some() {
            return Ok(());
        }

        let attribute_name = attribute_name_for_element(name, is_component_element);
        match value {
            AttributeValue::Boolean => {
                write!(output, " {attribute_name}").map_err(format_error)?;
            }
            AttributeValue::Static(value) => {
                write!(
                    output,
                    " {attribute_name}=\"{}\"",
                    escape_html_attribute(value)
                )
                .map_err(format_error)?;
            }
            AttributeValue::Expression(expression) => {
                if let Some(value) = evaluate_expression(expression, &self.context) {
                    push_serialized_dynamic_attribute(output, &attribute_name, &value, false);
                }
            }
            AttributeValue::Element(_) => {
                return Err(unsupported_at(
                    "JSX element attribute values are supported only for Show fallback.",
                    span,
                ));
            }
            AttributeValue::EventHandler(_) => return Ok(()),
        }
        Ok(())
    }

    fn render_text(&mut self, text: &str) -> CompilerResult<String> {
        let chunks = text_chunks(text);
        if chunks.is_empty() {
            return Ok(String::new());
        }
        let value = chunks
            .iter()
            .map(|chunk| match chunk {
                TextChunk::Raw(value) => value.clone(),
                TextChunk::Expression(expression) => evaluate_expression(expression, &self.context)
                    .map(|value| value.to_text())
                    .unwrap_or_default(),
            })
            .collect::<String>();
        Ok(self.text_marker(&value))
    }

    fn render_expression_text(
        &mut self,
        expression: &str,
        span: Option<DiagnosticSpan>,
    ) -> CompilerResult<String> {
        let trimmed = expression.trim();
        if trimmed.is_empty() {
            return Ok(String::new());
        }
        validate_child_expression(trimmed, span)?;
        let value = evaluate_expression(trimmed, &self.context)
            .map(|value| value.to_text())
            .unwrap_or_default();
        Ok(self.text_marker(&value))
    }

    fn render_show_control(&mut self, element: &TemplateElement) -> CompilerResult<String> {
        let when = required_expression_attribute(element, "when")?;
        let is_visible = evaluate_expression(when, &self.context).and_then(|value| value.as_bool());
        let container_field = self.next_node_field();
        let content_field = format!("{container_field}Content");
        let fallback_field = format!("{container_field}Fallback");
        let mut output = String::new();
        write!(
            output,
            "<span style=\"display: contents\" data-naos-control=\"show\" data-naos-node=\"{}\">",
            escape_html_attribute(&container_field)
        )
        .map_err(format_error)?;
        write!(
            output,
            "<span style=\"display: contents\" data-naos-node=\"{}\"{}>",
            escape_html_attribute(&content_field),
            hidden_attribute(is_visible == Some(false))
        )
        .map_err(format_error)?;
        for child in &element.children {
            output.push_str(&self.render_child(child, element.span)?);
        }
        output.push_str("</span>");
        write!(
            output,
            "<span style=\"display: contents\" data-naos-node=\"{}\"{}>",
            escape_html_attribute(&fallback_field),
            hidden_attribute(is_visible == Some(true))
        )
        .map_err(format_error)?;
        if let Some(fallback) = optional_attribute(element, "fallback") {
            output.push_str(&self.render_show_fallback(fallback, element.span)?);
        }
        output.push_str("</span></span>");
        Ok(output)
    }

    fn render_show_fallback(
        &mut self,
        attribute: &TemplateAttribute,
        span: Option<DiagnosticSpan>,
    ) -> CompilerResult<String> {
        let TemplateAttribute::Named { value, .. } = attribute else {
            return Err(unsupported_at(
                "Show fallback does not support JSX spread attributes.",
                span,
            ));
        };
        match value {
            AttributeValue::Expression(expression) => {
                let trimmed = expression.trim();
                self.render_expression_text(trimmed, span)
            }
            AttributeValue::Element(fallback) => self.render_element(fallback, false),
            AttributeValue::Static(value) => Ok(self.text_marker(value)),
            AttributeValue::Boolean => Err(unsupported_with_code_at(
                DIAGNOSTIC_CODE_UNSUPPORTED_SHOW_FALLBACK,
                "Show fallback must have a value.",
                DIAGNOSTIC_HINT_SHOW,
                span,
            )),
            AttributeValue::EventHandler(_) => Err(unsupported_at(
                "Show fallback cannot be an event handler.",
                span,
            )),
        }
    }

    fn render_switch_control(&mut self, element: &TemplateElement) -> CompilerResult<String> {
        let matches = parse_switch_matches(element)?;
        let container_field = self.next_node_field();
        let mut output = String::new();
        write!(
            output,
            "<span style=\"display: contents\" data-naos-control=\"switch\" data-naos-node=\"{}\">",
            escape_html_attribute(&container_field)
        )
        .map_err(format_error)?;

        let mut matched = false;
        for (match_index, switch_match) in matches.iter().enumerate() {
            let branch_field = format!("{container_field}Match{match_index}");
            let is_visible = if matched {
                false
            } else if let Some(when) = &switch_match.when {
                match evaluate_expression(when, &self.context).and_then(|value| value.as_bool()) {
                    Some(true) => {
                        matched = true;
                        true
                    }
                    Some(false) => false,
                    None => true,
                }
            } else {
                matched = true;
                true
            };
            write!(
                output,
                "<span style=\"display: contents\" data-naos-node=\"{}\"{}>",
                escape_html_attribute(&branch_field),
                hidden_attribute(!is_visible)
            )
            .map_err(format_error)?;
            for child in &switch_match.children {
                output.push_str(&self.render_child(child, element.span)?);
            }
            output.push_str("</span>");
        }

        output.push_str("</span>");
        Ok(output)
    }

    fn render_for_control(&mut self) -> CompilerResult<String> {
        self.render_list_control()
    }

    fn render_index_control(&mut self) -> CompilerResult<String> {
        self.render_list_control()
    }

    fn render_list_control(&mut self) -> CompilerResult<String> {
        let field = self.next_node_field();
        Ok(format!(
            "<span style=\"display: contents\" data-naos-control=\"for\" data-naos-node=\"{}\"></span>",
            escape_html_attribute(&field)
        ))
    }

    fn text_marker(&mut self, value: &str) -> String {
        let field = self.next_text_field();
        format!(
            "<span style=\"display: contents\" data-naos-text=\"{}\">{}</span>",
            escape_html_attribute(&field),
            escape_html_text(value)
        )
    }

    fn next_node_field(&mut self) -> String {
        let index = self.next_node_index;
        self.next_node_index += 1;
        format!("node{index}")
    }

    fn next_text_field(&mut self) -> String {
        let index = self.next_text_index;
        self.next_text_index += 1;
        format!("text{index}")
    }

    fn element_tag_name(&self, tag_name: &str) -> CompilerResult<String> {
        if !is_pascal_case_identifier(tag_name) {
            return Ok(tag_name.to_owned());
        }
        let component_name = self
            .module
            .component_imports
            .iter()
            .find(|component_import| component_import.local_name == tag_name)
            .map(|component_import| component_import.imported_name.as_str())
            .unwrap_or(tag_name);
        custom_element_tag_for_component(component_name, &self.module.package)
    }
}

#[derive(Debug, Clone, PartialEq)]
enum StaticValue {
    Null,
    Bool(bool),
    Number(String),
    String(String),
    Array(Vec<StaticValue>),
    Object(BTreeMap<String, StaticValue>),
}

impl StaticValue {
    fn from_json(value: JsonValue) -> Self {
        match value {
            JsonValue::Null => Self::Null,
            JsonValue::Bool(value) => Self::Bool(value),
            JsonValue::Number(value) => Self::Number(value.to_string()),
            JsonValue::String(value) => Self::String(value),
            JsonValue::Array(values) => {
                Self::Array(values.into_iter().map(Self::from_json).collect())
            }
            JsonValue::Object(values) => Self::Object(
                values
                    .into_iter()
                    .map(|(key, value)| (key, Self::from_json(value)))
                    .collect(),
            ),
        }
    }

    fn as_bool(&self) -> Option<bool> {
        match self {
            Self::Bool(value) => Some(*value),
            _ => None,
        }
    }

    fn is_truthy(&self) -> bool {
        match self {
            Self::Null => false,
            Self::Bool(value) => *value,
            Self::Number(value) => value != "0" && value != "NaN",
            Self::String(value) => !value.is_empty(),
            Self::Array(_) | Self::Object(_) => true,
        }
    }

    fn to_text(&self) -> String {
        match self {
            Self::Null => String::new(),
            Self::Bool(value) => value.to_string(),
            Self::Number(value) | Self::String(value) => value.clone(),
            Self::Array(values) => {
                let values = values.iter().map(Self::to_json).collect::<Vec<_>>();
                JsonValue::Array(values).to_string()
            }
            Self::Object(values) => {
                let values = values
                    .iter()
                    .map(|(key, value)| (key.clone(), value.to_json()))
                    .collect();
                JsonValue::Object(values).to_string()
            }
        }
    }

    fn to_json(&self) -> JsonValue {
        match self {
            Self::Null => JsonValue::Null,
            Self::Bool(value) => JsonValue::Bool(*value),
            Self::Number(value) => value
                .parse::<serde_json::Number>()
                .map(JsonValue::Number)
                .unwrap_or_else(|_| JsonValue::String(value.clone())),
            Self::String(value) => JsonValue::String(value.clone()),
            Self::Array(values) => JsonValue::Array(values.iter().map(Self::to_json).collect()),
            Self::Object(values) => JsonValue::Object(
                values
                    .iter()
                    .map(|(key, value)| (key.clone(), value.to_json()))
                    .collect(),
            ),
        }
    }
}

#[derive(Debug, Clone, Default)]
struct StaticEvaluationContext {
    values: BTreeMap<String, StaticValue>,
}

impl StaticEvaluationContext {
    fn for_module(
        module: &ComponentModule,
        props: BTreeMap<String, StaticValue>,
        inline_styles: BTreeMap<String, StaticValue>,
    ) -> CompilerResult<Self> {
        let mut context = Self::default();
        context.values.extend(inline_styles);
        for prop in &module.props {
            let default_value = evaluate_expression(&prop.default_value, &context)
                .unwrap_or_else(|| fallback_static_value_for_prop(prop));
            let value = props
                .get(&prop.prop_name)
                .or_else(|| props.get(&prop.attribute_name))
                .or_else(|| props.get(&prop.local_name))
                .cloned()
                .unwrap_or(default_value);
            context.values.insert(prop.local_name.clone(), value);
        }
        for state in &module.states {
            if let Some(value) = evaluate_expression(&state.initial_value, &context) {
                context.values.insert(state.local_name.clone(), value);
            }
        }
        Ok(context)
    }
}

fn parse_prerender_props(
    props_json: Option<&str>,
) -> CompilerResult<BTreeMap<String, StaticValue>> {
    let Some(props_json) = props_json.filter(|value| !value.trim().is_empty()) else {
        return Ok(BTreeMap::new());
    };
    let value: JsonValue = serde_json::from_str(props_json)
        .map_err(|source| dsd_input(format!("DSD prerender props must be valid JSON: {source}")))?;
    let JsonValue::Object(props) = value else {
        return Err(dsd_input("DSD prerender props must be a JSON object."));
    };
    Ok(props
        .into_iter()
        .map(|(key, value)| (key, StaticValue::from_json(value)))
        .collect())
}

fn parse_inline_styles(
    inline_styles_json: Option<&str>,
) -> CompilerResult<BTreeMap<String, StaticValue>> {
    let Some(inline_styles_json) = inline_styles_json.filter(|value| !value.trim().is_empty())
    else {
        return Ok(BTreeMap::new());
    };
    let value: JsonValue = serde_json::from_str(inline_styles_json)
        .map_err(|source| dsd_input(format!("DSD inline styles must be valid JSON: {source}")))?;
    let JsonValue::Object(styles) = value else {
        return Err(dsd_input("DSD inline styles must be a JSON object."));
    };
    let mut output = BTreeMap::new();
    for (key, value) in styles {
        let JsonValue::String(css) = value else {
            return Err(dsd_input(
                "DSD inline style values must be strings keyed by local import name.",
            ));
        };
        output.insert(key, StaticValue::String(css));
    }
    Ok(output)
}

fn evaluate_expression(expression: &str, context: &StaticEvaluationContext) -> Option<StaticValue> {
    let trimmed = strip_wrapping_parentheses(expression.trim());
    if trimmed.is_empty() {
        return None;
    }
    if let Some((condition, when_true, when_false)) = split_top_level_ternary(trimmed) {
        let condition = evaluate_expression(condition, context)?;
        return if condition.is_truthy() {
            evaluate_expression(when_true, context)
        } else {
            evaluate_expression(when_false, context)
        };
    }
    if let Some((left, right)) = split_top_level_operator(trimmed, "||") {
        let left = evaluate_expression(left, context)?;
        return if left.is_truthy() {
            Some(left)
        } else {
            evaluate_expression(right, context)
        };
    }
    if let Some((left, right)) = split_top_level_operator(trimmed, "&&") {
        let left = evaluate_expression(left, context)?;
        return if left.is_truthy() {
            evaluate_expression(right, context)
        } else {
            Some(left)
        };
    }
    if let Some(rest) = trimmed.strip_prefix('!') {
        return evaluate_expression(rest, context)
            .map(|value| StaticValue::Bool(!value.is_truthy()));
    }
    if trimmed == "true" {
        return Some(StaticValue::Bool(true));
    }
    if trimmed == "false" {
        return Some(StaticValue::Bool(false));
    }
    if matches!(trimmed, "null" | "undefined") {
        return Some(StaticValue::Null);
    }
    if is_number_literal(trimmed) {
        return Some(StaticValue::Number(trimmed.to_owned()));
    }
    if is_quoted_string(trimmed) {
        return decode_quoted_string(trimmed).map(StaticValue::String);
    }
    if trimmed.starts_with('`') && trimmed.ends_with('`') {
        return evaluate_template_string(trimmed, context).map(StaticValue::String);
    }
    if trimmed.starts_with('[') && trimmed.ends_with(']') {
        return evaluate_array_literal(trimmed, context);
    }
    if trimmed.starts_with('{') && trimmed.ends_with('}') {
        return evaluate_object_literal(trimmed, context);
    }
    if let Some(name) = trimmed.strip_suffix("()")
        && is_identifier(name.trim())
    {
        return context.values.get(name.trim()).cloned();
    }
    if is_identifier(trimmed) {
        return context.values.get(trimmed).cloned();
    }
    None
}

fn evaluate_array_literal(
    expression: &str,
    context: &StaticEvaluationContext,
) -> Option<StaticValue> {
    let inner = &expression[1..expression.len() - 1];
    let mut values = Vec::new();
    for part in split_top_level_commas(inner) {
        let part = part.trim();
        if part.is_empty() {
            continue;
        }
        values.push(evaluate_expression(part, context)?);
    }
    Some(StaticValue::Array(values))
}

fn evaluate_object_literal(
    expression: &str,
    context: &StaticEvaluationContext,
) -> Option<StaticValue> {
    let inner = &expression[1..expression.len() - 1];
    let mut values = BTreeMap::new();
    for part in split_top_level_commas(inner) {
        let part = part.trim();
        if part.is_empty() {
            continue;
        }
        let (key, value) = split_top_level_once(part, ':')?;
        let key = normalize_object_key(key.trim())?;
        let value = evaluate_expression(value.trim(), context)?;
        values.insert(key, value);
    }
    Some(StaticValue::Object(values))
}

fn evaluate_template_string(expression: &str, context: &StaticEvaluationContext) -> Option<String> {
    let mut output = String::new();
    let mut position = 1usize;
    let end = expression.len() - 1;
    while position < end {
        let rest = &expression[position..end];
        let Some(open_relative) = rest.find("${") else {
            output.push_str(rest);
            break;
        };
        let open = position + open_relative;
        output.push_str(&expression[position..open]);
        let expression_start = open + 2;
        let close = find_matching_delimiter(expression, open + 1, '{', '}').ok()?;
        let value = evaluate_expression(&expression[expression_start..close], context)?;
        output.push_str(&value.to_text());
        position = close + 1;
    }
    Some(output)
}

fn normalize_object_key(source: &str) -> Option<String> {
    if is_identifier(source) {
        return Some(source.to_owned());
    }
    if is_quoted_string(source) {
        return decode_quoted_string(source);
    }
    None
}

fn fallback_static_value_for_prop(prop: &PropDefinition) -> StaticValue {
    match prop.kind {
        PropKind::String => StaticValue::String(String::new()),
        PropKind::Boolean => StaticValue::Bool(false),
        PropKind::Number => StaticValue::Number("0".to_owned()),
    }
}

fn push_serialized_dynamic_attribute(
    output: &mut String,
    name: &str,
    value: &StaticValue,
    force_boolean: bool,
) {
    if name == "disabled" || force_boolean {
        if value.is_truthy() {
            output.push(' ');
            output.push_str(name);
        }
        return;
    }
    if matches!(value, StaticValue::Null)
        || (!name.starts_with("aria-") && value == &StaticValue::Bool(false))
    {
        return;
    }
    output.push(' ');
    output.push_str(name);
    output.push_str("=\"");
    output.push_str(&escape_html_attribute(&value.to_text()));
    output.push('"');
}

fn hidden_attribute(hidden: bool) -> &'static str {
    if hidden { " hidden" } else { "" }
}

fn is_number_literal(source: &str) -> bool {
    !source.is_empty() && source.parse::<f64>().is_ok()
}

fn is_quoted_string(source: &str) -> bool {
    source.len() >= 2
        && ((source.starts_with('"') && source.ends_with('"'))
            || (source.starts_with('\'') && source.ends_with('\'')))
}

fn decode_quoted_string(source: &str) -> Option<String> {
    if !is_quoted_string(source) {
        return None;
    }
    let mut output = String::new();
    let inner = &source[1..source.len() - 1];
    let mut chars = inner.chars();
    while let Some(ch) = chars.next() {
        if ch != '\\' {
            output.push(ch);
            continue;
        }
        let escaped = chars.next()?;
        match escaped {
            'n' => output.push('\n'),
            'r' => output.push('\r'),
            't' => output.push('\t'),
            '"' => output.push('"'),
            '\'' => output.push('\''),
            '\\' => output.push('\\'),
            other => output.push(other),
        }
    }
    Some(output)
}

fn split_top_level_operator<'a>(source: &'a str, operator: &str) -> Option<(&'a str, &'a str)> {
    let index = find_top_level_token(source, operator)?;
    Some((&source[..index], &source[index + operator.len()..]))
}

fn split_top_level_ternary(source: &str) -> Option<(&str, &str, &str)> {
    let question = find_top_level_token(source, "?")?;
    let colon = find_top_level_token(&source[question + 1..], ":")? + question + 1;
    Some((
        &source[..question],
        &source[question + 1..colon],
        &source[colon + 1..],
    ))
}

fn split_top_level_once(source: &str, delimiter: char) -> Option<(&str, &str)> {
    let delimiter = delimiter.to_string();
    let index = find_top_level_token(source, &delimiter)?;
    Some((&source[..index], &source[index + delimiter.len()..]))
}

fn find_top_level_token(source: &str, token: &str) -> Option<usize> {
    let mut depth = 0usize;
    let mut in_string: Option<char> = None;
    let mut escaped = false;

    for (index, ch) in source.char_indices() {
        if let Some(quote) = in_string {
            if escaped {
                escaped = false;
                continue;
            }
            if ch == '\\' {
                escaped = true;
                continue;
            }
            if ch == quote {
                in_string = None;
            }
            continue;
        }

        if matches!(ch, '"' | '\'' | '`') {
            in_string = Some(ch);
            continue;
        }

        if matches!(ch, '(' | '[' | '{') {
            depth += 1;
            continue;
        }
        if matches!(ch, ')' | ']' | '}') {
            depth = depth.saturating_sub(1);
            continue;
        }
        if depth == 0 && source[index..].starts_with(token) {
            return Some(index);
        }
    }

    None
}

fn escape_html_text(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}

fn escape_html_attribute(value: &str) -> String {
    escape_html_text(value).replace('"', "&quot;")
}

fn attr_parse_expression(prop: &PropDefinition) -> String {
    match prop.kind {
        PropKind::String => {
            format!("newValue ?? {}", default_value_for_prop(prop))
        }
        PropKind::Boolean => "newValue !== null".to_owned(),
        PropKind::Number => {
            let default_value = default_value_for_prop(prop);
            format!("Number.isFinite(Number(newValue)) ? Number(newValue) : {default_value}")
        }
    }
}

fn required_expression_attribute<'a>(
    element: &'a TemplateElement,
    name: &str,
) -> CompilerResult<&'a str> {
    let Some(attribute) = optional_attribute(element, name) else {
        return Err(unsupported_at(
            format!("<{}> requires a `{name}` attribute.", element.tag_name),
            element.span,
        ));
    };
    let TemplateAttribute::Named { value, .. } = attribute else {
        return Err(unsupported_at(
            format!(
                "<{}> attribute `{name}` must use a braced expression.",
                element.tag_name
            ),
            element.span,
        ));
    };
    let AttributeValue::Expression(expression) = value else {
        return Err(unsupported_at(
            format!(
                "<{}> attribute `{name}` must use a braced expression.",
                element.tag_name
            ),
            element.span,
        ));
    };
    Ok(expression)
}

fn optional_attribute<'a>(
    element: &'a TemplateElement,
    name: &str,
) -> Option<&'a TemplateAttribute> {
    element
        .attributes
        .iter()
        .find(|attribute| {
            matches!(attribute, TemplateAttribute::Named { name: attribute_name, .. } if attribute_name == name)
        })
}

struct ListRowTemplate {
    create_lines: Vec<String>,
    record_properties: Vec<String>,
    update_lines: Vec<ListRowUpdateLine>,
    uses_event_abort_signals: bool,
}

struct ListRowBuild {
    prefix: String,
    record_variable: String,
    next_index: usize,
    create_lines: Vec<String>,
    record_properties: Vec<String>,
    update_lines: Vec<ListRowUpdateLine>,
    uses_event_abort_signals: bool,
}

struct ListRowUpdateLine {
    line: String,
    keyed_selector: Option<KeyedSelectorUse>,
}

impl ListRowUpdateLine {
    fn plain(line: String) -> Self {
        Self {
            line,
            keyed_selector: None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct KeyedSelectorUse {
    selector_name: String,
    key_expression: String,
}

type ListRenderer = TemplateList;

#[derive(Debug, Clone, PartialEq, Eq)]
struct SwitchMatch {
    when: Option<String>,
    children: Vec<TemplateChild>,
}

fn parse_switch_matches(element: &TemplateElement) -> CompilerResult<Vec<SwitchMatch>> {
    if !element.attributes.is_empty() {
        return Err(unsupported_with_code_at(
            DIAGNOSTIC_CODE_UNSUPPORTED_SWITCH_MATCH,
            "<Switch> does not support attributes in this milestone.",
            DIAGNOSTIC_HINT_SWITCH,
            element.span,
        ));
    }

    let mut matches = Vec::new();
    let mut seen_default = false;
    for child in &element.children {
        match child {
            TemplateChild::Text(text) if text.trim().is_empty() => {}
            TemplateChild::Element(match_element) if match_element.tag_name == "Match" => {
                if seen_default {
                    return Err(unsupported_with_code_at(
                        DIAGNOSTIC_CODE_UNSUPPORTED_SWITCH_MATCH,
                        "<Switch> default <Match> must be the last arm.",
                        DIAGNOSTIC_HINT_SWITCH,
                        match_element.span,
                    ));
                }
                let when = parse_match_when(match_element)?;
                if when.is_none() {
                    seen_default = true;
                }
                matches.push(SwitchMatch {
                    when,
                    children: match_element.children.clone(),
                });
            }
            _ => {
                return Err(unsupported_with_code_at(
                    DIAGNOSTIC_CODE_UNSUPPORTED_SWITCH_MATCH,
                    "<Switch> children must be static <Match> elements.",
                    DIAGNOSTIC_HINT_SWITCH,
                    element.span,
                ));
            }
        }
    }

    if matches.is_empty() {
        return Err(unsupported_with_code_at(
            DIAGNOSTIC_CODE_UNSUPPORTED_SWITCH_MATCH,
            "<Switch> requires at least one <Match> child.",
            DIAGNOSTIC_HINT_SWITCH,
            element.span,
        ));
    }

    Ok(matches)
}

fn parse_match_when(element: &TemplateElement) -> CompilerResult<Option<String>> {
    let mut when = None;
    for attribute in &element.attributes {
        let TemplateAttribute::Named { name, value } = attribute else {
            return Err(unsupported_with_code_at(
                DIAGNOSTIC_CODE_UNSUPPORTED_SWITCH_MATCH,
                "<Match> does not support JSX spread attributes.",
                DIAGNOSTIC_HINT_SWITCH,
                element.span,
            ));
        };
        if name != "when" {
            return Err(unsupported_with_code_at(
                DIAGNOSTIC_CODE_UNSUPPORTED_SWITCH_MATCH,
                "<Match> supports only the optional `when` attribute.",
                DIAGNOSTIC_HINT_SWITCH,
                element.span,
            ));
        }
        if when.is_some() {
            return Err(unsupported_with_code_at(
                DIAGNOSTIC_CODE_UNSUPPORTED_SWITCH_MATCH,
                "<Match> can declare `when` only once.",
                DIAGNOSTIC_HINT_SWITCH,
                element.span,
            ));
        }
        let AttributeValue::Expression(expression) = value else {
            return Err(unsupported_with_code_at(
                DIAGNOSTIC_CODE_UNSUPPORTED_SWITCH_MATCH,
                "<Match> `when` must use a braced expression.",
                DIAGNOSTIC_HINT_SWITCH,
                element.span,
            ));
        };
        if expression.trim().is_empty() {
            return Err(unsupported_with_code_at(
                DIAGNOSTIC_CODE_UNSUPPORTED_SWITCH_MATCH,
                "<Match> `when` must not be empty.",
                DIAGNOSTIC_HINT_SWITCH,
                element.span,
            ));
        }
        when = Some(expression.trim().to_owned());
    }
    Ok(when)
}

fn parse_for_renderer(element: &TemplateElement) -> CompilerResult<&ListRenderer> {
    list_renderer_child(element, "<For>", |kind| {
        matches!(kind, TemplateListKind::ItemKeyed { .. })
    })
}

fn parse_index_renderer(element: &TemplateElement) -> CompilerResult<&ListRenderer> {
    list_renderer_child(element, "<Index>", |kind| {
        matches!(kind, TemplateListKind::IndexKeyed)
    })
}

fn list_renderer_child<'a>(
    element: &'a TemplateElement,
    label: &str,
    expected_kind: impl FnOnce(&TemplateListKind) -> bool,
) -> CompilerResult<&'a ListRenderer> {
    let [TemplateChild::List(renderer)] = element.children.as_slice() else {
        return Err(unsupported_with_code_at(
            DIAGNOSTIC_CODE_UNSUPPORTED_LIST_RENDERER,
            format!("{label} requires exactly one braced arrow-function child."),
            DIAGNOSTIC_HINT_LISTS,
            element.span,
        ));
    };
    if !expected_kind(&renderer.kind) {
        return Err(unsupported_with_code_at(
            DIAGNOSTIC_CODE_UNSUPPORTED_LIST_RENDERER,
            format!("{label} contains an invalid list reconciliation strategy."),
            DIAGNOSTIC_HINT_LISTS,
            renderer.span,
        ));
    }
    Ok(renderer)
}

fn setter_parse_expression(prop: &PropDefinition) -> String {
    match prop.kind {
        PropKind::String => "value == null ? \"\" : String(value)".to_owned(),
        PropKind::Boolean => "Boolean(value)".to_owned(),
        PropKind::Number => {
            let default_value = default_value_for_prop(prop);
            format!("Number.isFinite(Number(value)) ? Number(value) : {default_value}")
        }
    }
}

fn default_value_for_prop(prop: &PropDefinition) -> String {
    if prop.default_value.trim().is_empty() {
        match prop.kind {
            PropKind::String => "\"\"".to_owned(),
            PropKind::Boolean => "false".to_owned(),
            PropKind::Number => "0".to_owned(),
        }
    } else {
        prop.default_value.clone()
    }
}

fn dynamic_attribute_update(
    target: &str,
    target_key: &str,
    name: &str,
    expression: &str,
) -> String {
    if name == "disabled" {
        return format!(
            "{target}.toggleAttribute(\"disabled\", Boolean({expression})); {target}.disabled = Boolean({expression});"
        );
    }
    let value_variable = format!("{}_{}_value", target_key, name.replace('-', "_"));
    if name.starts_with("aria-") {
        return format!(
            "const {value_variable} = {expression}; if ({value_variable} == null) {{ {target}.removeAttribute(\"{name}\"); }} else {{ {target}.setAttribute(\"{name}\", String({value_variable})); }}"
        );
    }
    if name == "value" {
        return format!(
            "const {value_variable} = {expression}; if ({value_variable} == null || {value_variable} === false) {{ {target}.removeAttribute(\"value\"); {target}.value = \"\"; }} else {{ {target}.setAttribute(\"value\", String({value_variable})); {target}.value = String({value_variable}); }}"
        );
    }
    format!(
        "const {value_variable} = {expression}; if ({value_variable} == null || {value_variable} === false) {{ {target}.removeAttribute(\"{name}\"); }} else {{ {target}.setAttribute(\"{name}\", String({value_variable})); }}"
    )
}

fn text_expression(text: &str) -> Option<String> {
    let chunks = text_chunks(text);
    if chunks.is_empty() {
        return None;
    }
    let expression = chunks
        .into_iter()
        .map(|chunk| match chunk {
            TextChunk::Raw(value) => format!("\"{}\"", escape_js_string(&value)),
            TextChunk::Expression(value) => format!("String({value})"),
        })
        .collect::<Vec<_>>()
        .join(" + ");
    Some(expression)
}

fn validate_child_expression(expression: &str, span: Option<DiagnosticSpan>) -> CompilerResult<()> {
    if !contains_jsx_tag_start(expression) {
        return Ok(());
    }
    if expression.contains(".map(") {
        return Err(unsupported_with_code_at(
            DIAGNOSTIC_CODE_UNSUPPORTED_LIST_RENDERER,
            "Unsupported JSX array mapping. Use items().map((item) => <Row key={item.id} />) with a JSX element expression body.",
            DIAGNOSTIC_HINT_LISTS,
            span,
        ));
    }
    if expression.contains('?') || expression.contains("&&") || expression.contains("||") {
        return Err(unsupported_with_code_at(
            DIAGNOSTIC_CODE_UNSUPPORTED_CONDITIONAL_JSX,
            "Conditional JSX expressions are not supported. Use explicit <Show> or <Switch>/<Match> control-flow primitives.",
            DIAGNOSTIC_HINT_SHOW,
            span,
        ));
    }
    Err(unsupported_at(
        "JSX expression children are not supported outside explicit compiler primitives.",
        span,
    ))
}

fn contains_jsx_tag_start(expression: &str) -> bool {
    let mut chars = expression.chars().peekable();
    while let Some(ch) = chars.next() {
        if ch != '<' {
            continue;
        }
        let Some(next) = chars.peek().copied() else {
            continue;
        };
        if next == '/' || next.is_ascii_alphabetic() {
            return true;
        }
    }
    false
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum TextChunk {
    Raw(String),
    Expression(String),
}

fn text_chunks(text: &str) -> Vec<TextChunk> {
    let mut chunks = Vec::new();
    let mut position = 0usize;
    while position < text.len() {
        let rest = &text[position..];
        let Some(open_relative) = rest.find('{') else {
            push_raw_text(&mut chunks, rest);
            break;
        };
        let open = position + open_relative;
        push_raw_text(&mut chunks, &text[position..open]);
        let Some(close_relative) = text[open + 1..].find('}') else {
            push_raw_text(&mut chunks, &text[open..]);
            break;
        };
        let close = open + 1 + close_relative;
        let expression = text[open + 1..close].trim();
        if !expression.is_empty() {
            chunks.push(TextChunk::Expression(expression.to_owned()));
        }
        position = close + 1;
    }
    chunks
}

fn push_raw_text(chunks: &mut Vec<TextChunk>, value: &str) {
    let normalized = normalize_jsx_text(value);
    if !normalized.is_empty() {
        chunks.push(TextChunk::Raw(normalized));
    }
}

fn normalize_jsx_text(value: &str) -> String {
    let collapsed = value.split_whitespace().collect::<Vec<_>>().join(" ");
    if collapsed.is_empty() {
        return collapsed;
    }
    let prefix = value
        .chars()
        .next()
        .filter(|ch| ch.is_whitespace())
        .map(|_| " ")
        .unwrap_or("");
    let suffix = value
        .chars()
        .last()
        .filter(|ch| ch.is_whitespace())
        .map(|_| " ")
        .unwrap_or("");
    format!("{prefix}{collapsed}{suffix}")
}

fn handler_body(expression: &str, signal_argument: &str) -> String {
    let trimmed = expression.trim();
    if trimmed.contains("=>") || trimmed.starts_with("function") {
        format!("({trimmed})(event, {signal_argument});")
    } else {
        format!("{trimmed}(event, {signal_argument});")
    }
}

fn split_top_level_commas(source: &str) -> Vec<&str> {
    let mut parts = Vec::new();
    let mut start = 0usize;
    let mut depth = 0usize;
    let mut in_string: Option<char> = None;
    let mut escaped = false;

    for (index, ch) in source.char_indices() {
        if let Some(quote) = in_string {
            if escaped {
                escaped = false;
                continue;
            }
            if ch == '\\' {
                escaped = true;
                continue;
            }
            if ch == quote {
                in_string = None;
            }
            continue;
        }

        if matches!(ch, '"' | '\'' | '`') {
            in_string = Some(ch);
            continue;
        }

        if matches!(ch, '(' | '[' | '{') {
            depth += 1;
        } else if matches!(ch, ')' | ']' | '}') {
            depth = depth.saturating_sub(1);
        } else if ch == ',' && depth == 0 {
            parts.push(&source[start..index]);
            start = index + ch.len_utf8();
        }
    }

    if start <= source.len() {
        parts.push(&source[start..]);
    }
    parts
}

fn strip_wrapping_parentheses(source: &str) -> &str {
    let trimmed = source.trim();
    if trimmed.starts_with('(')
        && trimmed.ends_with(')')
        && find_matching_delimiter(trimmed, 0, '(', ')').ok() == Some(trimmed.len() - 1)
    {
        return trimmed[1..trimmed.len() - 1].trim();
    }
    trimmed
}

fn is_identifier(source: &str) -> bool {
    let mut chars = source.chars();
    let Some(first) = chars.next() else {
        return false;
    };
    if !(first.is_ascii_alphabetic() || matches!(first, '_' | '$')) {
        return false;
    }
    chars.all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '_' | '$'))
}

fn find_matching_delimiter(
    source: &str,
    open_index: usize,
    open: char,
    close: char,
) -> CompilerResult<usize> {
    let mut depth = 0usize;
    let mut in_string: Option<char> = None;
    let mut escaped = false;

    for (offset, ch) in source[open_index..].char_indices() {
        let absolute = open_index + offset;
        if let Some(quote) = in_string {
            if escaped {
                escaped = false;
                continue;
            }
            if ch == '\\' {
                escaped = true;
                continue;
            }
            if ch == quote {
                in_string = None;
            }
            continue;
        }

        if matches!(ch, '"' | '\'' | '`') {
            in_string = Some(ch);
            continue;
        }

        if ch == open {
            depth += 1;
        } else if ch == close {
            depth = depth.saturating_sub(1);
            if depth == 0 {
                return Ok(absolute);
            }
        }
    }

    Err(unsupported("source contains an unmatched delimiter."))
}

fn binding_names(module: &ComponentModule) -> Vec<String> {
    binding_names_with_refs(module, &[])
}

fn binding_names_with_refs(module: &ComponentModule, ref_names: &[String]) -> Vec<String> {
    let mut names = module
        .props
        .iter()
        .map(|prop| prop.local_name.clone())
        .chain(module.states.iter().map(|state| state.local_name.clone()))
        .chain(
            module
                .computed
                .iter()
                .map(|computed| computed.local_name.clone()),
        )
        .chain(
            module
                .keyed_selectors
                .iter()
                .map(|selector| selector.local_name.clone()),
        )
        .chain(module.events.iter().map(|event| event.local_name.clone()))
        .collect::<Vec<_>>();
    names.extend(ref_names.iter().cloned());
    if module.uses_host_helpers {
        names.push("host".to_owned());
    }
    names
}

fn is_ref_callback_expression(expression: &str) -> bool {
    let trimmed = expression.trim();
    trimmed.contains("=>")
}

fn escape_js_string(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', "\\n")
        .replace('\r', "\\r")
}

fn attribute_name_for_element(name: &str, is_component_element: bool) -> String {
    if is_component_element && !name.starts_with("data-") && !name.starts_with("aria-") {
        return kebab_case_identifier(name);
    }
    name.to_owned()
}

fn format_error(error: std::fmt::Error) -> CompilerError {
    unsupported(format!("Failed to generate component source: {error}"))
}

fn source_map_for_transform(source: &str, filename: &str, code: &str) -> SourceMap {
    SourceMap {
        file: filename.to_owned(),
        mappings: source_map_line_mappings(source, code),
        names: Vec::new(),
        sources: vec![filename.to_owned()],
        sources_content: vec![source.to_owned()],
        version: 3,
    }
}

#[derive(Debug)]
struct SourceMapAnchor<'a> {
    column: usize,
    line: usize,
    text: &'a str,
}

fn source_map_line_mappings(source: &str, code: &str) -> String {
    let anchors = source
        .lines()
        .enumerate()
        .filter_map(|(line, source_line)| {
            let text = source_line.trim();
            if text.len() < 4 || matches!(text, "return (" | "})" | "};") {
                return None;
            }
            let byte_column = source_line.find(text)?;
            Some(SourceMapAnchor {
                column: utf16_column(source_line, byte_column),
                line,
                text,
            })
        })
        .collect::<Vec<_>>();
    let fallback = anchors
        .iter()
        .find(|anchor| {
            anchor.text.contains("export function ") || anchor.text.starts_with("function ")
        })
        .or_else(|| anchors.first());
    let Some(fallback) = fallback else {
        return std::iter::repeat_n("", code.lines().count().max(1))
            .collect::<Vec<_>>()
            .join(";");
    };

    let mut previous_source = 0_i64;
    let mut previous_line = 0_i64;
    let mut previous_column = 0_i64;
    code.lines()
        .map(|generated_line| {
            let matched = anchors
                .iter()
                .filter_map(|anchor| {
                    generated_line
                        .find(anchor.text)
                        .map(|generated_byte_column| (anchor, generated_byte_column))
                })
                .max_by_key(|(anchor, _)| anchor.text.len());
            let (anchor, generated_byte_column) = matched.unwrap_or((fallback, 0));
            let generated_column = utf16_column(generated_line, generated_byte_column) as i64;
            let source_index = 0_i64;
            let original_line = anchor.line as i64;
            let original_column = anchor.column as i64;
            let segment = [
                generated_column,
                source_index - previous_source,
                original_line - previous_line,
                original_column - previous_column,
            ]
            .into_iter()
            .map(encode_vlq)
            .collect::<String>();
            previous_source = source_index;
            previous_line = original_line;
            previous_column = original_column;
            segment
        })
        .collect::<Vec<_>>()
        .join(";")
}

fn utf16_column(line: &str, byte_column: usize) -> usize {
    line[..byte_column].encode_utf16().count()
}

fn encode_vlq(value: i64) -> String {
    const BASE64: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut encoded = String::new();
    let mut remaining = if value < 0 {
        ((-value) as u64) << 1 | 1
    } else {
        (value as u64) << 1
    };
    loop {
        let mut digit = (remaining & 31) as usize;
        remaining >>= 5;
        if remaining > 0 {
            digit |= 32;
        }
        encoded.push(BASE64[digit] as char);
        if remaining == 0 {
            break;
        }
    }
    encoded
}

#[cfg(test)]
mod dependency_tests {
    use std::collections::BTreeSet;

    use super::{CodeGenerator, encode_vlq, identifier_uses, source_map_line_mappings};
    use crate::model::PackageContext;
    use crate::parse::analyze_component_module;

    #[test]
    fn light_dom_styles_should_adopt_into_the_root_node() {
        let source = "export const options = { styles: [\":x-light-probe { display: block; }\"] }\n\nexport function LightProbe() {\n  return <span>Light</span>\n}\n";
        let package = PackageContext {
            name: "@naos-ui/test".to_owned(),
            version: Some("1.0.0".to_owned()),
            tag_prefix: "x".to_owned(),
        };
        let mut module = analyze_component_module(source, "light-probe.wc.tsx", &package)
            .expect("light probe should analyze");
        // The public v0.1 API rejects `shadow: false`; this exercises the
        // internal light-DOM branch so styles are never dropped silently.
        module.options.shadow = false;
        let code = CodeGenerator::new(&module)
            .generate(&module.template)
            .expect("light probe should generate");

        assert!(code.contains("function __naosComponentStyles()"));
        assert!(code.contains("const root = this.getRootNode();"));
        assert!(code.contains("root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];"));
        assert!(code.contains("this.#adoptStyles();"));
        assert!(!code.contains("document.createElement(\"style\")"));
    }

    #[test]
    fn source_map_mappings_should_track_authored_lines() {
        let source =
            "export function Probe() {\n  effect(() => {\n    throw new Error(\"boom\");\n  });\n}";
        let code = "class ProbeElement {\n  run() {\n    throw new Error(\"boom\");\n  }\n}";
        let mappings = source_map_line_mappings(source, code);

        assert_eq!(mappings.split(';').count(), code.lines().count());
        assert_ne!(
            mappings,
            std::iter::repeat_n("AAAA", code.lines().count())
                .collect::<Vec<_>>()
                .join(";")
        );
        assert!(mappings.split(';').collect::<BTreeSet<_>>().len() > 1);
    }

    #[test]
    fn source_map_vlq_should_encode_signed_deltas() {
        assert_eq!(encode_vlq(0), "A");
        assert_eq!(encode_vlq(1), "C");
        assert_eq!(encode_vlq(-1), "D");
        assert_eq!(encode_vlq(16), "gB");
    }

    #[test]
    fn ast_dependency_visitor_parses_effect_block_bodies() {
        let identifiers = identifier_uses(
            r#"{
                const runs = Number(document.body.dataset.runs ?? "0") + 1;
                document.body.dataset.value = String(primary());
            }"#,
        )
        .expect("valid effect block should parse");

        assert!(
            identifiers
                .iter()
                .any(|identifier| identifier.name == "primary" && identifier.is_call)
        );
    }

    #[test]
    fn ast_dependency_visitor_ignores_lexically_shadowed_callback_bindings() {
        let identifiers = identifier_uses(
            r#"items().map(({ count }) => `${count}-${label}-${/a{2}/.test(note)}`)"#,
        )
        .expect("valid JavaScript expression should parse");

        assert!(
            identifiers
                .iter()
                .any(|identifier| identifier.name == "items" && identifier.is_call)
        );
        assert!(
            identifiers
                .iter()
                .any(|identifier| identifier.name == "label" && !identifier.is_call)
        );
        assert!(
            identifiers
                .iter()
                .any(|identifier| identifier.name == "note" && !identifier.is_call)
        );
        assert!(
            !identifiers
                .iter()
                .any(|identifier| identifier.name == "count")
        );
        assert!(
            !identifiers
                .iter()
                .any(|identifier| identifier.name == "test")
        );
    }

    #[test]
    fn ast_dependency_visitor_ignores_classic_function_callback_bindings() {
        let identifiers = identifier_uses(
            r#"items().map(function countMapper(count) { return `${count}-${label}`; })"#,
        )
        .expect("valid JavaScript expression should parse");

        assert!(
            identifiers
                .iter()
                .any(|identifier| identifier.name == "items" && identifier.is_call)
        );
        assert!(
            identifiers
                .iter()
                .any(|identifier| identifier.name == "label" && !identifier.is_call)
        );
        assert!(
            !identifiers
                .iter()
                .any(|identifier| identifier.name == "count")
        );
    }
}
