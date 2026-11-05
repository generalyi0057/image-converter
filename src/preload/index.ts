import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type ImageConverterApi, type ProgressEvent } from '../shared/types'

const api: ImageConverterApi = {
  pickFolder: () => ipcRenderer.invoke(IPC.pickFolder),
  scan: (req) => ipcRenderer.invoke(IPC.scan, req),
  convert: (req) => ipcRenderer.invoke(IPC.convert, req),
  cancel: () => ipcRenderer.invoke(IPC.cancel),
  openFolder: (path) => ipcRenderer.invoke(IPC.openFolder, path),
  onProgress: (cb) => {
    const handler = (_e: unknown, p: ProgressEvent): void => cb(p)
    ipcRenderer.on(IPC.progress, handler)
    return () => ipcRenderer.removeListener(IPC.progress, handler)
  }
}

contextBridge.exposeInMainWorld('api', api)
