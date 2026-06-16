#![warn(missing_docs, rustdoc::broken_intra_doc_links)]
//! Node.js binding surface for the lean-wc compiler.

use napi_derive::napi;

/// Version metadata for the loaded native compiler.
#[napi(object)]
pub struct NativeInfo {
    /// Current Rust compiler core package version.
    pub core_version: String,
}

/// Returns metadata for the native compiler.
#[napi]
#[must_use]
pub fn get_native_info() -> NativeInfo {
    NativeInfo {
        core_version: lean_wc_core::core_version().to_string(),
    }
}
