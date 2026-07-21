use thiserror::Error;

use crate::model::{CompilerDiagnostic, DiagnosticLocation, DiagnosticSeverity, DiagnosticSpan};

pub(crate) const DIAGNOSTIC_HINT_AUTHORING_LIMITATIONS: &str =
    "Check the v0.1 authoring limitations for supported TSX.";
pub(crate) const DIAGNOSTIC_HINT_COMPONENT_OPTIONS: &str =
    "Use `export const options = { styles: [...] } satisfies ComponentOptions`.";
pub(crate) const DIAGNOSTIC_HINT_DSD_INPUTS: &str =
    "Pass JSON objects for DSD props and inline styles.";
pub(crate) const DIAGNOSTIC_HINT_FUNCTION_COMPONENT: &str =
    "Export a PascalCase instance setup function with a single JSX return value.";
pub(crate) const DIAGNOSTIC_HINT_FUNCTION_PROPS: &str =
    "Declare explicit destructured props with defaults.";
pub(crate) const DIAGNOSTIC_HINT_INSTANCE_SETUP: &str =
    "Return a single JSX template from the component setup function.";
pub(crate) const DIAGNOSTIC_HINT_LISTS: &str =
    "Use a keyed .map() expression or <For> child that returns one JSX element.";
pub(crate) const DIAGNOSTIC_HINT_EVENT_HANDLER: &str =
    "Use a bare handler or `on(handler, options?)`; the JSX attribute supplies the event name.";
pub(crate) const DIAGNOSTIC_HINT_REMOVED_API: &str =
    "Use the v0.1 function component authoring API instead.";
pub(crate) const DIAGNOSTIC_HINT_SHOW: &str =
    "Use explicit <Show when={...} fallback={...}> or <Switch>/<Match> control flow.";
pub(crate) const DIAGNOSTIC_HINT_SWITCH: &str = "Use static <Switch> children with <Match when={...}> arms and one optional trailing <Match> default.";
pub(crate) const DIAGNOSTIC_HINT_PROP_TYPES: &str = "Align the prop's TypeScript annotation and its default literal; string, boolean, and number reflect to attributes while other types stay property-only.";

pub(crate) const DIAGNOSTIC_CODE_DSD_INPUT: &str = "NAOS_DSD_INPUT";
pub(crate) const DIAGNOSTIC_CODE_INVALID_DOM_BACKEND: &str = "NAOS_INVALID_DOM_BACKEND";
pub(crate) const DIAGNOSTIC_CODE_INVALID_PACKAGE_CONTEXT: &str = "NAOS_INVALID_PACKAGE_CONTEXT";
pub(crate) const DIAGNOSTIC_CODE_COMPONENT_TEMPLATE_REQUIRED: &str =
    "NAOS_COMPONENT_TEMPLATE_REQUIRED";
pub(crate) const DIAGNOSTIC_CODE_REMOVED_AUTHORING_API: &str = "NAOS_REMOVED_AUTHORING_API";
#[cfg(test)]
pub(crate) const DIAGNOSTIC_CODE_TEMPLATE_PARSE: &str = "NAOS_TEMPLATE_PARSE";
pub(crate) const DIAGNOSTIC_CODE_TEMPLATE_BACKEND_INELIGIBLE: &str =
    "NAOS_TEMPLATE_BACKEND_INELIGIBLE";
pub(crate) const DIAGNOSTIC_CODE_UNSUPPORTED_COMPONENT_OPTIONS: &str =
    "NAOS_UNSUPPORTED_COMPONENT_OPTIONS";
pub(crate) const DIAGNOSTIC_CODE_UNSUPPORTED_CONDITIONAL_JSX: &str =
    "NAOS_UNSUPPORTED_CONDITIONAL_JSX";
pub(crate) const DIAGNOSTIC_CODE_UNSUPPORTED_COMPUTED_CALLBACK: &str =
    "NAOS_UNSUPPORTED_COMPUTED_CALLBACK";
pub(crate) const DIAGNOSTIC_CODE_UNSUPPORTED_EFFECT_CALLBACK: &str =
    "NAOS_UNSUPPORTED_EFFECT_CALLBACK";
pub(crate) const DIAGNOSTIC_CODE_UNSUPPORTED_FUNCTION_PROPS: &str =
    "NAOS_UNSUPPORTED_FUNCTION_PROPS";
pub(crate) const DIAGNOSTIC_CODE_UNSUPPORTED_FACTORY_RENDER: &str =
    "NAOS_UNSUPPORTED_FACTORY_RENDER";
pub(crate) const DIAGNOSTIC_CODE_UNSUPPORTED_LIST_RENDERER: &str = "NAOS_UNSUPPORTED_LIST_RENDERER";
pub(crate) const DIAGNOSTIC_CODE_UNSUPPORTED_EVENT_HANDLER: &str = "NAOS_UNSUPPORTED_EVENT_HANDLER";
pub(crate) const DIAGNOSTIC_CODE_UNSUPPORTED_SHOW_FALLBACK: &str = "NAOS_UNSUPPORTED_SHOW_FALLBACK";
pub(crate) const DIAGNOSTIC_CODE_UNSUPPORTED_SWITCH_MATCH: &str = "NAOS_UNSUPPORTED_SWITCH_MATCH";
pub(crate) const DIAGNOSTIC_CODE_UNSUPPORTED_SYNTAX: &str = "NAOS_UNSUPPORTED_SYNTAX";
pub(crate) const DIAGNOSTIC_CODE_PROP_TYPE_MISMATCH: &str = "NAOS_PROP_TYPE_MISMATCH";

/// Shared result type for compiler operations.
pub type CompilerResult<T> = Result<T, CompilerError>;

/// Error type for host-neutral compiler failures.
#[derive(Debug, Error)]
pub enum CompilerError {
    /// The TypeScript/TSX parser rejected the module.
    #[error("Parse error in {filename}: {messages}")]
    ParseModuleSource {
        /// Module filename presented to the parser.
        filename: String,
        /// Joined parser diagnostics.
        messages: String,
    },
    /// No supported component declaration could be found.
    #[error("No Naos component declaration was found in {filename}.")]
    ComponentNotFound {
        /// Module filename being analyzed.
        filename: String,
    },
    /// A static compiler pattern failed to compile.
    #[error("Internal compiler pattern failed to compile: {pattern}: {source}")]
    InternalPattern {
        /// Regex pattern used by the compiler.
        pattern: &'static str,
        /// Regex compilation failure.
        #[source]
        source: regex::Error,
    },
    /// The requested compiler feature is not implemented yet.
    #[error("{message}")]
    Unsupported {
        /// Stable diagnostic code.
        code: &'static str,
        /// Optional remediation hint.
        hint: &'static str,
        /// Human-readable diagnostic message.
        message: String,
        /// Optional UTF-8 source span.
        span: Option<DiagnosticSpan>,
    },
}

impl CompilerError {
    /// Converts this compiler error into structured diagnostics.
    #[must_use]
    pub fn diagnostics(&self, fallback_filename: &str) -> Vec<CompilerDiagnostic> {
        self.diagnostics_with_source(fallback_filename, None)
    }

    /// Converts this compiler error into structured diagnostics, resolving
    /// line/column locations from the module source when available.
    #[must_use]
    pub fn diagnostics_with_source(
        &self,
        fallback_filename: &str,
        source: Option<&str>,
    ) -> Vec<CompilerDiagnostic> {
        let mut diagnostics = self.base_diagnostics(fallback_filename);
        if let Some(source) = source {
            for diagnostic in &mut diagnostics {
                diagnostic.loc = diagnostic
                    .span
                    .and_then(|span| location_for_span(source, span));
            }
        }
        diagnostics
    }

    fn base_diagnostics(&self, fallback_filename: &str) -> Vec<CompilerDiagnostic> {
        vec![match self {
            Self::ParseModuleSource { filename, messages } => CompilerDiagnostic {
                code: "NAOS_PARSE_MODULE_SOURCE".to_owned(),
                filename: filename.clone(),
                hint: Some("Fix the TypeScript/TSX syntax before Naos analysis runs.".to_owned()),
                message: messages.clone(),
                loc: None,
                severity: DiagnosticSeverity::Error,
                span: None,
            },
            Self::ComponentNotFound { filename } => CompilerDiagnostic {
                code: "NAOS_COMPONENT_NOT_FOUND".to_owned(),
                filename: filename.clone(),
                hint: Some(
                    "Export a supported function component from a .wc.tsx module.".to_owned(),
                ),
                message: self.to_string(),
                loc: None,
                severity: DiagnosticSeverity::Error,
                span: None,
            },
            Self::InternalPattern { .. } => CompilerDiagnostic {
                code: "NAOS_INTERNAL_PATTERN".to_owned(),
                filename: fallback_filename.to_owned(),
                hint: Some("Report this as an Naos compiler bug.".to_owned()),
                message: self.to_string(),
                loc: None,
                severity: DiagnosticSeverity::Error,
                span: None,
            },
            Self::Unsupported {
                code,
                hint,
                message,
                span,
            } => CompilerDiagnostic {
                code: (*code).to_owned(),
                filename: fallback_filename.to_owned(),
                hint: Some((*hint).to_owned()),
                message: message.clone(),
                loc: None,
                severity: DiagnosticSeverity::Error,
                span: *span,
            },
        }]
    }
}

pub(crate) fn dsd_input(message: impl Into<String>) -> CompilerError {
    unsupported_with_code(
        DIAGNOSTIC_CODE_DSD_INPUT,
        message,
        DIAGNOSTIC_HINT_DSD_INPUTS,
    )
}

pub(crate) fn invalid_package_context(message: impl Into<String>) -> CompilerError {
    unsupported_with_code(
        DIAGNOSTIC_CODE_INVALID_PACKAGE_CONTEXT,
        message,
        "Pass a package name, optional version, and a valid package-derived tag prefix.",
    )
}

pub(crate) fn removed_authoring_api_with_span(
    message: impl Into<String>,
    span: DiagnosticSpan,
) -> CompilerError {
    unsupported_with_code_and_span(
        DIAGNOSTIC_CODE_REMOVED_AUTHORING_API,
        message,
        DIAGNOSTIC_HINT_REMOVED_API,
        span,
    )
}

pub(crate) fn unsupported(message: impl Into<String>) -> CompilerError {
    unsupported_with_code(
        DIAGNOSTIC_CODE_UNSUPPORTED_SYNTAX,
        message,
        DIAGNOSTIC_HINT_AUTHORING_LIMITATIONS,
    )
}

pub(crate) fn unsupported_with_code(
    code: &'static str,
    message: impl Into<String>,
    hint: &'static str,
) -> CompilerError {
    CompilerError::Unsupported {
        code,
        hint,
        message: message.into(),
        span: None,
    }
}

pub(crate) fn unsupported_with_code_and_span(
    code: &'static str,
    message: impl Into<String>,
    hint: &'static str,
    span: DiagnosticSpan,
) -> CompilerError {
    CompilerError::Unsupported {
        code,
        hint,
        message: message.into(),
        span: Some(span),
    }
}

pub(crate) fn unsupported_at(
    message: impl Into<String>,
    span: Option<DiagnosticSpan>,
) -> CompilerError {
    unsupported_with_code_at(
        DIAGNOSTIC_CODE_UNSUPPORTED_SYNTAX,
        message,
        DIAGNOSTIC_HINT_AUTHORING_LIMITATIONS,
        span,
    )
}

pub(crate) fn unsupported_with_code_at(
    code: &'static str,
    message: impl Into<String>,
    hint: &'static str,
    span: Option<DiagnosticSpan>,
) -> CompilerError {
    CompilerError::Unsupported {
        code,
        hint,
        message: message.into(),
        span,
    }
}

/// Resolves a UTF-8 byte span to one-based line/column positions.
///
/// Columns count Unicode scalar values. Spans that fall outside the source
/// resolve to `None` instead of panicking.
#[must_use]
pub fn location_for_span(source: &str, span: DiagnosticSpan) -> Option<DiagnosticLocation> {
    if span.start > span.end || span.end > source.len() {
        return None;
    }
    let (start_line, start_column) = line_column_at(source, span.start)?;
    let (end_line, end_column) = line_column_at(source, span.end)?;
    Some(DiagnosticLocation {
        start_line,
        start_column,
        end_line,
        end_column,
    })
}

fn line_column_at(source: &str, offset: usize) -> Option<(usize, usize)> {
    if !source.is_char_boundary(offset) {
        return None;
    }
    let prefix = &source[..offset];
    let line = prefix.matches('\n').count() + 1;
    let line_start = prefix.rfind('\n').map_or(0, |index| index + 1);
    let column = prefix[line_start..].chars().count() + 1;
    Some((line, column))
}
