import {
  computed,
  event,
  formControl,
  host,
  onConnected,
  onDisconnected,
  state,
  type ComponentOptions,
} from "@iktia/core"
import {
  createIktiaZagFileUploadService,
  fileUploadFileNames,
  fileUploadFormValue,
  getIktiaZagFileUploadApi,
  stopIktiaZagFileUploadService,
} from "./internal/zag/file-upload.js"
import type { IktiaZagFileUploadService } from "./internal/zag/file-upload.js"
import css from "./file-upload.wc.css?inline"

export type IktiaFileUploadProps = {
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

export function IktiaFileUpload({
  accept = "",
  disabled = false,
  label = "Upload files",
  maxFiles = 3,
  multiple = false,
  name = "",
}: IktiaFileUploadProps = {}) {
  const files = state<File[]>([])
  const rejected = state<string[]>([])
  const fileUploadService = state<IktiaZagFileUploadService | null>(null)
  const fileUploadApi = computed(() => getIktiaZagFileUploadApi(fileUploadService()))
  const changed = event<{ files: string[]; rejectedFiles: string[] }>("iktia-change")
  const rejectedEvent = event<{ files: string[] }>("iktia-invalid")
  const form = formControl({
    value: () => fileUploadFormValue({ files: files(), multiple, name }),
    reset: () => {
      files.set([])
      rejected.set([])
      fileUploadApi()?.clearFiles()
      fileUploadApi()?.clearRejectedFiles()
    },
    disabled,
  })
  void form
  void name

  onConnected(() => {
    fileUploadService.set(createIktiaZagFileUploadService({
      accept,
      disabled,
      host: host().element,
      id: "iktia-file-upload",
      maxFiles,
      multiple,
      name,
      onFileChange(details) {
        const rejectedNames = details.rejectedFiles.map((item) => item.file.name)

        changed.emit({
          files: fileUploadFileNames(details.acceptedFiles),
          rejectedFiles: rejectedNames,
        })
        queueMicrotask(() => {
          files.set(details.acceptedFiles)
          rejected.set(rejectedNames)
        })
      },
      onFileReject(details) {
        const rejectedNames = details.files.map((item) => item.file.name)

        rejectedEvent.emit({ files: rejectedNames })
        queueMicrotask(() => {
          rejected.set(rejectedNames)
        })
      },
      root: host().root,
    }))
  })
  onDisconnected(() => {
    stopIktiaZagFileUploadService(fileUploadService())
    fileUploadService.set(null)
  })

  return (
    <section
      {...(fileUploadApi()?.getRootProps() ?? {})}
      part="root"
      data-state={files().length === 0 ? "empty" : "filled"}
      data-disabled={disabled || undefined}
      data-value={fileUploadFileNames(files()).join(",")}
    >
      <label {...(fileUploadApi()?.getLabelProps() ?? {})} part="label">
        {label}
      </label>
      <div {...(fileUploadApi()?.getDropzoneProps() ?? {})} part="dropzone">
        <input
          {...(fileUploadApi()?.getHiddenInputProps() ?? {})}
          part="input"
          name={undefined}
          disabled={disabled}
        />
        <span part="message">
          {multiple ? "Choose files or drop them here" : "Choose a file or drop it here"}
        </span>
        <button {...(fileUploadApi()?.getTriggerProps() ?? {})} part="trigger">
          Browse
        </button>
      </div>
      <div {...(fileUploadApi()?.getItemGroupProps() ?? {})} part="items">
        {files().map((file, fileIndex) => (
          <div
            key={`${file.name}-${file.size}-${fileIndex}`}
            {...(fileUploadApi()?.getItemProps({ file }) ?? {})}
            part="item"
          >
            <span {...(fileUploadApi()?.getItemNameProps({ file }) ?? {})} part="item-name">
              {file.name}
            </span>
            <span
              {...(fileUploadApi()?.getItemSizeTextProps({ file }) ?? {})}
              part="item-size"
            >
              {fileUploadApi()?.getFileSize(file) ?? `${file.size} B`}
            </span>
            <button
              {...(fileUploadApi()?.getItemDeleteTriggerProps({ file }) ?? {})}
              part="item-delete"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <div part="rejected" data-state={rejected().length === 0 ? "empty" : "filled"}>
        {rejected().join(",")}
      </div>
      <button {...(fileUploadApi()?.getClearTriggerProps() ?? {})} part="clear">
        Clear
      </button>
    </section>
  )
}
