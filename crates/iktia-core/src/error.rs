use thiserror::Error;

use crate::model::{CompilerDiagnostic, DiagnosticSeverity};

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
    #[error("No Iktia component declaration was found in {filename}.")]
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
        /// Human-readable diagnostic message.
        message: String,
    },
}

impl CompilerError {
    /// Converts this compiler error into structured diagnostics.
    #[must_use]
    pub fn diagnostics(&self, fallback_filename: &str) -> Vec<CompilerDiagnostic> {
        vec![match self {
            Self::ParseModuleSource { filename, messages } => CompilerDiagnostic {
                code: "IKTIA_PARSE_MODULE_SOURCE".to_owned(),
                filename: filename.clone(),
                hint: Some("Fix the TypeScript/TSX syntax before Iktia analysis runs.".to_owned()),
                message: messages.clone(),
                severity: DiagnosticSeverity::Error,
                span: None,
            },
            Self::ComponentNotFound { filename } => CompilerDiagnostic {
                code: "IKTIA_COMPONENT_NOT_FOUND".to_owned(),
                filename: filename.clone(),
                hint: Some(
                    "Export a supported function component from a .wc.tsx module.".to_owned(),
                ),
                message: self.to_string(),
                severity: DiagnosticSeverity::Error,
                span: None,
            },
            Self::InternalPattern { .. } => CompilerDiagnostic {
                code: "IKTIA_INTERNAL_PATTERN".to_owned(),
                filename: fallback_filename.to_owned(),
                hint: Some("Report this as an Iktia compiler bug.".to_owned()),
                message: self.to_string(),
                severity: DiagnosticSeverity::Error,
                span: None,
            },
            Self::Unsupported { message } => CompilerDiagnostic {
                code: "IKTIA_UNSUPPORTED_SYNTAX".to_owned(),
                filename: fallback_filename.to_owned(),
                hint: Some("Check the v0.1 authoring limitations for supported TSX.".to_owned()),
                message: message.clone(),
                severity: DiagnosticSeverity::Error,
                span: None,
            },
        }]
    }
}
