use thiserror::Error;

/// Shared result type for compiler operations.
pub type CompilerResult<T> = Result<T, CompilerError>;

/// Error type for host-neutral compiler failures.
#[derive(Debug, Error)]
pub enum CompilerError {
    /// The requested compiler feature is not implemented yet.
    #[error("{message}")]
    Unsupported {
        /// Human-readable diagnostic message.
        message: String,
    },
}

