import { promises as fs } from 'node:fs'
import { basename, dirname, extname, join, relative, resolve } from 'node:path'
import decodeHeic from 'heic-decode'
import pLimit from 'p-limit'
import sharp, { type Sharp } from 'sharp'
import type {
  ConvertOptions,
  ConvertSummary,
  FileResult,
  ProgressEvent,
  ScannedFile
} from '../shared/types'

const INPUT_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.webp', '.avif', '.tif', '.tiff', '.gif', '.heic', '.heif', '.svg'
])

const EXTENSION_FOR = { jpeg: '.jpg', png: '.png', webp: '.webp', avif: '.avif', tiff: '.tiff', gif: '.gif' } as const

export async function scanFolder(folder: string, recursive: boolean): Promise<ScannedFile[]> {
  const root = resolve(folder)
  const files: ScannedFile[] = []

  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (recursive) await walk(full)
      } else if (entry.isFile() && INPUT_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
        const { size } = await fs.stat(full)
        files.push({ path: full, relativePath: relative(root, full), size })
      }
    }
  }

  await walk(root)
  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath))
}

async function exists(path: string): Promise<boolean> {
  try {
    await fs.access(path)
    return true
  } catch {
    return false
  }
}

async function resolveTarget(target: string, policy: ConvertOptions['conflict']): Promise<string | null> {
  if (!(await exists(target))) return target
  if (policy === 'overwrite') return target
  if (policy === 'skip') return null
  const ext = extname(target)
  const stem = target.slice(0, target.length - ext.length)
  for (let i = 1; ; i++) {
    const candidate = `${stem} (${i})${ext}`
    if (!(await exists(candidate))) return candidate
  }
}

// Prebuilt sharp binaries lack an HEVC decoder, so HEIC/HEIF is decoded in JS first.
async function openInput(input: string, animated: boolean): Promise<Sharp> {
  const ext = extname(input).toLowerCase()
  if (ext === '.heic' || ext === '.heif') {
    const { width, height, data } = await decodeHeic({ buffer: await fs.readFile(input) })
    return sharp(Buffer.from(data), { raw: { width, height, channels: 4 } })
  }
  return sharp(input, { animated })
}

export async function buildPipeline(input: string, o: ConvertOptions): Promise<Sharp> {
  let img = (await openInput(input, o.format === 'gif' || o.format === 'webp')).rotate()

  if (o.resize && (o.resize.width || o.resize.height)) {
    img = img.resize({
      width: o.resize.width,
      height: o.resize.height,
      fit: o.resize.fit,
      withoutEnlargement: true,
      background: o.background
    })
  }

  // Formats without alpha support need transparency flattened.
  if (o.format === 'jpeg') img = img.flatten({ background: o.background })
  if (o.keepMetadata) img = img.keepMetadata()

  const quality = Math.min(100, Math.max(1, Math.round(o.quality)))
  switch (o.format) {
    case 'jpeg': return img.jpeg({ quality, mozjpeg: true })
    case 'png': return img.png({ compressionLevel: 9 })
    case 'webp': return img.webp({ quality, lossless: o.lossless })
    case 'avif': return img.avif({ quality, lossless: o.lossless })
    case 'tiff': return img.tiff({ quality })
    case 'gif': return img.gif()
  }
}

export interface RunOptions {
  inputFolder: string
  outputFolder: string
  recursive: boolean
  options: ConvertOptions
  dryRun?: boolean
  concurrency?: number
  signal?: AbortSignal
  onProgress?: (e: ProgressEvent) => void
}

export async function convertFolder(run: RunOptions): Promise<ConvertSummary> {
  const { options, signal } = run
  const inputRoot = resolve(run.inputFolder)
  const outputRoot = resolve(run.outputFolder)
  const files = await scanFolder(inputRoot, run.recursive)
  const limit = pLimit(run.concurrency ?? 3)
  const summary: ConvertSummary = { total: files.length, done: 0, skipped: 0, failed: 0, cancelled: false }
  let completed = 0

  const report = (result: FileResult): void => {
    completed++
    if (result.status === 'error') summary.failed++
    else if (result.status === 'skipped') summary.skipped++
    else summary.done++
    run.onProgress?.({ completed, total: files.length, result })
  }

  await Promise.all(
    files.map((file) =>
      limit(async () => {
        if (signal?.aborted) {
          summary.cancelled = true
          return
        }
        const stem = basename(file.relativePath, extname(file.relativePath))
        const desired = join(outputRoot, dirname(file.relativePath), stem + EXTENSION_FOR[options.format])
        try {
          // Never write over the source file itself.
          const policy = resolve(desired) === resolve(file.path) ? 'rename' : options.conflict
          const target = await resolveTarget(desired, policy)
          if (!target) {
            report({ relativePath: file.relativePath, status: 'skipped', inputSize: file.size })
            return
          }
          if (run.dryRun) {
            report({ relativePath: file.relativePath, status: 'planned', outputPath: target, inputSize: file.size })
            return
          }
          await fs.mkdir(dirname(target), { recursive: true })
          const info = await (await buildPipeline(file.path, options)).toFile(target)
          report({
            relativePath: file.relativePath,
            status: 'done',
            outputPath: target,
            inputSize: file.size,
            outputSize: info.size
          })
        } catch (err) {
          report({
            relativePath: file.relativePath,
            status: 'error',
            inputSize: file.size,
            error: err instanceof Error ? err.message : String(err)
          })
        }
      })
    )
  )

  if (signal?.aborted) summary.cancelled = true
  return summary
}
