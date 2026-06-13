import { contextBridge, ipcRenderer } from 'electron'

export type ProgressCallback = (data: { stage: string; percent: number; message: string }) => void

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
  web: {
    fetch: (url: string) => ipcRenderer.invoke('web:fetch', url)
  },
  workspace: {
    setRoot: (root: string) => ipcRenderer.invoke('workspace:set-root', root),
    getRoot: () => ipcRenderer.invoke('workspace:get-root')
  },
  ollama: {
    checkInstalled: () => ipcRenderer.invoke('ollama:check-installed'),
    downloadInstaller: () => ipcRenderer.invoke('ollama:download-installer'),
    installOllama: (installerPath: string) =>
      ipcRenderer.invoke('ollama:install-ollama', installerPath),
    pullModel: (modelName: string) =>
      ipcRenderer.invoke('ollama:pull-model', modelName),
    onProgress: (callback: ProgressCallback) => {
      const handler = (_event: Electron.IpcRendererEvent, data: Parameters<ProgressCallback>[0]) => callback(data)
      ipcRenderer.on('ollama:progress', handler)
      return () => ipcRenderer.removeListener('ollama:progress', handler)
    }
  },
  platform: process.platform
}

contextBridge.exposeInMainWorld('electronAPI', api)

export type ElectronAPI = typeof api
