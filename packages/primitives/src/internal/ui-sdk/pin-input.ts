export type NaosPinInputType = "alphanumeric" | "alphabetic" | "numeric"
export function pinSlots(count: number): number[] {
  return Array.from({ length: Math.max(0, Math.floor(count)) }, (_, index) => index)
}
export function pinPattern(type: NaosPinInputType): "digits" | "letters" | "alphanumeric" {
  return type === "numeric" ? "digits" : type === "alphabetic" ? "letters" : "alphanumeric"
}
