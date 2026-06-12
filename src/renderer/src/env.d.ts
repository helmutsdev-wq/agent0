/// <reference types="vite/client" />

interface ElectronAPI {
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
  platform: string
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
