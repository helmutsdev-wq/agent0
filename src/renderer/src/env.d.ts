/// <reference types="vite/client" />

interface ElectronAPI {
  file: {
    read: (path: string) => Promise<{ content?: string; error?: string }>
    write: (path: string, content: string) => Promise<{ success?: boolean; error?: string }>
    exists: (path: string) => Promise<boolean>
  }
  platform: string
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
