export type NaosPinInputType = "alphanumeric" | "alphabetic" | "numeric"
export function pinSlots(count: number): number[] {
  return Array.from({ length: Math.max(0, Math.floor(count)) }, (_, index) => index)
}
export function pinPattern(type: NaosPinInputType): RegExp {
  if (type === "numeric") return /^[0-9]$/
  if (type === "alphabetic") return /^[A-Za-z]$/
  return /^[A-Za-z0-9]$/
}
