import { formAction } from "@naos-ui/actions"

export const saveNoteAction = formAction(
  async (notes: readonly string[], formData, { signal }) => {
    const note = String(formData.get("note") ?? "")
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, 250)
      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timer)
          reject(new DOMException("Save aborted.", "AbortError"))
        },
        { once: true }
      )
    })
    if (note === "boom") {
      throw new Error("Note rejected")
    }
    return [...notes, note]
  },
  [] as readonly string[]
)
