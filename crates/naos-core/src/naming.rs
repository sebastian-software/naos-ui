use crate::error::{CompilerResult, invalid_package_context};
use crate::model::PackageContext;

pub(crate) fn custom_element_tag_for_component(
    component_name: &str,
    package: &PackageContext,
) -> CompilerResult<String> {
    validate_package_context(package)?;
    let component_tag = kebab_case_identifier(component_name);
    if component_tag.is_empty() {
        return Err(invalid_package_context(
            "The component name cannot produce a valid Custom Element name.",
        ));
    }
    let repeated_prefix = format!("{}-", package.tag_prefix);
    let suffix = component_tag
        .strip_prefix(&repeated_prefix)
        .unwrap_or(&component_tag);
    Ok(format!("{}-{suffix}", package.tag_prefix))
}

fn validate_package_context(package: &PackageContext) -> CompilerResult<()> {
    if package.name.trim().is_empty() {
        return Err(invalid_package_context("The package name cannot be empty."));
    }
    let prefix = package.tag_prefix.as_str();
    let valid = !prefix.starts_with("xml")
        && prefix.bytes().enumerate().all(|(index, byte)| match byte {
            b'a'..=b'z' => true,
            b'0'..=b'9' => index > 0,
            b'-' => index > 0 && index + 1 < prefix.len(),
            _ => false,
        })
        && !prefix.contains("--");
    if !valid {
        return Err(invalid_package_context(format!(
            "The tag prefix {prefix:?} is invalid or reserved."
        )));
    }
    Ok(())
}

pub(crate) fn is_pascal_case_identifier(identifier: &str) -> bool {
    identifier
        .chars()
        .next()
        .is_some_and(|first| first.is_ascii_uppercase())
}

pub(crate) fn kebab_case_identifier(identifier: &str) -> String {
    let chars = identifier.chars().collect::<Vec<_>>();
    let mut output = String::new();

    for (index, ch) in chars.iter().copied().enumerate() {
        if matches!(ch, '_' | ' ') {
            if !output.ends_with('-') && !output.is_empty() {
                output.push('-');
            }
            continue;
        }

        if ch.is_ascii_uppercase() && index > 0 {
            let previous = chars[index - 1];
            let next = chars.get(index + 1).copied();
            if (previous.is_ascii_lowercase() || previous.is_ascii_digit())
                || (previous.is_ascii_uppercase()
                    && next.is_some_and(|next| next.is_ascii_lowercase()))
            {
                output.push('-');
            }
        }

        output.push(ch.to_ascii_lowercase());
    }

    output
}

pub(crate) fn event_name_from_attribute(name: &str) -> Option<String> {
    let event_name = name.strip_prefix("on")?;
    if event_name.is_empty() {
        return None;
    }

    let kebab_name = kebab_case_identifier(event_name);
    if is_compound_dom_event(&kebab_name) {
        Some(kebab_name.replace('-', ""))
    } else {
        Some(kebab_name)
    }
}

fn is_compound_dom_event(name: &str) -> bool {
    matches!(
        name,
        "animation-cancel"
            | "animation-end"
            | "animation-iteration"
            | "animation-start"
            | "aux-click"
            | "before-input"
            | "before-match"
            | "before-toggle"
            | "can-play"
            | "can-play-through"
            | "composition-end"
            | "composition-start"
            | "composition-update"
            | "context-lost"
            | "context-menu"
            | "context-restored"
            | "cue-change"
            | "dbl-click"
            | "drag-end"
            | "drag-enter"
            | "drag-exit"
            | "drag-leave"
            | "drag-over"
            | "drag-start"
            | "duration-change"
            | "focus-in"
            | "focus-out"
            | "form-data"
            | "fullscreen-change"
            | "fullscreen-error"
            | "got-pointer-capture"
            | "key-down"
            | "key-press"
            | "key-up"
            | "loaded-data"
            | "loaded-metadata"
            | "load-start"
            | "lost-pointer-capture"
            | "mouse-down"
            | "mouse-enter"
            | "mouse-leave"
            | "mouse-move"
            | "mouse-out"
            | "mouse-over"
            | "mouse-up"
            | "pointer-cancel"
            | "pointer-down"
            | "pointer-enter"
            | "pointer-leave"
            | "pointer-move"
            | "pointer-out"
            | "pointer-over"
            | "pointer-raw-update"
            | "pointer-up"
            | "rate-change"
            | "scroll-end"
            | "security-policy-violation"
            | "selection-change"
            | "select-start"
            | "slot-change"
            | "time-update"
            | "touch-cancel"
            | "touch-end"
            | "touch-move"
            | "touch-start"
            | "transition-cancel"
            | "transition-end"
            | "transition-run"
            | "transition-start"
            | "volume-change"
            | "webkit-animation-end"
            | "webkit-animation-iteration"
            | "webkit-animation-start"
            | "webkit-transition-end"
    )
}

#[cfg(test)]
mod tests {
    use super::{custom_element_tag_for_component, event_name_from_attribute};
    use crate::model::PackageContext;

    #[test]
    fn component_tags_use_stable_package_prefixes() {
        let package = PackageContext {
            name: "@acme/design-system".to_owned(),
            version: Some("2.3.0".to_owned()),
            tag_prefix: "acme-design-system".to_owned(),
        };
        assert_eq!(
            custom_element_tag_for_component("Button", &package)
                .expect("valid package context should produce a tag"),
            "acme-design-system-button"
        );

        let concise_package = PackageContext {
            tag_prefix: "naos".to_owned(),
            ..package
        };
        assert_eq!(
            custom_element_tag_for_component("NaosButton", &concise_package)
                .expect("valid package context should produce a tag"),
            "naos-button"
        );
    }

    #[test]
    fn component_tags_reject_reserved_package_prefixes() {
        let package = PackageContext {
            name: "widgets".to_owned(),
            version: None,
            tag_prefix: "xml-widgets".to_owned(),
        };
        let error = custom_element_tag_for_component("Button", &package)
            .expect_err("reserved prefixes should fail");
        assert_eq!(
            error.diagnostics("package.json")[0].code,
            "NAOS_INVALID_PACKAGE_CONTEXT"
        );
    }

    #[test]
    fn event_attributes_map_standard_compound_names() {
        for (attribute, event) in [
            ("onClick", "click"),
            ("onDblClick", "dblclick"),
            ("onKeyDown", "keydown"),
            ("onBeforeInput", "beforeinput"),
            ("onContextMenu", "contextmenu"),
            ("onPointerCancel", "pointercancel"),
            ("onGotPointerCapture", "gotpointercapture"),
            ("onTouchStart", "touchstart"),
            ("onAnimationEnd", "animationend"),
            ("onTransitionEnd", "transitionend"),
            ("onSecurityPolicyViolation", "securitypolicyviolation"),
        ] {
            assert_eq!(event_name_from_attribute(attribute).as_deref(), Some(event));
        }
    }

    #[test]
    fn event_attributes_preserve_custom_event_word_boundaries() {
        assert_eq!(
            event_name_from_attribute("onDataReady").as_deref(),
            Some("data-ready")
        );
        assert_eq!(event_name_from_attribute("class"), None);
        assert_eq!(event_name_from_attribute("on"), None);
    }
}
