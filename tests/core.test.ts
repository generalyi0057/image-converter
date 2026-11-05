import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { convertFolder, scanFolder } from '../src/core/convert'
import type { ConvertOptions } from '../src/shared/types'

const options: ConvertOptions = {
  format: 'webp', quality: 80, lossless: false, resize: null,
  keepMetadata: false, background: '#ffffff', conflict: 'rename'
}

let dir: string

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'imgconv-'))
  const png = await sharp({ create: { width: 40, height: 20, channels: 4, background: '#f00' } }).png().toBuffer()
  await writeFile(join(dir, 'a.png'), png)
  await writeFile(join(dir, 'notes.txt'), 'x')
})

afterAll(() => rm(dir, { recursive: true, force: true }))

describe('core', () => {
  it('scans only images', async () => {
    const files = await scanFolder(dir, false)
    expect(files.map((f) => f.relativePath)).toEqual(['a.png'])
  })

  it('converts and renames on conflict', async () => {
    const out = join(dir, 'out')
    const first = await convertFolder({ inputFolder: dir, outputFolder: out, recursive: false, options })
    expect(first).toMatchObject({ total: 1, done: 1, failed: 0 })
    await convertFolder({ inputFolder: dir, outputFolder: out, recursive: false, options })
    expect((await readdir(out)).sort()).toEqual(['a (1).webp', 'a.webp'])
  })

  it('dry run writes nothing', async () => {
    const out = join(dir, 'dry')
    const s = await convertFolder({ inputFolder: dir, outputFolder: out, recursive: false, options, dryRun: true })
    expect(s.done).toBe(1)
    await expect(readdir(out)).rejects.toThrow()
  })
})
