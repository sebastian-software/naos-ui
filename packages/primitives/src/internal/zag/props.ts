type ZagPropBag = Record<string, unknown>

const propAliases: Record<string, string> = {
  className: "class",
  htmlFor: "for",
}

const shouldKeepValue = (value: unknown) => value != null

export function normalizeZagPropBag<T extends ZagPropBag>(props: T) {
  const normalized: ZagPropBag = {}

  for (const [key, value] of Object.entries(props)) {
    if (!shouldKeepValue(value)) continue
    normalized[propAliases[key] ?? key] = value
  }

  return normalized
}

export const normalizeZagProps = {
  button: normalizeZagPropBag,
  element: normalizeZagPropBag,
  input: normalizeZagPropBag,
  label: normalizeZagPropBag,
}
