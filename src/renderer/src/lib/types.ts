export interface AttachedFile {
  id: string
  name: string
  path: string
  size: number
  fileType: 'text' | 'document' | 'image' | 'other'
  content?: string
  imageDataUrl?: string
  error?: string
}

export interface UIMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
  attachments?: AttachedFile[]
}

export interface ToolEvent {
  id: string
  toolName: string
  toolInput: Record<string, unknown>
  status: 'running' | 'done'
  result?: string
  isError?: boolean
}

const TEXT_EXTENSIONS = new Set([
  '.txt', '.md', '.json', '.js', '.ts', '.jsx', '.tsx', '.py', '.rb', '.go', '.rs',
  '.java', '.c', '.cpp', '.h', '.hpp', '.cs', '.swift', '.kt', '.scala',
  '.html', '.css', '.scss', '.less', '.xml', '.yaml', '.yml', '.toml', '.ini', '.cfg',
  '.sh', '.bash', '.ps1', '.bat', '.cmd', '.zsh', '.fish',
  '.env', '.gitignore', '.editorconfig', '.prettierrc', '.eslintrc',
  '.sql', '.r', '.lua', '.pl', '.pm', '.vue', '.svelte', '.astro',
  '.log', '.csv', '.tsv', '.diff', '.patch',
  '.makefile', '.dockerfile', '.conf', '.config', '.properties',
  '.gradle', '.sbt', '.clj', '.cljs', '.ex', '.exs',
])

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp', '.ico'])
const DOCUMENT_EXTENSIONS = new Set(['.pdf', '.docx'])

export function getFileType(ext: string): 'text' | 'document' | 'image' | 'other' {
  if (TEXT_EXTENSIONS.has(ext)) return 'text'
  if (IMAGE_EXTENSIONS.has(ext)) return 'image'
  if (DOCUMENT_EXTENSIONS.has(ext)) return 'document'
  return 'other'
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

let fileIdCounter = Date.now()
export function generateFileId(): string {
  return `file-${++fileIdCounter}`
}

export async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}

export async function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1])
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
