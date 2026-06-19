export function nextTogglePressed(pressed: boolean): boolean {
  return !pressed
}

export function toggleFormValue(
  pressed: boolean,
  value: FormDataEntryValue
): FormDataEntryValue | null {
  return pressed ? value : null
}
