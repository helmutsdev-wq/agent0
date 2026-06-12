import { contextBridge, ipcRenderer } from 'electron'

const api = {
  file: {
    read: (path: string) => ipcRenderer.invoke('file:read', path),
    write: (path: string, content: string) =>
      ipcRenderer.invoke('file:write', path, content),
    exists: (path: string) => ipcRenderer.invoke('file:exists', path)
  },
  bash: {
    exec: (command: string) => ipcRenderer.invoke('bash:exec', command)
  },
  dir: {
    list: (dirPath: string) => ipcRenderer.invoke('dir:list', dirPath)
  },
  platform: process.platform
}

contextBridge.exposeInMainWorld('electronAPI', api)

export type ElectronAPI = typeof api
