import { contextBridge, ipcRenderer } from 'electron'

export type ProgressCallback = (data: { stage: string; percent: number; message: string; rawLine?: string }) => void

const api = {
  file: {
    read: (path: string) => ipcRenderer.invoke('file:read', path),
    readUnsafe: (path: string) => ipcRenderer.invoke('file:read-unsafe', path),
    write: (path: string, content: string) =>
      ipcRenderer.invoke('file:write', path, content),
    exists: (path: string) => ipcRenderer.invoke('file:exists', path)
  },
  bash: {
    exec: (command: string) => ipcRenderer.invoke('bash:exec', command)
  },
  dir: {
    list: (dirPath: string) => ipcRenderer.invoke('dir:list', dirPath),
    create: (dirPath: string) => ipcRenderer.invoke('dir:create', dirPath)
  },
  web: {
    fetch: (url: string) => ipcRenderer.invoke('web:fetch', url),
    search: (query: string) => ipcRenderer.invoke('web:search', query)
  },
  code: {
    search: (pattern: string, searchPath?: string) => ipcRenderer.invoke('code:search', pattern, searchPath),
    format: (filePath: string) => ipcRenderer.invoke('code:format', filePath),
    test: (command: string) => ipcRenderer.invoke('code:test', command)
  },
  workspace: {
    setRoot: (root: string) => ipcRenderer.invoke('workspace:set-root', root),
    getRoot: () => ipcRenderer.invoke('workspace:get-root'),
    getDefault: () => ipcRenderer.invoke('workspace:get-default')
  },
  documents: {
    readPdf: (path: string) => ipcRenderer.invoke('documents:read-pdf', path),
    readPdfUnsafe: (path: string) => ipcRenderer.invoke('documents:read-pdf-unsafe', path),
    readPdfBuffer: (base64: string) => ipcRenderer.invoke('documents:read-pdf-buffer', { base64 }),
    readDocx: (path: string) => ipcRenderer.invoke('documents:read-docx', path),
    readDocxUnsafe: (path: string) => ipcRenderer.invoke('documents:read-docx-unsafe', path),
    readDocxBuffer: (base64: string) => ipcRenderer.invoke('documents:read-docx-buffer', { base64 })
  },
  ollama: {
    checkInstalled: () => ipcRenderer.invoke('ollama:check-installed'),
    downloadInstaller: () => ipcRenderer.invoke('ollama:download-installer'),
    installOllama: (installerPath: string) =>
      ipcRenderer.invoke('ollama:install-ollama', installerPath),
    pullModel: (modelName: string) =>
      ipcRenderer.invoke('ollama:pull-model', modelName),
    listPulled: () => ipcRenderer.invoke('ollama:list-pulled'),
    cancel: () => { ipcRenderer.send('ollama:cancel') },
    onProgress: (callback: ProgressCallback) => {
      const handler = (_event: Electron.IpcRendererEvent, data: Parameters<ProgressCallback>[0]) => callback(data)
      ipcRenderer.on('ollama:progress', handler)
      return () => ipcRenderer.removeListener('ollama:progress', handler)
    }
  },
  install: {
    cleanupTemp: (tmpDir: string) => ipcRenderer.invoke('install:cleanup-temp', tmpDir)
  },
  platform: process.platform
}

contextBridge.exposeInMainWorld('electronAPI', api)

export type ElectronAPI = typeof api
