use serde::{Deserialize, Serialize};

/// Package identity used to derive stable Custom Element names.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PackageContext {
    /// Package name read from the owning `package.json`.
    pub name: String,
    /// Optional package version read from the owning `package.json`.
    pub version: Option<String>,
    /// Validated package-specific Custom Element prefix.
    pub tag_prefix: String,
}

/// Statically analyzed component module.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ComponentModule {
    /// Package identity that owns this component.
    pub package: PackageContext,
    /// Package-stable Custom Element tag name, for example `acme-counter`.
    pub tag_name: String,
    /// JavaScript class name derived from the tag name.
    pub class_name: String,
    /// Public authoring export name, when the source used function component syntax.
    pub export_name: Option<String>,
    /// Component options captured from the component declaration.
    pub options: ComponentOptions,
    /// Component imports that should be preserved for nested Custom Element registration.
    pub component_imports: Vec<ComponentImport>,
    /// Runtime imports preserved for helper functions used in generated code.
    pub runtime_imports: Vec<RuntimeImport>,
    /// Inline CSS imports referenced by component styles.
    pub style_imports: Vec<StyleImport>,
    /// Public props declared through function parameters.
    pub props: Vec<PropDefinition>,
    /// Internal state declarations.
    pub states: Vec<StateDefinition>,
    /// Form-associated custom element declaration.
    pub form_controls: Vec<FormControlDefinition>,
    /// Pure derived value declarations.
    pub computed: Vec<ComputedDefinition>,
    /// Compiler-recognized keyed boolean selector declarations.
    pub keyed_selectors: Vec<KeyedSelectorDefinition>,
    /// Lifecycle side effect declarations.
    pub effects: Vec<EffectDefinition>,
    /// Connected lifecycle callbacks.
    pub connected_callbacks: Vec<LifecycleCallbackDefinition>,
    /// Disconnected lifecycle callbacks.
    pub disconnected_callbacks: Vec<LifecycleCallbackDefinition>,
    /// Whether the component body references `host()`.
    pub uses_host_helpers: bool,
    /// Local binding name of the `clx` class helper imported from `@naos-ui/core`.
    pub clx_local: Option<String>,
    /// Custom event declarations.
    pub events: Vec<EventDefinition>,
    /// Structured JSX template returned by the component callback.
    pub template: TemplateElement,
}

/// Owned JSX element lowered from the OXC syntax tree.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TemplateElement {
    /// Element or component tag name.
    pub tag_name: String,
    /// Source span of the authored JSX element, when known.
    pub span: Option<DiagnosticSpan>,
    /// Authored attributes in source order.
    pub attributes: Vec<TemplateAttribute>,
    /// Authored child nodes in source order.
    pub children: Vec<TemplateChild>,
}

/// Owned JSX attribute lowered from the OXC syntax tree.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum TemplateAttribute {
    /// A named JSX attribute.
    Named {
        /// Attribute name.
        name: String,
        /// Attribute value.
        value: AttributeValue,
    },
    /// A JSX spread attribute expression.
    Spread {
        /// Authored spread expression source.
        expression: String,
    },
}

/// Owned JSX attribute value.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum AttributeValue {
    /// A static string value.
    Static(String),
    /// A dynamic expression value.
    Expression(String),
    /// A JSX event handler lowered into compiler-owned listener semantics.
    EventHandler(TemplateEventHandler),
    /// A nested JSX element attribute value.
    Element(TemplateElement),
    /// A boolean JSX attribute without an explicit value.
    Boolean,
}

/// Structured event handler captured from a JSX event attribute.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TemplateEventHandler {
    /// Authored handler expression, without the optional `on()` wrapper.
    pub handler_expression: String,
    /// Authored `AddEventListenerOptions` expression, when supplied through `on()`.
    pub options_expression: Option<String>,
}

/// Owned JSX child node.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum TemplateChild {
    /// A nested JSX element.
    Element(TemplateElement),
    /// A dynamic keyed list lowered from `.map()`, `<For>`, or `<Index>`.
    List(TemplateList),
    /// A dynamic JSX expression.
    Expression(String),
    /// A JSX text node.
    Text(String),
}

/// Owned dynamic-list renderer lowered from the OXC syntax tree.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TemplateList {
    /// Authored collection expression.
    pub each_expression: String,
    /// Source span of the authored list expression, when known.
    pub span: Option<DiagnosticSpan>,
    /// Callback item parameter name.
    pub item_name: String,
    /// Callback index parameter name.
    pub index_name: String,
    /// Reconciliation strategy and its required data.
    pub kind: TemplateListKind,
    /// Optional list motion behavior.
    pub motion: Option<TemplateListMotion>,
    /// Structured JSX row template.
    pub template: TemplateElement,
}

/// Reconciliation strategy for a dynamic list.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum TemplateListKind {
    /// Items retain identity through an authored root `key` attribute.
    ItemKeyed {
        /// Required key value for every item-keyed renderer.
        key: TemplateListKey,
    },
    /// Rows retain identity by collection index.
    IndexKeyed,
}

/// Authored key value for an item-keyed list.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum TemplateListKey {
    /// Dynamic key expression.
    Expression(String),
    /// Static key value.
    Static(String),
}

/// Supported motion behavior for dynamic lists.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TemplateListMotion {
    /// Animate retained rows from their previous to their next position.
    Flip,
}

/// Imported component used as a PascalCase JSX element.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ComponentImport {
    /// Imported export name from the source module.
    pub imported_name: String,
    /// Local binding name used in the current module.
    pub local_name: String,
    /// Import source specifier.
    pub source: String,
}

/// Runtime import that should be preserved in generated output.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RuntimeImport {
    /// Raw import declaration source.
    pub source: String,
}

/// Imported `?inline` style text binding.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct StyleImport {
    /// Local binding name used in `ComponentOptions.styles`.
    pub local_name: String,
    /// Import source specifier.
    pub source: String,
}

/// Component-level compile options.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ComponentOptions {
    /// Whether the generated component should attach a shadow root.
    pub shadow: bool,
    /// Whether the generated module should call `customElements.define()`.
    pub define: bool,
    /// Style source expressions injected into the shadow root.
    pub styles: Vec<String>,
}

impl Default for ComponentOptions {
    fn default() -> Self {
        Self {
            shadow: true,
            define: true,
            styles: Vec::new(),
        }
    }
}

/// Supported prop conversion kind.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PropKind {
    /// String-valued prop.
    String,
    /// Boolean-valued prop.
    Boolean,
    /// Number-valued prop.
    Number,
    /// Rich property-only prop without attribute reflection.
    Rich,
}

/// How a prop is exposed inside the authored template.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PropAccess {
    /// Function component parameters expose plain local values.
    Value,
}

/// Public prop declaration.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PropDefinition {
    /// Local variable name used in the component callback.
    pub local_name: String,
    /// Public prop name.
    pub prop_name: String,
    /// Observed HTML attribute name.
    pub attribute_name: String,
    /// Attribute conversion kind.
    pub kind: PropKind,
    /// Source text for the default value.
    pub default_value: String,
    /// Whether the authored template reads this prop as a value or accessor.
    pub access: PropAccess,
}

/// Internal state declaration.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct StateDefinition {
    /// Local variable name used in the component callback.
    pub local_name: String,
    /// Source text for the initial value.
    pub initial_value: String,
    /// Authoring function used for this reactive value.
    pub kind: StateKind,
}

/// Form-associated custom element declaration.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct FormControlDefinition {
    /// Local variable name used in the component callback.
    pub local_name: String,
    /// Expression passed to `ElementInternals.setFormValue()`.
    pub value_expression: String,
    /// Optional reset callback body.
    pub reset_body: Option<String>,
    /// Optional prop/local expression used for disabled reflection.
    pub disabled_expression: Option<String>,
}

/// Local reactive authoring declaration.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum StateKind {
    /// Public `state()` declaration.
    State,
}

/// Pure derived value declaration.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ComputedDefinition {
    /// Local variable name used in the component callback.
    pub local_name: String,
    /// Source text for the derived value expression.
    pub expression: String,
}

/// Local keyed selector helper that compares a state value with a key.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct KeyedSelectorDefinition {
    /// Local selector helper name, for example `isSelected`.
    pub local_name: String,
    /// State accessor that drives the selector.
    pub source_name: String,
    /// Key parameter name accepted by the selector helper.
    pub parameter_name: String,
}

/// Lifecycle side effect declaration.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EffectDefinition {
    /// Source text for the effect callback body.
    pub body: String,
}

/// Custom element lifecycle callback declaration.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LifecycleCallbackDefinition {
    /// Source text for the lifecycle callback body.
    pub body: String,
}

/// Custom event declaration.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EventDefinition {
    /// Local variable name used in the component callback.
    pub local_name: String,
    /// Custom event name.
    pub event_name: String,
    /// TypeScript detail type source, when provided.
    pub detail_type: Option<String>,
}

/// Compiler diagnostic severity.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DiagnosticSeverity {
    /// Informational diagnostic.
    Info,
    /// Warning diagnostic.
    Warning,
    /// Error diagnostic.
    Error,
}

/// UTF-8 byte span in the original source.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct DiagnosticSpan {
    /// Inclusive UTF-8 byte offset.
    pub start: usize,
    /// Exclusive UTF-8 byte offset.
    pub end: usize,
}

/// One-based line/column source location resolved from a diagnostic span.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticLocation {
    /// One-based start line.
    pub start_line: usize,
    /// One-based start column, counted in Unicode scalar values.
    pub start_column: usize,
    /// One-based end line.
    pub end_line: usize,
    /// One-based end column, counted in Unicode scalar values.
    pub end_column: usize,
}

/// Structured compiler diagnostic.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CompilerDiagnostic {
    /// Stable diagnostic code.
    pub code: String,
    /// Diagnostic severity.
    pub severity: DiagnosticSeverity,
    /// Human-readable message.
    pub message: String,
    /// Source filename.
    pub filename: String,
    /// Optional UTF-8 source span.
    pub span: Option<DiagnosticSpan>,
    /// Optional line/column location resolved from `span`.
    pub loc: Option<DiagnosticLocation>,
    /// Optional remediation hint.
    pub hint: Option<String>,
}

/// Source map returned by the native compiler transform.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SourceMap {
    /// Source map version.
    pub version: u8,
    /// Generated output filename.
    pub file: String,
    /// Original source filenames.
    pub sources: Vec<String>,
    /// Original source text.
    pub sources_content: Vec<String>,
    /// Symbol names referenced by mappings.
    pub names: Vec<String>,
    /// Source map v3 VLQ mappings.
    pub mappings: String,
}

/// Result of transforming a source module.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TransformResult {
    /// Generated JavaScript module source.
    pub code: String,
    /// Source map generated by the Rust compiler.
    pub map: Option<SourceMap>,
    /// Whether the generated code differs from the input module source.
    pub has_changed: bool,
    /// `?inline` style imports the compiler saw in the module.
    pub style_imports: Vec<StyleImport>,
    /// Custom element tag name derived from the package and component names.
    pub tag_name: String,
    /// JavaScript class name generated for the component.
    pub class_name: String,
    /// Public authoring export name, when the source used function syntax.
    pub export_name: Option<String>,
    /// Whether the component renders into a shadow root.
    pub shadow: bool,
    /// Public prop declarations for typed-element emission.
    pub props: Vec<PropDefinition>,
    /// Typed event declarations for typed-element emission.
    pub events: Vec<EventDefinition>,
    /// Package identity that owns this component.
    pub package: PackageContext,
}

/// Result of prerendering a component as Declarative Shadow DOM HTML.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DeclarativeShadowDomRenderResult {
    /// Package identity that owns this component.
    pub package: PackageContext,
    /// Package-stable Custom Element tag name, for example `acme-counter`.
    pub tag_name: String,
    /// JavaScript class name generated for the component.
    pub class_name: String,
    /// Public authoring export name, when the source used function syntax.
    pub export_name: Option<String>,
    /// Full host HTML containing the declarative shadow template when enabled.
    pub html: String,
    /// The serialized `<template shadowrootmode="open">` fragment, if emitted.
    pub template_html: String,
    /// Whether the component renders into a shadow root.
    pub shadow: bool,
    /// Whether this result used Declarative Shadow DOM output.
    pub uses_declarative_shadow_dom: bool,
}
