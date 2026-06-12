import { contextBridge, ipcRenderer } from 'electron'

const api = {
  file: {
    read: (path: string) => ipcRenderer.invoke('file:read', path),
    write: (path: string, content: string) =>
      ipcRenderer.invoke('file:write', path, content),
    exists: (path: string) => ipcRenderer.invoke('file:exists', path)
  },
  platform: process.platform
}

contextBridge.exposeInMainWorld('electronAPI', api)

export type ElectronAPI = typeof api
