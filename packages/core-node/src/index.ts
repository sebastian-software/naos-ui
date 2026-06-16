export type NativeInfo = {
  coreVersion: string
}

export function getNativeInfo(): NativeInfo {
  return {
    coreVersion: "0.0.0",
  }
}

