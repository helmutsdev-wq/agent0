/// <reference types="vite/client" />

export {}

declare global {
  interface Window {
    electronAPI: {
      file: {
        read: (path: string) => Promise<{ content?: string; error?: string }>
        readUnsafe: (path: string) => Promise<{ content?: string; error?: string }>
        write: (path: string, content: string) => Promise<{ success?: boolean; error?: string }>
        exists: (path: string) => Promise<boolean>
      }
      bash: {
        exec: (command: string) => Promise<{ output?: string; error?: string }>
      }
      dir: {
        list: (dirPath: string) => Promise<{ items?: Array<{ name: string; isDir: boolean; size: number }>; error?: string }>
        create: (dirPath: string) => Promise<{ success?: boolean; error?: string }>
      }
      web: {
        fetch: (url: string) => Promise<{ content?: string; status?: number; error?: string }>,
        search: (query: string) => Promise<{ content?: string; error?: string }>
      }
      code: {
        search: (pattern: string, searchPath?: string) => Promise<{ content?: string; error?: string }>
        format: (filePath: string) => Promise<{ content?: string; error?: string }>
        test: (command: string) => Promise<{ content?: string; error?: string }>
      },
      workspace: {
        setRoot: (root: string) => Promise<boolean>
        getRoot: () => Promise<string>
        getDefault: () => Promise<string>
      }
      ollama: {
        checkInstalled: () => Promise<{ installed: boolean; running: boolean; platform: string }>
        downloadInstaller: () => Promise<{ success: boolean; path?: string; error?: string; platform?: string }>
        installOllama: (installerPath: string) => Promise<{ success: boolean; error?: string }>
        pullModel: (modelName: string) => Promise<{ success: boolean; error?: string }>
        listPulled: () => Promise<{ models?: Array<{ name: string; size: string }>; error?: string }>
        cancel: () => void
        onProgress: (callback: (data: { stage: string; percent: number; message: string; rawLine?: string }) => void) => () => void
      }
      install: {
        cleanupTemp: (tmpDir: string) => Promise<{ success: boolean }>
      }
      platform: string
    }
      documents: {
        readPdf: (path: string) => Promise<{ content?: string; pages?: number; info?: { pdfVersion?: string; isEncrypted?: boolean }; error?: string }>
        readPdfUnsafe: (path: string) => Promise<{ content?: string; pages?: number; info?: { pdfVersion?: string; isEncrypted?: boolean }; error?: string }>
        readPdfBuffer: (base64: string) => Promise<{ content?: string; pages?: number; info?: { pdfVersion?: string; isEncrypted?: boolean }; error?: string }>
        readDocx: (path: string) => Promise<{ content?: string; error?: string }>
        readDocxUnsafe: (path: string) => Promise<{ content?: string; error?: string }>
        readDocxBuffer: (base64: string) => Promise<{ content?: string; error?: string }>
      }
    }
  }
  }
}
