import { useEffect, useMemo, useRef, useState } from 'react'
import {
  OUTPUT_FORMATS,
  type ConvertOptions,
  type ConvertSummary,
  type FileResult,
  type ScannedFile
} from '@shared/types'

const defaultOptions: ConvertOptions = {
  format: 'webp',
  quality: 80,
  lossless: false,
  resize: null,
  keepMetadata: false,
  background: '#ffffff',
  conflict: 'rename'
}

const fmtSize = (n: number): string =>
  n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`

const field = 'rounded-md border border-slate-300 bg-transparent px-2 py-1 dark:border-slate-600'
const button =
  'rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed'
const ghost = 'rounded-md border border-slate-300 px-3 py-2 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800'

export default function App(): JSX.Element {
  const [folder, setFolder] = useState('')
  const [outputFolder, setOutputFolder] = useState('')
  const [recursive, setRecursive] = useState(false)
  const [options, setOptions] = useState<ConvertOptions>(defaultOptions)
  const [resizeW, setResizeW] = useState('')
  const [resizeH, setResizeH] = useState('')
  const [files, setFiles] = useState<ScannedFile[]>([])
  const [results, setResults] = useState<FileResult[]>([])
  const [progress, setProgress] = useState({ completed: 0, total: 0 })
  const [summary, setSummary] = useState<ConvertSummary | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const scanId = useRef(0)

  useEffect(() => window.api.onProgress((e) => {
    setProgress({ completed: e.completed, total: e.total })
    setResults((prev) => [...prev, e.result])
  }), [])

  useEffect(() => {
    if (!folder) return
    const id = ++scanId.current
    window.api
      .scan({ folder, recursive })
      .then((f) => id === scanId.current && (setFiles(f), setError('')))
      .catch((e: Error) => setError(e.message))
  }, [folder, recursive])

  const set = <K extends keyof ConvertOptions>(k: K, v: ConvertOptions[K]): void =>
    setOptions((o) => ({ ...o, [k]: v }))

  const effective = useMemo<ConvertOptions>(() => {
    const width = parseInt(resizeW) || undefined
    const height = parseInt(resizeH) || undefined
    return { ...options, resize: width || height ? { width, height, fit: 'inside' } : null }
  }, [options, resizeW, resizeH])

  const chooseInput = async (): Promise<void> => {
    const p = await window.api.pickFolder()
    if (!p) return
    setFolder(p)
    setOutputFolder((o) => o || `${p}\\converted`)
  }

  const chooseOutput = async (): Promise<void> => {
    const p = await window.api.pickFolder()
    if (p) setOutputFolder(p)
  }

  const run = async (dryRun: boolean): Promise<void> => {
    setResults([])
    setSummary(null)
    setError('')
    setProgress({ completed: 0, total: files.length })
    setRunning(true)
    try {
      setSummary(await window.api.convert({ folder, recursive, outputFolder, options: effective, dryRun }))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setRunning(false)
    }
  }

  const pct = progress.total ? (progress.completed / progress.total) * 100 : 0
  const lossy = options.format !== 'png' && options.format !== 'gif'

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">Image Converter</h1>

      <section className="card flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <button className={ghost} onClick={chooseInput} disabled={running}>Choose folder…</button>
          <span className="truncate text-sm">{folder || 'No folder selected'}</span>
        </div>
        <div className="flex items-center gap-2">
          <button className={ghost} onClick={chooseOutput} disabled={running || !folder}>Output folder…</button>
          <span className="truncate text-sm">{outputFolder || '—'}</span>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={recursive} onChange={(e) => setRecursive(e.target.checked)} />
          Include subfolders
        </label>
        {folder && <p className="text-sm opacity-70">{files.length} image(s) found</p>}
      </section>

      <section className="card grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
        <label className="flex flex-col gap-1">
          Format
          <select className={field} value={options.format} onChange={(e) => set('format', e.target.value as ConvertOptions['format'])}>
            {OUTPUT_FORMATS.map((f) => <option key={f} value={f}>{f.toUpperCase()}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Quality: {options.quality}
          <input type="range" min={1} max={100} value={options.quality} disabled={!lossy || options.lossless}
            onChange={(e) => set('quality', Number(e.target.value))} />
        </label>
        <label className="flex flex-col gap-1">
          If file exists
          <select className={field} value={options.conflict} onChange={(e) => set('conflict', e.target.value as ConvertOptions['conflict'])}>
            <option value="rename">Rename</option>
            <option value="skip">Skip</option>
            <option value="overwrite">Overwrite</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Max width (px)
          <input className={field} inputMode="numeric" value={resizeW} onChange={(e) => setResizeW(e.target.value.replace(/\D/g, ''))} />
        </label>
        <label className="flex flex-col gap-1">
          Max height (px)
          <input className={field} inputMode="numeric" value={resizeH} onChange={(e) => setResizeH(e.target.value.replace(/\D/g, ''))} />
        </label>
        <label className="flex flex-col gap-1">
          Background (flatten)
          <input type="color" value={options.background} onChange={(e) => set('background', e.target.value)} />
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={options.lossless} disabled={options.format !== 'webp' && options.format !== 'avif'}
            onChange={(e) => set('lossless', e.target.checked)} />
          Lossless (WebP/AVIF)
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={options.keepMetadata} onChange={(e) => set('keepMetadata', e.target.checked)} />
          Keep metadata (EXIF)
        </label>
      </section>

      <div className="flex gap-2">
        <button className={button} disabled={running || !files.length || !outputFolder} onClick={() => run(false)}>Convert</button>
        <button className={ghost} disabled={running || !files.length || !outputFolder} onClick={() => run(true)}>Dry run</button>
        {running && <button className={ghost} onClick={() => window.api.cancel()}>Cancel</button>}
        {summary && !summary.cancelled && outputFolder && (
          <button className={ghost} onClick={() => window.api.openFolder(outputFolder)}>Open output</button>
        )}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {(running || summary) && (
        <section className="card flex flex-col gap-2">
          <div className="progress-bar"><div className="progress-bar__fill" style={{ width: `${pct}%` }} /></div>
          <p className="text-sm">
            {progress.completed}/{progress.total}
            {summary && ` — ${summary.done} done, ${summary.skipped} skipped, ${summary.failed} failed${summary.cancelled ? ' (cancelled)' : ''}`}
          </p>
          <ul className="max-h-64 overflow-auto text-sm">
            {results.map((r, i) => (
              <li key={i} className="flex justify-between gap-4 py-0.5">
                <span className="truncate">{r.relativePath}</span>
                <span className={r.status === 'error' ? 'text-red-500' : 'opacity-70'}>
                  {r.status === 'done' && r.outputSize !== undefined
                    ? `${fmtSize(r.inputSize)} → ${fmtSize(r.outputSize)}`
                    : r.status === 'error' ? r.error : r.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
