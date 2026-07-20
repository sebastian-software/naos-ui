export type CheckboxState = {
  checked: boolean
  indeterminate: boolean
}

export function nextCheckboxState(state: CheckboxState): CheckboxState {
  return {
    checked: state.indeterminate ? true : !state.checked,
    indeterminate: false,
  }
}

export function checkboxFormValue(
  checked: boolean,
  value: FormDataEntryValue,
): FormDataEntryValue | null {
  return checked ? value : null
}
