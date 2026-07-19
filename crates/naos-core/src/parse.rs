use crate::ast::{
    AstComponentSemantics, AstFunctionComponent, AstModuleFacts, SourceSpan, analyze_module,
};
use crate::error::{
    CompilerError, CompilerResult, DIAGNOSTIC_CODE_COMPONENT_TEMPLATE_REQUIRED,
    DIAGNOSTIC_CODE_PROP_TYPE_MISMATCH, DIAGNOSTIC_CODE_UNSUPPORTED_FUNCTION_PROPS,
    DIAGNOSTIC_HINT_FUNCTION_COMPONENT, DIAGNOSTIC_HINT_FUNCTION_PROPS, DIAGNOSTIC_HINT_PROP_TYPES,
    unsupported, unsupported_with_code,
};
use crate::model::{
    ComponentImport, ComponentModule, ComponentOptions, PackageContext, PropAccess, PropDefinition,
    PropKind, RuntimeImport, StyleImport,
};
use crate::naming::{custom_element_tag_for_component, kebab_case_identifier};

/// Analyzes a TSX module containing an Naos component definition.
///
/// # Errors
///
/// Returns [`CompilerError`] when the source does not parse as TSX or when no
/// supported PascalCase function component can be found.
pub fn analyze_component_module(
    source: &str,
    filename: &str,
    package: &PackageContext,
) -> CompilerResult<ComponentModule> {
    let ast_facts = analyze_module(source, filename)?;

    let component_imports = ast_facts.component_imports.clone();
    let runtime_imports = ast_facts.runtime_imports.clone();
    let style_imports = ast_facts.style_imports.clone();
    let component_options = ast_facts.component_options.clone();
    let clx_local = ast_facts.clx_local.clone();
    if let Some(function_component) = capture_function_component(source, &ast_facts)? {
        return analyze_function_component(
            function_component,
            source,
            component_imports,
            runtime_imports,
            style_imports,
            component_options,
            clx_local,
            package,
        );
    }

    Err(CompilerError::ComponentNotFound {
        filename: filename.to_owned(),
    })
}

struct FunctionComponent<'a> {
    name: String,
    params: &'a str,
    semantics: AstComponentSemantics,
}

#[allow(clippy::too_many_arguments)]
fn analyze_function_component(
    function_component: FunctionComponent<'_>,
    source: &str,
    component_imports: Vec<ComponentImport>,
    runtime_imports: Vec<RuntimeImport>,
    style_imports: Vec<StyleImport>,
    component_options: ComponentOptions,
    clx_local: Option<String>,
    package: &PackageContext,
) -> CompilerResult<ComponentModule> {
    let tag_name = custom_element_tag_for_component(&function_component.name, package)?;
    let class_name = format!("{}Element", function_component.name);
    Ok(ComponentModule {
        package: package.clone(),
        class_name,
        tag_name,
        export_name: Some(function_component.name),
        options: component_options,
        component_imports,
        runtime_imports,
        style_imports,
        props: capture_function_props(function_component.params, source)?,
        states: function_component.semantics.states,
        form_controls: function_component.semantics.form_controls,
        computed: function_component.semantics.computed,
        keyed_selectors: function_component.semantics.keyed_selectors,
        effects: function_component.semantics.effects,
        connected_callbacks: function_component.semantics.connected_callbacks,
        disconnected_callbacks: function_component.semantics.disconnected_callbacks,
        uses_host_helpers: function_component.semantics.uses_host_helpers,
        clx_local,
        events: function_component.semantics.events,
        template: function_component.semantics.template.ok_or_else(|| {
            unsupported_with_code(
                DIAGNOSTIC_CODE_COMPONENT_TEMPLATE_REQUIRED,
                "Function components must return a TSX template.",
                DIAGNOSTIC_HINT_FUNCTION_COMPONENT,
            )
        })?,
    })
}

fn capture_function_component<'a>(
    source: &'a str,
    ast_facts: &AstModuleFacts,
) -> CompilerResult<Option<FunctionComponent<'a>>> {
    if let Some(component) = ast_facts.function_components.first() {
        return Ok(Some(FunctionComponent {
            name: component.name.clone(),
            params: function_params_source(source, component)?,
            semantics: component.semantics.clone(),
        }));
    }

    Ok(None)
}

fn function_params_source<'a>(
    source: &'a str,
    component: &AstFunctionComponent,
) -> CompilerResult<&'a str> {
    let params = source_span(source, component.params)?.trim();
    Ok(strip_optional_delimiters(params, '(', ')'))
}

fn source_span(source: &str, span: SourceSpan) -> CompilerResult<&str> {
    source
        .get(span.start..span.end)
        .ok_or_else(|| unsupported("OXC AST span did not align with source text."))
}

fn strip_optional_delimiters(source: &str, open: char, close: char) -> &str {
    let trimmed = source.trim();
    if trimmed.starts_with(open) && trimmed.ends_with(close) {
        return trimmed[open.len_utf8()..trimmed.len() - close.len_utf8()].trim();
    }
    trimmed
}

fn capture_function_props(params: &str, source: &str) -> CompilerResult<Vec<PropDefinition>> {
    let Some(open) = params.find('{') else {
        return Ok(Vec::new());
    };
    let close = find_matching_delimiter(params, open, '{', '}')?;
    let destructured = &params[open + 1..close];
    let annotated_types = capture_prop_type_annotations(&params[close + 1..], source)?;
    let mut props = Vec::new();

    for prop_source in split_top_level_commas(destructured) {
        let prop_source = prop_source.trim();
        if prop_source.is_empty() {
            continue;
        }
        if prop_source.starts_with("...") {
            return Err(unsupported_with_code(
                DIAGNOSTIC_CODE_UNSUPPORTED_FUNCTION_PROPS,
                "Function component rest props are not supported in the current compiler milestone.",
                DIAGNOSTIC_HINT_FUNCTION_PROPS,
            ));
        }
        props.push(parse_function_prop(prop_source, &annotated_types)?);
    }

    Ok(props)
}

/// Extracts `prop name -> TypeScript type text` from the props annotation that
/// follows the destructuring pattern (`}: CounterProps = {}` or an inline
/// `}: { disabled: boolean } = {}`), resolving locally declared `type` aliases
/// and `interface` bodies textually. Unresolvable annotations yield an empty
/// map so prop kinds fall back to literal-default inference.
fn capture_prop_type_annotations(
    after_pattern: &str,
    source: &str,
) -> CompilerResult<Vec<(String, String)>> {
    let trimmed = after_pattern.trim_start();
    let Some(annotation) = trimmed.strip_prefix(':') else {
        return Ok(Vec::new());
    };
    let annotation = top_level_annotation_text(annotation).trim();
    let body = if annotation.starts_with('{') {
        annotation.to_owned()
    } else if let Some(body) = resolve_named_type_body(annotation, source)? {
        body
    } else {
        return Ok(Vec::new());
    };

    let Some(open) = body.find('{') else {
        return Ok(Vec::new());
    };
    let close = find_matching_delimiter(&body, open, '{', '}')?;
    let members = strip_type_comments(&body[open + 1..close]);

    let mut annotations = Vec::new();
    for member in split_top_level_members(&members) {
        let member = member.trim();
        if member.is_empty() {
            continue;
        }
        let Some((name_source, type_text)) = member.split_once(':') else {
            continue;
        };
        let name = strip_readonly_modifier(name_source.trim())
            .trim_end_matches('?')
            .trim();
        if name.is_empty() || !name.chars().all(|ch| ch.is_alphanumeric() || ch == '_') {
            continue;
        }
        annotations.push((name.to_owned(), type_text.trim().to_owned()));
    }
    Ok(annotations)
}

/// Strips a leading `readonly` modifier only when it is a whole word, so a
/// member named `readonly_value` keeps its full name.
fn strip_readonly_modifier(source: &str) -> &str {
    if let Some(rest) = source.strip_prefix("readonly")
        && rest.chars().next().is_some_and(char::is_whitespace)
    {
        return rest.trim_start();
    }
    source
}

/// Removes `//` line comments and `/* */` block comments from a type-literal
/// body, preserving quoted string-literal types.
fn strip_type_comments(source: &str) -> String {
    let mut output = String::with_capacity(source.len());
    let mut chars = source.chars().peekable();
    let mut in_quote: Option<char> = None;
    while let Some(ch) = chars.next() {
        if let Some(quote) = in_quote {
            output.push(ch);
            if ch == quote {
                in_quote = None;
            }
            continue;
        }
        match ch {
            '"' | '\'' | '`' => {
                in_quote = Some(ch);
                output.push(ch);
            }
            '/' if chars.peek() == Some(&'/') => {
                while let Some(&next) = chars.peek() {
                    if next == '\n' {
                        break;
                    }
                    chars.next();
                }
            }
            '/' if chars.peek() == Some(&'*') => {
                chars.next();
                let mut previous = ' ';
                for next in chars.by_ref() {
                    if previous == '*' && next == '/' {
                        break;
                    }
                    previous = next;
                }
                output.push(' ');
            }
            _ => output.push(ch),
        }
    }
    output
}

/// Returns the annotation text up to a top-level `=` (the params default).
fn top_level_annotation_text(annotation: &str) -> &str {
    let mut depth = 0usize;
    for (index, ch) in annotation.char_indices() {
        match ch {
            '(' | '[' | '{' | '<' => depth += 1,
            ')' | ']' | '}' | '>' => depth = depth.saturating_sub(1),
            '=' if depth == 0 => return &annotation[..index],
            _ => {}
        }
    }
    annotation
}

/// Resolves `type Name = { ... }` or `interface Name { ... }` declared in the
/// module source. Returns `None` for anything it cannot resolve textually.
fn resolve_named_type_body(name: &str, source: &str) -> CompilerResult<Option<String>> {
    if name.is_empty() || !name.chars().all(|ch| ch.is_alphanumeric() || ch == '_') {
        return Ok(None);
    }
    for keyword in ["type", "interface"] {
        let mut search_start = 0usize;
        while let Some(found) = source[search_start..].find(keyword) {
            let index = search_start + found;
            search_start = index + keyword.len();
            let preceded_ok = index == 0
                || source[..index]
                    .chars()
                    .next_back()
                    .is_none_or(|ch| !ch.is_alphanumeric() && ch != '_');
            if !preceded_ok {
                continue;
            }
            let rest = &source[index + keyword.len()..];
            // The keyword must be a whole word (`typeMyWidget` is an
            // identifier, not a `type` declaration for `MyWidget`).
            if !rest.chars().next().is_some_and(char::is_whitespace) {
                continue;
            }
            let rest_trimmed = rest.trim_start();
            let Some(after_name) = rest_trimmed.strip_prefix(name) else {
                continue;
            };
            // The name must also end at a word boundary so `CardProps` does
            // not match a `CardPropsExtra` declaration.
            if after_name
                .chars()
                .next()
                .is_some_and(|ch| ch.is_alphanumeric() || ch == '_')
            {
                continue;
            }
            let after_name_trimmed = after_name.trim_start();
            let body_candidate = if keyword == "type" {
                let Some(after_equals) = after_name_trimmed.strip_prefix('=') else {
                    continue;
                };
                after_equals.trim_start()
            } else {
                after_name_trimmed
            };
            if !body_candidate.starts_with('{') {
                return Ok(None);
            }
            let close = find_matching_delimiter(body_candidate, 0, '{', '}')?;
            return Ok(Some(body_candidate[..=close].to_owned()));
        }
    }
    Ok(None)
}

/// Splits type-literal members on top-level `;`, `,`, and newlines.
fn split_top_level_members(members: &str) -> Vec<&str> {
    let mut parts = Vec::new();
    let mut start = 0usize;
    let mut depth = 0usize;
    for (index, ch) in members.char_indices() {
        match ch {
            '(' | '[' | '{' | '<' => depth += 1,
            ')' | ']' | '}' | '>' => depth = depth.saturating_sub(1),
            ';' | ',' | '\n' if depth == 0 => {
                parts.push(&members[start..index]);
                start = index + ch.len_utf8();
            }
            _ => {}
        }
    }
    if start <= members.len() {
        parts.push(&members[start..]);
    }
    parts
}

/// Maps a TypeScript type text onto a prop kind. `None` means the member has
/// no usable annotation and literal-default inference applies.
fn prop_kind_for_annotation(type_text: &str) -> Option<PropKind> {
    let mut kinds = Vec::new();
    for part in split_top_level_union(type_text) {
        let part = part.trim();
        if part.is_empty() || part == "undefined" || part == "null" {
            continue;
        }
        let kind = if part == "boolean" || part == "true" || part == "false" {
            PropKind::Boolean
        } else if part == "number" || part.parse::<f64>().is_ok() {
            PropKind::Number
        } else if part == "string" || is_quoted_literal(part) {
            PropKind::String
        } else {
            PropKind::Rich
        };
        kinds.push(kind);
    }
    let first = *kinds.first()?;
    if kinds.iter().all(|kind| *kind == first) {
        Some(first)
    } else {
        // Mixed primitive unions cannot reflect losslessly; keep them
        // property-only rather than degrading to string coercion.
        Some(PropKind::Rich)
    }
}

fn split_top_level_union(type_text: &str) -> Vec<&str> {
    let mut parts = Vec::new();
    let mut start = 0usize;
    let mut depth = 0usize;
    for (index, ch) in type_text.char_indices() {
        match ch {
            '(' | '[' | '{' | '<' => depth += 1,
            ')' | ']' | '}' | '>' => depth = depth.saturating_sub(1),
            '|' if depth == 0 => {
                parts.push(&type_text[start..index]);
                start = index + ch.len_utf8();
            }
            _ => {}
        }
    }
    if start <= type_text.len() {
        parts.push(&type_text[start..]);
    }
    parts
}

fn is_quoted_literal(part: &str) -> bool {
    (part.starts_with('"') && part.ends_with('"') && part.len() >= 2)
        || (part.starts_with('\'') && part.ends_with('\'') && part.len() >= 2)
        || (part.starts_with('`') && part.ends_with('`') && part.len() >= 2)
}

/// Classifies a default literal, or `None` when the default is not a literal
/// (arbitrary expressions never conflict with the annotation).
fn literal_kind_for_default(default_value: &str) -> Option<PropKind> {
    let trimmed = default_value.trim();
    if matches!(trimmed, "true" | "false") {
        Some(PropKind::Boolean)
    } else if trimmed.parse::<f64>().is_ok() {
        Some(PropKind::Number)
    } else if is_quoted_literal(trimmed) {
        Some(PropKind::String)
    } else {
        None
    }
}

fn parse_function_prop(
    prop_source: &str,
    annotated_types: &[(String, String)],
) -> CompilerResult<PropDefinition> {
    let (binding_source, default_value) = prop_source
        .split_once('=')
        .map(|(binding, default_value)| (binding.trim(), default_value.trim()))
        .unwrap_or((prop_source.trim(), ""));
    let (prop_name_source, local_name_source) = binding_source
        .split_once(':')
        .map(|(prop_name, local_name)| (prop_name.trim(), local_name.trim()))
        .unwrap_or((binding_source, binding_source));
    let local_name = local_name_source
        .split_whitespace()
        .next()
        .ok_or_else(|| unsupported("Function component prop binding is missing a local name."))?;

    if local_name.is_empty() || prop_name_source.is_empty() {
        return Err(unsupported_with_code(
            DIAGNOSTIC_CODE_UNSUPPORTED_FUNCTION_PROPS,
            "Function component prop binding must have a name.",
            DIAGNOSTIC_HINT_FUNCTION_PROPS,
        ));
    }

    let annotated_kind = annotated_types
        .iter()
        .find(|(name, _)| name == prop_name_source)
        .and_then(|(_, type_text)| prop_kind_for_annotation(type_text));
    let kind = annotated_kind.unwrap_or_else(|| prop_kind_for_default(default_value));

    if let (Some(annotation_kind), Some(default_kind)) =
        (annotated_kind, literal_kind_for_default(default_value))
        && annotation_kind != PropKind::Rich
        && annotation_kind != default_kind
    {
        return Err(unsupported_with_code(
            DIAGNOSTIC_CODE_PROP_TYPE_MISMATCH,
            format!(
                "Prop `{prop_name_source}` declares a {} type but its default literal {default_value} is a {} value.",
                kind_label(annotation_kind),
                kind_label(default_kind)
            ),
            DIAGNOSTIC_HINT_PROP_TYPES,
        ));
    }

    Ok(PropDefinition {
        local_name: local_name.to_owned(),
        prop_name: prop_name_source.to_owned(),
        attribute_name: kebab_case_identifier(prop_name_source),
        kind,
        default_value: if default_value.is_empty() {
            default_for_kind(kind)
        } else {
            default_value.to_owned()
        },
        access: PropAccess::Value,
    })
}

fn kind_label(kind: PropKind) -> &'static str {
    match kind {
        PropKind::String => "string",
        PropKind::Boolean => "boolean",
        PropKind::Number => "number",
        PropKind::Rich => "rich",
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

fn prop_kind_for_default(default_value: &str) -> PropKind {
    let trimmed = default_value.trim();
    if matches!(trimmed, "true" | "false") {
        PropKind::Boolean
    } else if trimmed.parse::<f64>().is_ok() {
        PropKind::Number
    } else {
        PropKind::String
    }
}

fn default_for_kind(kind: PropKind) -> String {
    match kind {
        PropKind::String => "\"\"".to_owned(),
        PropKind::Boolean => "false".to_owned(),
        PropKind::Number => "0".to_owned(),
        PropKind::Rich => "undefined".to_owned(),
    }
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
        if let Some(string_quote) = in_string {
            if escaped {
                escaped = false;
                continue;
            }
            if ch == '\\' {
                escaped = true;
                continue;
            }
            if ch == string_quote {
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
