# Image Converter

A desktop app that batch-converts the images in a folder. Built with Electron, React and [sharp](https://sharp.pixelplumbing.com/).

## Features

- Convert a whole folder (optionally including subfolders) in one run
- Output formats: JPEG, PNG, WebP, AVIF, TIFF, GIF
- Input formats: JPG, PNG, WebP, AVIF, TIFF, GIF, SVG, HEIC/HEIF
- Quality, lossless mode, resize (width/height and fit), background colour and metadata options
- Conflict handling when the output file exists: rename, skip or overwrite
- Dry run to preview what would be written
- Progress reporting and cancellation
- Never overwrites the source file itself

## Requirements

- Node.js 18 or newer
- npm

## Getting started

```bash
npm install
npm run dev
```

If `npm run dev` fails with `Electron uninstall`, download the Electron binary manually:

```bash
node node_modules/electron/install.js
```

## Scripts

| Command             | Description                                    |
| ------------------- | ---------------------------------------------- |
| `npm run dev`       | Start the app in development mode              |
| `npm run build`     | Build the main, preload and renderer bundles   |
| `npm run preview`   | Preview the production build                   |
| `npm run dist`      | Build and package an installer (electron-builder) |
| `npm run typecheck` | Type-check the Node and web projects           |
| `npm test`          | Run the unit tests (Vitest)                    |

## Project structure

```
src/
  main/       Electron main process and IPC handlers
  preload/    Context-isolated bridge exposing the `api` object
  renderer/   React UI
  core/       Conversion logic (scan, resize, encode)
  shared/     Types and IPC channel names shared across processes
tests/        Unit tests
```

## Notes on HEIC/HEIF

sharp's prebuilt binaries cannot decode HEVC, the codec used by most `.HEIC` photos. These files are decoded with [heic-decode](https://github.com/catdad-experiments/heic-decode) and the pixels are then passed to sharp. This is slower than native decoding, and EXIF and other metadata are not carried over for HEIC inputs.

## License

MIT
