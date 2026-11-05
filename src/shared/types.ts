export const OUTPUT_FORMATS = ['jpeg', 'png', 'webp', 'avif', 'tiff', 'gif'] as const
export type OutputFormat = (typeof OUTPUT_FORMATS)[number]

export type ConflictPolicy = 'skip' | 'overwrite' | 'rename'
export type ResizeFit = 'inside' | 'cover' | 'contain' | 'fill'

export interface ConvertOptions {
  format: OutputFormat
  quality: number
  lossless: boolean
  resize: { width?: number; height?: number; fit: ResizeFit } | null
  keepMetadata: boolean
  background: string
  conflict: ConflictPolicy
}

export interface ScanRequest {
  folder: string
  recursive: boolean
}

export interface ConvertRequest extends ScanRequest {
  outputFolder: string
  options: ConvertOptions
  dryRun: boolean
}

export interface ScannedFile {
  path: string
  relativePath: string
  size: number
}

export type FileStatus = 'done' | 'skipped' | 'error' | 'planned'

export interface FileResult {
  relativePath: string
  status: FileStatus
  outputPath?: string
  inputSize: number
  outputSize?: number
  error?: string
}

export interface ProgressEvent {
  completed: number
  total: number
  result: FileResult
}

export interface ConvertSummary {
  total: number
  done: number
  skipped: number
  failed: number
  cancelled: boolean
}

export interface ImageConverterApi {
  pickFolder(): Promise<string | null>
  scan(req: ScanRequest): Promise<ScannedFile[]>
  convert(req: ConvertRequest): Promise<ConvertSummary>
  cancel(): Promise<void>
  onProgress(cb: (e: ProgressEvent) => void): () => void
  openFolder(path: string): Promise<void>
}

export const IPC = {
  pickFolder: 'dialog:pickFolder',
  scan: 'images:scan',
  convert: 'images:convert',
  cancel: 'images:cancel',
  progress: 'images:progress',
  openFolder: 'shell:openFolder'
} as const
