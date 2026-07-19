//! C-ABI WASM wrapper around the Naos compiler core.
//!
//! Per ADR 0025 this crate stays a thin boundary: `naos-core` remains
//! target-agnostic, and results cross the boundary as JSON using the serde
//! serialization the core already has. The module is built for
//! `wasm32-unknown-unknown` and has zero imports, so it instantiates in
//! browsers, Node, and edge runtimes without any shim.
//!
//! # Memory protocol
//!
//! Every buffer that crosses the boundary is an exact-length allocation
//! created by [`naos_alloc`] and released by [`naos_free`]. The caller
//! allocates and fills the UTF-8 request JSON, calls [`naos_transform`] with
//! a pointer-sized out-parameter for the response length, and receives the
//! response buffer pointer as the return value. Both the request and the
//! response buffer must be released with [`naos_free`].

use naos_core::{PackageContext, transform_component_module};
use serde::Deserialize;

/// Transform request crossing the WASM boundary as JSON.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct TransformRequest {
    /// Original TypeScript/TSX source.
    source: String,
    /// Filename used for parser source-type detection and diagnostics.
    filename: String,
    /// Package name used for tag derivation and registration metadata.
    package_name: String,
    /// Optional package version used for registration metadata.
    package_version: Option<String>,
    /// Validated Custom Element prefix for tag derivation.
    tag_prefix: String,
}

/// Allocates an exact-length buffer the caller can fill with request bytes.
///
/// Returns a null pointer only when `len` is zero.
#[unsafe(no_mangle)]
pub extern "C" fn naos_alloc(len: usize) -> *mut u8 {
    if len == 0 {
        return std::ptr::null_mut();
    }
    let buffer = vec![0u8; len].into_boxed_slice();
    Box::into_raw(buffer).cast::<u8>()
}

/// Releases a buffer previously produced by [`naos_alloc`] or returned by
/// [`naos_transform`].
///
/// # Safety
///
/// `ptr` and `len` must describe exactly one live buffer produced by this
/// module; the buffer must not be released twice.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn naos_free(ptr: *mut u8, len: usize) {
    if ptr.is_null() || len == 0 {
        return;
    }
    let slice = std::ptr::slice_from_raw_parts_mut(ptr, len);
    drop(unsafe { Box::from_raw(slice) });
}

/// Transforms a component module described by a UTF-8 request JSON buffer.
///
/// Returns the response buffer pointer and writes its byte length to
/// `out_len`. The response contains JSON: `{ ok: true, coreVersion, result }`
/// with the serialized core `TransformResult` on success, or
/// `{ ok: false, coreVersion, message, diagnostics }` with structured
/// compiler diagnostics on failure. A malformed request is reported the same
/// way with an empty diagnostics list.
///
/// # Safety
///
/// `ptr` and `len` must describe a live, initialized buffer produced by
/// [`naos_alloc`] containing valid UTF-8, and `out_len` must point to a
/// writable `usize` slot (4 bytes on `wasm32`).
#[unsafe(no_mangle)]
pub unsafe extern "C" fn naos_transform(
    ptr: *const u8,
    len: usize,
    out_len: *mut usize,
) -> *mut u8 {
    let request_bytes = unsafe { std::slice::from_raw_parts(ptr, len) };
    let response = transform_response(request_bytes)
        .into_bytes()
        .into_boxed_slice();
    unsafe { out_len.write(response.len()) };
    Box::into_raw(response).cast::<u8>()
}

fn transform_response(request_bytes: &[u8]) -> String {
    let core_version = naos_core::core_version();
    let request: TransformRequest = match serde_json::from_slice(request_bytes) {
        Ok(request) => request,
        Err(error) => {
            return error_response_json(
                core_version,
                &format!("Malformed transform request: {error}"),
                &serde_json::json!([]),
            );
        }
    };

    let package = PackageContext {
        name: request.package_name,
        version: request.package_version,
        tag_prefix: request.tag_prefix,
    };
    match transform_component_module(&request.source, &request.filename, &package) {
        Ok(result) => serde_json::json!({
            "ok": true,
            "coreVersion": core_version,
            "result": result,
        })
        .to_string(),
        Err(error) => error_response_json(
            core_version,
            &error.to_string(),
            &serde_json::json!(
                error.diagnostics_with_source(&request.filename, Some(&request.source))
            ),
        ),
    }
}

fn error_response_json(
    core_version: &str,
    message: &str,
    diagnostics: &serde_json::Value,
) -> String {
    serde_json::json!({
        "ok": false,
        "coreVersion": core_version,
        "message": message,
        "diagnostics": diagnostics,
    })
    .to_string()
}

#[cfg(test)]
mod tests {
    use super::{naos_alloc, naos_free, naos_transform};

    fn call_transform(request: &serde_json::Value) -> serde_json::Value {
        let request_bytes = request.to_string().into_bytes();
        let request_ptr = naos_alloc(request_bytes.len());
        let mut response_len = 0usize;
        let response_ptr = unsafe {
            std::ptr::copy_nonoverlapping(request_bytes.as_ptr(), request_ptr, request_bytes.len());
            naos_transform(request_ptr, request_bytes.len(), &raw mut response_len)
        };
        let response_bytes =
            unsafe { std::slice::from_raw_parts(response_ptr, response_len) }.to_vec();
        unsafe {
            naos_free(request_ptr, request_bytes.len());
            naos_free(response_ptr, response_len);
        }
        serde_json::from_slice(&response_bytes).expect("response should be valid JSON")
    }

    #[test]
    fn transform_round_trips_a_component_module() {
        let response = call_transform(&serde_json::json!({
            "source": "import { state } from \"@naos-ui/core\";\n\nexport function Counter() {\n  const count = state(0);\n  return <button onClick={() => count.set(count() + 1)}>{count()}</button>;\n}\n",
            "filename": "counter.wc.tsx",
            "packageName": "@naos-ui/playground",
            "packageVersion": "0.0.0",
            "tagPrefix": "play1",
        }));

        assert_eq!(response["ok"], true);
        // Core serde serialization is snake_case; the JS glue consumes it as-is.
        assert_eq!(response["result"]["tag_name"], "play1-counter");
        let code = response["result"]["code"]
            .as_str()
            .expect("code should be a string");
        assert!(code.contains("customElements.define(\"play1-counter\""));
        assert!(
            response["coreVersion"]
                .as_str()
                .is_some_and(|version| !version.is_empty())
        );
    }

    #[test]
    fn transform_reports_structured_diagnostics() {
        let response = call_transform(&serde_json::json!({
            "source": "export function Broken() {\n  return <p>{flag ? <b>yes</b> : <i>no</i>}</p>;\n}\n",
            "filename": "broken.wc.tsx",
            "packageName": "@naos-ui/playground",
            "packageVersion": null,
            "tagPrefix": "play1",
        }));

        assert_eq!(response["ok"], false);
        let diagnostics = response["diagnostics"]
            .as_array()
            .expect("diagnostics should be an array");
        assert!(!diagnostics.is_empty());
        assert_eq!(diagnostics[0]["code"], "NAOS_UNSUPPORTED_CONDITIONAL_JSX");
    }

    #[test]
    fn malformed_requests_fail_without_trapping() {
        let response = call_transform(&serde_json::json!({ "unexpected": true }));

        assert_eq!(response["ok"], false);
        assert!(
            response["message"]
                .as_str()
                .is_some_and(|message| message.contains("Malformed transform request"))
        );
    }
}
