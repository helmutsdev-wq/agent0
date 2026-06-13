/// <reference types="vite/client" />

export {}

declare global {
  interface Window {
    electronAPI: {
      file: {
        read: (path: string) => Promise<{ content?: string; error?: string }>
        write: (path: string, content: string) => Promise<{ success?: boolean; error?: string }>
        exists: (path: string) => Promise<boolean>
      }
      bash: {
        exec: (command: string) => Promise<{ output?: string; error?: string }>
      }
      dir: {
        list: (dirPath: string) => Promise<{ items?: Array<{ name: string; isDir: boolean; size: number }>; error?: string }>
      }
      web: {
        fetch: (url: string) => Promise<{ content?: string; status?: number; error?: string }>,
        search: (query: string) => Promise<{ content?: string; error?: string }>
      }
      workspace: {
        setRoot: (root: string) => Promise<boolean>
        getRoot: () => Promise<string>
      }
      ollama: {
        checkInstalled: () => Promise<{ installed: boolean; running: boolean; platform: string }>
        downloadInstaller: () => Promise<{ success: boolean; path?: string; error?: string; platform?: string }>
        installOllama: (installerPath: string) => Promise<{ success: boolean; error?: string }>
        pullModel: (modelName: string) => Promise<{ success: boolean; error?: string }>
        onProgress: (callback: (data: { stage: string; percent: number; message: string }) => void) => () => void
      }
      platform: string
    }
  }
}
