import {
  effect,
  event,
  formControl,
  host,
  onConnected,
  onDisconnected,
  state,
  type ComponentOptions,
} from "@naos-ui/core"
import {
  bindFileUpload,
  fileUploadFileNames,
  fileUploadFormValue,
  formatFileSize,
} from "./internal/ui-sdk/file-upload.js"
import css from "./file-upload.wc.css?inline"

export type NaosFileUploadProps = {
  accept?: string
  disabled?: boolean
  label?: string
  maxFiles?: number
  multiple?: boolean
  name?: string
}

export const options = {
  styles: [css],
} satisfies ComponentOptions

export function NaosFileUpload({
  accept = "",
  disabled = false,
  label = "Upload files",
  maxFiles = 3,
  multiple = false,
  name = "",
}: NaosFileUploadProps = {}) {
  const files = state<File[]>([])
  const rejected = state<string[]>([])
  const fileUploadService = state<ReturnType<typeof bindFileUpload> | null>(null)
  const changed = event<{ files: string[]; rejectedFiles: string[] }>("naos-change")
  const rejectedEvent = event<{ files: string[] }>("naos-invalid")
  const form = formControl({
    value: () => fileUploadFormValue({ files: files(), multiple, name }),
    reset: () => {
      files.set([])
      rejected.set([])
      fileUploadService()?.api.clear({ reason: "reset" })
    },
    disabled,
  })
  void form
  void name

  onConnected(() => {
    const input = host().root.querySelector("input")
    if (!input) return
    fileUploadService.set(
      bindFileUpload(input, {
        accept,
        disabled,
        maxFiles,
        multiple,
        defaultValue: files(),
        onValueChange(next, details) {
          const rejectedNames = details.rejected.map((item) => item.file.name)
          files.set(next)
          rejected.set(rejectedNames)
          if (details.reason !== "reset")
            changed.emit({ files: fileUploadFileNames(next), rejectedFiles: rejectedNames })
        },
        onReject(items) {
          const names = items.map((item) => item.file.name)
          rejected.set(names)
          rejectedEvent.emit({ files: names })
        },
      }),
    )
  })
  effect(() => {
    fileUploadService()?.configure({ accept, disabled, maxFiles, multiple })
  })
  onDisconnected(() => {
    fileUploadService()?.destroy()
    fileUploadService.set(null)
  })

  return (
    <section
      part="root"
      data-state={files().length === 0 ? "empty" : "filled"}
      data-disabled={disabled || undefined}
      data-value={fileUploadFileNames(files()).join(",")}
    >
      <label part="label">{label}</label>
      <div part="dropzone" role="button" aria-label={label} tabindex={disabled ? -1 : 0}>
        <input
          part="input"
          type="file"
          hidden
          {...{ accept, multiple }}
          aria-label={label}
          name={undefined}
          disabled={disabled}
        />
        <span part="message">
          {multiple ? "Choose files or drop them here" : "Choose a file or drop it here"}
        </span>
        <button part="trigger" type="button" disabled={disabled}>
          Browse
        </button>
      </div>
      <div part="items">
        {files().map((file, fileIndex) => (
          <div key={`${file.name}-${file.size}-${fileIndex}`} part="item">
            <span part="item-name">{file.name}</span>
            <span part="item-size">{formatFileSize(file.size)}</span>
            <button
              part="item-delete"
              type="button"
              disabled={disabled}
              aria-label={`Remove ${file.name}`}
              onClick={() => fileUploadService()?.api.removeFile(file)}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <div part="rejected" data-state={rejected().length === 0 ? "empty" : "filled"}>
        {rejected().join(",")}
      </div>
      <button
        part="clear"
        type="button"
        disabled={disabled}
        hidden={!files().length}
        onClick={() => fileUploadService()?.api.clear()}
      >
        Clear
      </button>
    </section>
  )
}
