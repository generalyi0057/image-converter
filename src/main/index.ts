import { join } from 'node:path'
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { convertFolder, scanFolder } from '@core/convert'
import { IPC, type ConvertRequest, type ScanRequest } from '@shared/types'

let current: AbortController | null = null

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1000,
    height: 760,
    minWidth: 760,
    minHeight: 560,
    title: 'Image Converter',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (e) => e.preventDefault())

  if (process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
  return win
}

function registerIpc(): void {
  ipcMain.handle(IPC.pickFolder, async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    const options = { properties: ['openDirectory', 'createDirectory'] as ('openDirectory' | 'createDirectory')[] }
    const res = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
    return res.canceled ? null : res.filePaths[0]
  })

  ipcMain.handle(IPC.scan, (_e, req: ScanRequest) => scanFolder(req.folder, req.recursive))

  ipcMain.handle(IPC.convert, async (e, req: ConvertRequest) => {
    if (current) throw new Error('A conversion is already running')
    current = new AbortController()
    try {
      return await convertFolder({
        inputFolder: req.folder,
        outputFolder: req.outputFolder,
        recursive: req.recursive,
        options: req.options,
        dryRun: req.dryRun,
        signal: current.signal,
        onProgress: (p) => {
          if (!e.sender.isDestroyed()) e.sender.send(IPC.progress, p)
        }
      })
    } finally {
      current = null
    }
  })

  ipcMain.handle(IPC.cancel, () => current?.abort())
  ipcMain.handle(IPC.openFolder, (_e, path: string) => shell.openPath(path).then(() => undefined))
}

app.whenReady().then(() => {
  registerIpc()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
