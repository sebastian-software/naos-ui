pub(crate) fn custom_element_tag_for_component(component_name: &str) -> String {
    let tag_name = kebab_case_identifier(component_name);
    if tag_name.contains('-') {
        tag_name
    } else {
        format!("x-{tag_name}")
    }
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
    use super::event_name_from_attribute;

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
