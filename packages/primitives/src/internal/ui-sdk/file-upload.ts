import { fileInput, type FileInputOptions } from "@ui-sdk/core/file-input"
import { primitiveId } from "./id.js"

export function fileUploadFileNames(files: File[]): string[] {
  return files.map((file) => file.name)
}

export function fileUploadFormValue({
  files,
  multiple,
  name,
}: {
  files: File[]
  multiple: boolean
  name: string
}): FormDataEntryValue | FormData | null {
  if (files.length === 0) return null
  if (!multiple) return files[0] ?? null
  if (!name) return null
  const data = new FormData()
  for (const file of files) data.append(name, file)
  return data
}

export function bindFileUpload(input: HTMLInputElement, options: FileInputOptions) {
  const id = primitiveId("file-upload")
  const model = fileInput({ ...options, id })
  const dropzone = input.parentElement!
  const listeners = new AbortController()
  const signal = listeners.signal
  function openPicker() {
    if (!input.disabled) input.click()
  }
  dropzone.addEventListener(
    "click",
    (event) => {
      if (event.target !== input) openPicker()
    },
    { signal },
  )
  dropzone.addEventListener(
    "keydown",
    (event) => {
      if (event.target !== dropzone || ![" ", "Enter"].includes(event.key)) return
      event.preventDefault()
      openPicker()
    },
    { signal },
  )
  input.addEventListener(
    "change",
    (event) => {
      if (input.files && !input.disabled)
        model.api.addFiles(input.files, { reason: "picker", event })
      input.value = ""
    },
    { signal },
  )
  dropzone.addEventListener(
    "dragover",
    (event) => {
      event.preventDefault()
      dropzone.toggleAttribute("data-dragging", !input.disabled)
    },
    { signal },
  )
  dropzone.addEventListener(
    "dragleave",
    (event) => {
      if (!(event.relatedTarget instanceof Node) || !dropzone.contains(event.relatedTarget))
        dropzone.removeAttribute("data-dragging")
    },
    { signal },
  )
  dropzone.addEventListener(
    "drop",
    (event) => {
      event.preventDefault()
      dropzone.removeAttribute("data-dragging")
      if (!input.disabled && event.dataTransfer)
        model.api.addFiles(event.dataTransfer.files, { reason: "drop", event })
    },
    { signal },
  )
  return {
    api: model.api,
    configure(rules: Pick<FileInputOptions, "disabled" | "accept" | "multiple" | "maxFiles">) {
      model.setOptions({ ...options, ...rules, id })
    },
    destroy() {
      listeners.abort()
      model.destroy()
    },
  }
}

export function formatFileSize(bytes: number) {
  const units = ["byte", "kilobyte", "megabyte", "gigabyte", "terabyte"]
  const exponent = Math.min(units.length - 1, Math.max(0, Math.floor(Math.log10(bytes || 1) / 3)))
  return new Intl.NumberFormat(undefined, {
    style: "unit",
    unit: units[exponent],
    maximumFractionDigits: 1,
  }).format(bytes / 1000 ** exponent)
}
