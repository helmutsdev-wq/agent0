import { useEffect, useRef, useState, useCallback, useReducer } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useChat, ToolEvent } from './hooks/useChat'
import { initProviders, getConfigs, getProvider } from './lib/providers'
import { setAgentConfig, getAgentConfig, restoreAgentConfig, Mode } from './lib/agent'
import { SettingsDialog } from './components/SettingsDialog'
import { SessionSidebar } from './components/SessionSidebar'
import { useLanguage } from './lib/i18n'
import { startEvolutionTrigger, stopEvolutionTrigger, noteUserTurn } from './lib/evolution/trigger'
import { initMemoryFiles } from './lib/memory'
import {
  AttachedFile, getFileType, formatFileSize,
  generateFileId, readFileAsDataUrl, readFileAsText, readFileAsBase64
} from './lib/types'

function ModelSelector({ label, onSelect }: { label: string; onSelect: () => void }) {
  const [open, setOpen] = useState(false)
  const configs = getConfigs()

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
      >
        {label || 'Select model'}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-50" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 mb-1 z-50 w-64 max-h-64 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] shadow-xl">
            {configs.map(c => (
              <div key={c.id}>
                <div className="px-3 py-1.5 text-[10px] text-[var(--text-secondary)] font-medium uppercase">
                  {c.name}
                </div>
                {c.models.map(m => (
                  <button
                    key={m.id}
                    disabled={!m.available}
                    onClick={() => {
                      setAgentConfig({ provider: c.id, model: m.id })
                      onSelect()
                      setOpen(false)
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--bg-tertiary)] transition-colors ${!m.available ? 'text-[var(--text-secondary)] opacity-40 cursor-not-allowed' : 'text-[var(--text-primary)]'
                      }`}
                  >
                    {m.name}
                    {!m.available ? ` (${m.cost === 'free' ? 'unavailable' : ''})` : ''}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function ToolEventCard({ event }: { event: ToolEvent }) {
  const { t } = useLanguage()
  const [expanded, setExpanded] = useState(false)
  const isRunning = event.status === 'running'

  return (
    <div
      className="rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)]/50 overflow-hidden cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-2 px-3 py-2 text-xs">
        {isRunning ? (
          <div className="w-3 h-3 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin shrink-0" />
        ) : event.isError ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-red-400 shrink-0">
            <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-400 shrink-0">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
        <span className="text-[var(--text-secondary)]">
          {isRunning ? t('tool.running') : event.isError ? t('tool.failed') : t('tool.completed')}{' '}
          <span className="text-[var(--text-primary)] font-medium">{event.toolName}</span>
        </span>
        <span className="text-[var(--text-secondary)] ml-auto text-[10px]">
          {expanded ? '▾' : '▸'}
        </span>
      </div>
      {expanded && (
        <div className="px-3 pb-2 space-y-1.5 text-[10px]">
          {event.toolInput && Object.keys(event.toolInput).length > 0 && (
            <div>
              <span className="text-[var(--text-secondary)]">{t('tool.input')}: </span>
              <code className="text-[var(--text-primary)] bg-[var(--bg-primary)] px-1 py-0.5 rounded">
                {JSON.stringify(event.toolInput)}
              </code>
            </div>
          )}
          {event.result && (
            <div>
              <span className="text-[var(--text-secondary)]">{t('tool.result')}: </span>
              <pre className="text-[var(--text-primary)] bg-[var(--bg-primary)] px-2 py-1 rounded mt-0.5 max-h-24 overflow-y-auto whitespace-pre-wrap">
                {event.result.slice(0, 500)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const markdownComponents = {
  code({ className, children, ...props }: { className?: string; children?: React.ReactNode }) {
    const match = /language-(\w+)/.exec(className || '')
    const isInline = !match && !className
    if (isInline) {
      return (
        <code className="px-1 py-0.5 rounded bg-[var(--bg-primary)] text-xs" {...props}>
          {children}
        </code>
      )
    }
    return (
      <div className="relative my-2">
        <div className="flex items-center justify-between px-3 py-1.5 rounded-t-lg bg-[var(--bg-primary)] border-b border-[var(--border)]">
          <span className="text-[10px] text-[var(--text-secondary)] uppercase">
            {match?.[1] || 'code'}
          </span>
          <button
            onClick={() => navigator.clipboard.writeText(String(children))}
            className="text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            Copy
          </button>
        </div>
        <code className={`block px-3 py-2 rounded-b-lg bg-[var(--bg-primary)] text-xs overflow-x-auto ${className || ''}`} {...props}>
          {children}
        </code>
      </div>
    )
  },
  pre({ children }: { children?: React.ReactNode }) {
    return <>{children}</>
  },
  a({ href, children }: { href?: string; children?: React.ReactNode }) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">
        {children}
      </a>
    )
  },
  details({ children, ...props }: { children?: React.ReactNode }) {
    return (
      <details className="my-2 rounded-lg border border-[var(--border)] overflow-hidden" {...props}>
        {children}
      </details>
    )
  },
  summary({ children, ...props }: { children?: React.ReactNode }) {
    return (
      <summary className="px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] cursor-pointer hover:text-[var(--text-primary)] bg-[var(--bg-tertiary)] select-none" {...props}>
        {children}
      </summary>
    )
  },
  img({ src, alt }: { src?: string; alt?: string }) {
    if (!src) return null
    return (
      <img
        src={src}
        alt={alt || ''}
        loading="lazy"
        className="max-w-full rounded-lg my-2"
        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
      />
    )
  }
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      className="opacity-0 group-hover:opacity-100 transition-all duration-200 p-1 rounded hover:bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      title="Copy message"
    >
      {copied ? (
        <span className="text-[10px] text-emerald-400 font-medium px-0.5">Copied!</span>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  )
}

function useTheme(): { theme: string; toggleTheme: () => void } {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('agent0_theme') || 'dark'
    document.documentElement.dataset.theme = saved
    return saved
  })

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark'
      localStorage.setItem('agent0_theme', next)
      document.documentElement.dataset.theme = next
      return next
    })
  }, [])

  return { theme, toggleTheme }
}

function App() {
  const { t } = useLanguage()
  const { theme, toggleTheme } = useTheme()
  const { messages, isLoading, error, toolEvents, statusLines, activeModelLabel, sessionStats, realTokens, sendMessage, stopGeneration, clearMessages, sessions, activeSessionId, createSession, switchSession, deleteSession } = useChat()
  const [input, setInput] = useState('')
  const [pendingFiles, setPendingFiles] = useState<AttachedFile[]>([])
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<string | undefined>()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [zoom, setZoom] = useState(() => {
    try { return parseInt(localStorage.getItem('agent0_zoom') || '100') } catch { return 100 }
  })
  const [showScrollBottom, setShowScrollBottom] = useState(false)
  const [showFirstLaunchBanner, setShowFirstLaunchBanner] = useState(false)
  const [sentHistory, setSentHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [historyDraft, setHistoryDraft] = useState('')

  const [isDragOver, setIsDragOver] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounterRef = useRef(0)
  const sessionsRef = useRef(sessions)

  const hasMessages = messages.length > 1
  const forceUpdate = useReducer(n => n + 1, 0)[1]

  const adjustZoom = useCallback((delta: number) => {
    setZoom(prev => {
      const next = Math.max(70, Math.min(150, prev + delta))
      localStorage.setItem('agent0_zoom', String(next))
      return next
    })
  }, [])

  const SUGGESTIONS = [
    t('suggest.trip'),
    t('suggest.email'),
    t('suggest.summarize'),
    t('suggest.research'),
    t('suggest.explain'),
    t('suggest.brainstorm')
  ]

  useEffect(() => {
    sessionsRef.current = sessions
  }, [sessions])

  useEffect(() => {
    restoreAgentConfig()
    let cancelled = false
    initProviders().then(async () => {
      if (cancelled) return
      const configs = getConfigs()
      const hasAnyAvailable = configs.some(c => c.models.some(m => m.available))
      const hasBeenPrompted = localStorage.getItem('agent0_first_launch_prompted')
      if (!hasAnyAvailable && !hasBeenPrompted) {
        setShowFirstLaunchBanner(true)
      }
      // Auto-set workspace root if not configured
      let ws = getAgentConfig().workspaceRoot
      if (!ws) {
        ws = await window.electronAPI.workspace.getDefault()
        setAgentConfig({ workspaceRoot: ws })
        window.electronAPI.workspace.setRoot(ws)
      }
      initMemoryFiles(ws)
      startEvolutionTrigger(() => sessionsRef.current)
      forceUpdate()
    })
    return () => { cancelled = true; stopEvolutionTrigger() }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    setShowScrollBottom(!atBottom)
  }

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const processFiles = useCallback(async (fileList: FileList) => {
    const newFiles: AttachedFile[] = []
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i]
      const name = file.name
      const ext = name.toLowerCase().includes('.')
        ? '.' + name.split('.').pop()!.toLowerCase()
        : ''
      const fileType = getFileType(ext)
      const attached: AttachedFile = {
        id: generateFileId(),
        name,
        path: name,
        size: file.size,
        fileType
      }
      try {
        if (fileType === 'text') {
          attached.content = await readFileAsText(file)
        } else if (fileType === 'image') {
          attached.imageDataUrl = await readFileAsDataUrl(file)
        } else if (fileType === 'document') {
          const base64 = await readFileAsBase64(file)
          if (ext === '.pdf') {
            const res = await window.electronAPI.documents.readPdfBuffer(base64)
            attached.content = res.content || ''
            if (res.error) attached.error = res.error
          } else {
            const res = await window.electronAPI.documents.readDocxBuffer(base64)
            attached.content = res.content || ''
            if (res.error) attached.error = res.error
          }
        } else {
          attached.content = await readFileAsText(file)
        }
      } catch (e) {
        attached.error = (e as Error).message
      }
      newFiles.push(attached)
    }
    setPendingFiles(prev => {
      const existing = new Set(prev.map(f => f.path))
      const unique = newFiles.filter(f => !existing.has(f.path))
      return [...prev, ...unique]
    })
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current++
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragOver(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) {
      setIsDragOver(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    dragCounterRef.current = 0
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files)
    }
  }, [processFiles])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files)
    }
    e.target.value = ''
  }, [processFiles])

  const removePendingFile = useCallback((id: string) => {
    setPendingFiles(prev => prev.filter(f => f.id !== id))
  }, [])

  const recheckProviders = useCallback(() => {
    initProviders()
  }, [])

  const currentConfig = getAgentConfig()
  const currentProvider = getProvider(currentConfig.provider)
  const currentModelLabel = `${currentProvider?.name || currentConfig.provider} / ${currentConfig.model}`

  const handleSend = useCallback(async (text?: string) => {
    const content = text || input.trim()
    if ((!content && pendingFiles.length === 0) || isLoading) return
    const files = pendingFiles.length > 0 ? [...pendingFiles] : undefined
    if (content) {
      setSentHistory(prev => [...prev, content])
    }
    setHistoryIndex(-1)
    setHistoryDraft('')
    setInput('')
    setPendingFiles([])
    await sendMessage(content, files)
  }, [input, isLoading, sendMessage, pendingFiles])

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between px-4 py-3 shrink-0 border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            title="Toggle sidebar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div className="flex items-center justify-center shrink-0">
            <svg viewBox="17 17 30 30" className="h-9 w-auto" style={{ maxWidth: 'none' }}>
              <rect width="22.05" height="22.05" x="21" y="20.98" fill="#6c5ce7" />
              <path d="M43.06,43.37h-22.05c-.19,0-.34-.15-.34-.34v-22.05c0-.19.15-.34.34-.34h22.05c.19,0,.34.15.34.34v22.05c0,.19-.15.34-.34.34ZM21.35,42.69h21.37v-21.37h-21.37v21.37Z" fill="#6854b0" />
              <rect width="19.45" height="19.45" x="22.31" y="22.28" rx="1.31" ry="1.31" fill="#f4f0ff" />
              <path d="M40.44,42.07h-16.83c-.91,0-1.65-.74-1.65-1.65v-16.83c0-.91.74-1.65,1.65-1.65h16.83c.91,0,1.65.74,1.65,1.65v16.83c0,.91-.74,1.65-1.65,1.65ZM23.62,22.62c-.54,0-.97.44-.97.97v16.83c0,.54.44.97.97.97h16.83c.54,0,.97-.44.97-.97v-16.83c0-.53-.44-.97-.97-.97h-16.83Z" fill="#6854b0" />
            <path d="M37.25,36.54c-.3,0-.62-.02-.97-.06-1.62-.19-3.6-.8-5.57-1.72-1.97-.92-3.7-2.05-4.89-3.17-1.29-1.23-1.77-2.3-1.4-3.1.83-1.78,5.18-.91,8.84.81,1.97.92,3.7,2.05,4.89,3.17,1.29,1.23,1.77,2.3,1.4,3.1-.3.64-1.09.98-2.3.98ZM26.73,28.19c-.9,0-1.5.2-1.68.59-.23.49.24,1.36,1.25,2.32,1.13,1.07,2.8,2.16,4.71,3.05,1.9.89,3.81,1.48,5.36,1.66,1.39.16,2.35-.04,2.58-.53.23-.49-.24-1.36-1.25-2.32-1.13-1.07-2.8-2.16-4.7-3.05-2.53-1.18-4.79-1.72-6.25-1.72Z" fill="#6854b0" />
            <path d="M26.69,37.33c-.79,0-1.35-.23-1.65-.69-.49-.74-.17-1.87.92-3.27,1-1.29,2.55-2.66,4.36-3.86,3.37-2.24,7.54-3.74,8.62-2.11,1.09,1.63-1.91,4.9-5.28,7.14h0c-1.81,1.2-3.68,2.1-5.25,2.53-.66.18-1.23.27-1.72.27ZM37.29,27.4c-1.4,0-3.88.88-6.59,2.68-1.75,1.16-3.24,2.48-4.2,3.71-.86,1.1-1.19,2.03-.89,2.48.3.45,1.28.5,2.63.14,1.5-.41,3.3-1.27,5.05-2.44h0c3.76-2.5,5.7-5.27,5.09-6.19-.17-.26-.55-.38-1.08-.38Z" fill="#6854b0" />
            <path d="M31.99,40.37c-1.96,0-3.02-4.3-3.02-8.35s1.06-8.35,3.02-8.35,3.02,4.3,3.02,8.35-1.06,8.35-3.02,8.35ZM31.99,24.36c-1.1,0-2.34,3.15-2.34,7.67s1.23,7.67,2.34,7.67,2.34-3.15,2.34-7.67-1.23-7.67-2.34-7.67Z" fill="#6854b0" />
            <circle cx="31.99" cy="32.02" r="2.02" fill="#937bec" />
            <path d="M31.99,34.22c-1.21,0-2.19-.98-2.19-2.19s.98-2.19,2.19-2.19,2.19.98,2.19,2.19-.98,2.19-2.19,2.19ZM31.99,30.17c-1.02,0-1.85.83-1.85,1.85s.83,1.85,1.85,1.85,1.85-.83,1.85-1.85-.83-1.85-1.85-1.85Z" fill="#6854b0" />
            <path d="M52.85,24.47h-2.95c-.12,0-.23-.06-.29-.17l-1.78-3h-4.76c-.19,0-.34-.15-.34-.34s.15-.34.34-.34h4.95c.12,0,.23.06.29.17l1.78,3h2.76c.19,0,.34.15.34.34s-.15.34-.34.34Z" fill="#6854b0" />
            <path d="M57.58 26.98h-8.33c-.11 0-.21-.05-.28-.14l-2.07-2.92h-3.79c-.19 0-.34-.15-.34-.34s.15-.34.34-.34h3.97c.11 0 .21.05.28.14l2.07 2.92h8.16c.19 0 .34.15.34.34s-.15.34-.34.34ZM48.2 29.62h-2.29c-.13 0-.26-.08-.31-.2l-1.29-2.9h-1.25c-.19 0-.34-.15-.34-.34s.15-.34.34-.34h1.47c.13 0 .26.08.31.2l1.29 2.9h2.07c.19 0 .34.15.34.34s-.15.34-.34.34ZM48.02 43.37h-4.94c-.19 0-.34-.15-.34-.34s.15-.34.34-.34h4.74l1.77-3.09c.06-.11.17-.17.3-.17h2.95c.19 0 .34.15.34.34s-.15.34-.34.34h-2.75l-1.77 3.09c-.06.11-.17.17-.3.17Z" fill="#6854b0" />
            <path d="M47.08 40.71h-3.97c-.19 0-.34-.15-.34-.34s.15-.34.34-.34h3.79l2.07-3.01c.06-.09.17-.15.28-.15h8.34c.19 0 .34.15.34.34s-.15.34-.34.34h-8.16l-2.07 3.01c-.06.09-.17.15-.28.15ZM44.53 38.02h-1.46c-.19 0-.34-.15-.34-.34s.15-.34.34-.34h1.24l1.28-2.99c.05-.13.18-.21.31-.21h2.27c.19 0 .34.15.34.34s-.15.34-.34.34h-2.05l-1.28 2.99c-.05.13-.18.21-.31.21Z" fill="#6854b0" />
            <circle cx="54.11" cy="24.13" r="1.18" fill="#937bec" />
            <path d="M54.11,25.64c-.84,0-1.52-.68-1.52-1.52s.68-1.52,1.52-1.52,1.52.68,1.52,1.52-.68,1.52-1.52,1.52ZM54.11,23.29c-.46,0-.83.37-.83.83s.37.83.83.83.83-.37.83-.83-.37-.83-.83-.83Z" fill="#6854b0" />
            <circle cx="58.89" cy="26.64" r="1.18" fill="#937bec" />
            <path d="M58.89,28.15c-.84,0-1.52-.68-1.52-1.52s.68-1.52,1.52-1.52,1.52.68,1.52,1.52-.68,1.52-1.52,1.52ZM58.89,25.8c-.46,0-.83.37-.83.83s.37.83.83.83.83-.37.83-.83-.37-.83-.83-.83Z" fill="#6854b0" />
            <circle cx="49.46" cy="29.28" r="1.18" fill="#937bec" />
            <path d="M49.46,30.79c-.84,0-1.52-.68-1.52-1.52s.68-1.52,1.52-1.52,1.52.68,1.52,1.52-.68,1.52-1.52,1.52ZM49.46,28.44c-.46,0-.83.37-.83.83s.37.83.83.83.83-.37.83-.83-.37-.83-.83-.83Z" fill="#6854b0" />
            <circle cx="49.46" cy="34.48" r="1.18" fill="#937bec" />
            <path d="M49.46,36c-.84,0-1.52-.68-1.52-1.52s.68-1.52,1.52-1.52,1.52.68,1.52,1.52-.68,1.52-1.52,1.52ZM49.46,33.65c-.46,0-.83.37-.83.83s.37.83.83.83.83-.37.83-.83-.37-.83-.83-.83Z" fill="#6854b0" />
            <circle cx="58.89" cy="37.21" r="1.18" fill="#937bec" />
            <path d="M58.89,38.72c-.84,0-1.52-.68-1.52-1.52s.68-1.52,1.52-1.52,1.52.68,1.52,1.52-.68,1.52-1.52,1.52ZM58.89,36.37c-.46,0-.83.37-.83.83s.37.83.83.83.83-.37.83-.83-.37-.83-.83-.83Z" fill="#6854b0" />
            <circle cx="54.11" cy="39.77" r="1.18" fill="#937bec" />
            <path d="M54.11,41.29c-.84,0-1.52-.68-1.52-1.52s.68-1.52,1.52-1.52,1.52.68,1.52,1.52-.68,1.52-1.52,1.52ZM54.11,38.94c-.46,0-.83.37-.83.83s.37.83.83.83.83-.37.83-.83-.37-.83-.83-.83Z" fill="#6854b0" />
            <path d="M57.66,32.34h-14.58c-.19,0-.34-.15-.34-.34s.15-.34.34-.34h14.58c.19,0,.34.15.34.34s-.15.34-.34.34Z" fill="#6854b0" />
            <circle cx="58.89" cy="32" r="1.18" fill="#937bec" />
            <path d="M58.89,33.51c-.84,0-1.52-.68-1.52-1.52s.68-1.52,1.52-1.52,1.52.68,1.52,1.52-.68,1.52-1.52,1.52ZM58.89,31.16c-.46,0-.83.37-.83.83s.37.83.83.83.83-.37.83-.83-.37-.83-.83-.83Z" fill="#6854b0" />
            <path d="M14.13,24.47h-2.95c-.19,0-.34-.15-.34-.34s.15-.34.34-.34h2.75l1.77-3c.06-.1.17-.17.29-.17h4.94c.19,0,.34.15.34.34s-.15.34-.34.34h-4.75l-1.77,3c-.06.1-.17.17-.29.17Z" fill="#6854b0" />
            <path d="M14.74 26.98H6.35c-.19 0-.34-.15-.34-.34s.15-.34.34-.34h8.21l2.08-2.92c.06-.09.17-.14.28-.14h4c.19 0 .34.15.34.34s-.15.34-.34.34h-3.82l-2.08 2.92c-.06.09-.17.14-.28.14ZM18.09 29.62h-2.31c-.19 0-.34-.15-.34-.34s.15-.34.34-.34h2.09l1.31-2.9c.06-.12.18-.2.31-.2h1.49c.19 0 .34.15.34.34s-.15.34-.34.34h-1.27l-1.31 2.9c-.06.12-.18.2-.31.2ZM21.01 43.38h-4.97c-.12 0-.23-.07-.3-.17l-1.79-3.09h-2.77c-.19 0-.34-.15-.34-.34s.15-.34.34-.34h2.97c.12 0 .23.07.3.17l1.79 3.09h4.78c.19 0 .34.15.34.34s-.15.34-.34.34Z" fill="#6854b0" />
            <path d="M20.88 40.71h-3.98c-.11 0-.22-.06-.28-.15l-2.07-3.01H6.37c-.19 0-.34-.15-.34-.34s.15-.34.34-.34h8.35c.11 0 .22.06.28.15l2.07 3.01h3.8c.19 0 .34.15.34.34s-.15.34-.34.34ZM21 38.02h-1.48c-.14 0-.26-.08-.31-.21l-1.3-2.99h-2.07c-.19 0-.34-.15-.34-.34s.15-.34.34-.34h2.3c.14 0 .26.08.31.21l1.3 2.99h1.25c.19 0 .34.15.34.34s-.15.34-.34.34Z" fill="#6854b0" />
            <circle cx="9.89" cy="24.13" r="1.18" fill="#937bec" />
            <path d="M9.89,25.65c-.84,0-1.52-.68-1.52-1.52s.68-1.52,1.52-1.52,1.52.68,1.52,1.52-.68,1.52-1.52,1.52ZM9.89,23.3c-.46,0-.83.37-.83.83s.37.83.83.83.83-.37.83-.83-.37-.83-.83-.83Z" fill="#6854b0" />
            <circle cx="5.11" cy="26.64" r="1.18" fill="#937bec" />
            <path d="M5.11,28.16c-.84,0-1.52-.68-1.52-1.52s.68-1.52,1.52-1.52,1.52.68,1.52,1.52-.68,1.52-1.52,1.52ZM5.11,25.81c-.46,0-.83.37-.83.83s.37.83.83.83.83-.37.83-.83-.37-.83-.83-.83Z" fill="#6854b0" />
            <circle cx="14.54" cy="29.28" r="1.18" fill="#937bec" />
            <path d="M14.54,30.8c-.84,0-1.52-.68-1.52-1.52s.68-1.52,1.52-1.52,1.52.68,1.52,1.52-.68,1.52-1.52,1.52ZM14.54,28.45c-.46,0-.83.37-.83.83s.37.83.83.83.83-.37.83-.83-.37-.83-.83-.83Z" fill="#6854b0" />
            <circle cx="14.54" cy="34.48" r="1.18" fill="#937bec" />
            <path d="M14.54,36c-.84,0-1.52-.68-1.52-1.52s.68-1.52,1.52-1.52,1.52.68,1.52,1.52-.68,1.52-1.52,1.52ZM14.54,33.65c-.46,0-.83.37-.83.83s.37.83.83.83.83-.37.83-.83-.37-.83-.83-.83Z" fill="#6854b0" />
            <circle cx="5.11" cy="37.21" r="1.18" fill="#937bec" />
            <path d="M5.11,38.73c-.84,0-1.52-.68-1.52-1.52s.68-1.52,1.52-1.52,1.52.68,1.52,1.52-.68,1.52-1.52,1.52ZM5.11,36.38c-.46,0-.83.37-.83.83s.37.83.83.83.83-.37.83-.83-.37-.83-.83-.83Z" fill="#6854b0" />
            <circle cx="9.89" cy="39.77" r="1.18" fill="#937bec" />
            <path d="M9.89,41.29c-.84,0-1.52-.68-1.52-1.52s.68-1.52,1.52-1.52,1.52.68,1.52,1.52-.68,1.52-1.52,1.52ZM9.89,38.94c-.46,0-.83.37-.83.83s.37.83.83.83.83-.37.83-.83-.37-.83-.83-.83Z" fill="#6854b0" />
            <path d="M20.99,32.34H6.41c-.19,0-.34-.15-.34-.34s.15-.34.34-.34h14.57c.19,0,.34.15.34.34s-.15.34-.34.34Z" fill="#6854b0" />
            <circle cx="5.11" cy="32" r="1.18" fill="#937bec" />
            <path d="M5.11,33.52c-.84,0-1.52-.68-1.52-1.52s.68-1.52,1.52-1.52,1.52.68,1.52,1.52-.68,1.52-1.52,1.52ZM5.11,31.17c-.46,0-.83.37-.83.83s.37.83.83.83.83-.37.83-.83-.37-.83-.83-.83Z" fill="#6854b0" />
          </svg>
          </div>
          <span className="font-bold text-[15px] tracking-tight text-[var(--secondary)] ">Agent O</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => adjustZoom(-10)}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            title="Zoom out"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          </button>
          <span className="text-[11px] text-[var(--text-secondary)] w-8 text-center font-mono">{zoom}%</span>
          <button
            onClick={() => adjustZoom(10)}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            title="Zoom in"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          </button>
          <div className="w-px h-4 bg-[var(--border)] mx-1" />
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            title={t('app.settings')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden relative">
        <SessionSidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onCreate={createSession}
          onSwitch={switchSession}
          onDelete={deleteSession}
          open={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
        />
        <div className="flex flex-col flex-1 min-w-0" style={{ zoom: `${zoom}%` }}>

          <div
            className="flex-1 overflow-y-auto px-6 relative"
            ref={scrollRef}
            onScroll={handleScroll}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {isDragOver && (
              <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
                <div className="rounded-2xl border-2 border-dashed border-[var(--accent)]/50 bg-[var(--bg-primary)]/80 backdrop-blur-sm px-8 py-6 text-center">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-2 text-[var(--accent)]">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{t('app.dropFiles')}</p>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t('app.dropFilesDesc')}</p>
                </div>
              </div>
            )}

            {hasMessages ? (
              <div className="max-w-3xl mx-auto space-y-5 py-4">
                {messages.slice(1).map(msg => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${msg.role === 'user'
                        ? 'bg-[var(--accent)] text-white rounded-br-sm'
                        : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-bl-sm group'
                        }`}
                    >
                      {msg.role === 'user' ? (
                        <div>
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-2">
                              {msg.attachments.map(f => (
                                <div key={f.id} className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/10 text-[10px]">
                                  {f.fileType === 'image' ? (
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /></svg>
                                  ) : (
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                                  )}
                                  <span className="truncate max-w-[120px]">{f.name}</span>
                                </div>
                              ))}
                              {msg.attachments.some(f => f.fileType === 'image' && f.imageDataUrl) && (
                                <div className="flex flex-wrap gap-1.5 w-full mt-1">
                                  {msg.attachments.filter(f => f.fileType === 'image' && f.imageDataUrl).map(f => (
                                    <img key={f.id} src={f.imageDataUrl} alt={f.name}
                                      className="max-h-48 rounded-lg object-contain border border-white/10"
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-[var(--text-secondary)] opacity-50">
                              {currentModelLabel}
                            </span>
                            <CopyButton text={msg.content} />
                          </div>
                          <div className="prose prose-invert max-w-none">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={markdownComponents}
                            >
                              {msg.content || (msg.isStreaming ? '' : '')}
                            </ReactMarkdown>
                            {msg.isStreaming && !msg.content && (
                              <div className="flex gap-1.5 py-1">
                                <div className="w-2 h-2 rounded-full bg-[var(--text-secondary)] animate-bounce" />
                                <div className="w-2 h-2 rounded-full bg-[var(--text-secondary)] animate-bounce [animation-delay:0.1s]" />
                                <div className="w-2 h-2 rounded-full bg-[var(--text-secondary)] animate-bounce [animation-delay:0.2s]" />
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {statusLines.length > 0 && (
                  <div className="flex flex-col items-center gap-0.5">
                    {statusLines.map((line, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)] opacity-60">
                        <div className="w-1 h-1 rounded-full bg-[var(--text-secondary)]" />
                        <span>{line}</span>
                      </div>
                    ))}
                  </div>
                )}
                {toolEvents.length > 0 && (
                  <div className="flex justify-start">
                    <div className="max-w-[80%] space-y-2">
                      {toolEvents.map(evt => (
                        <ToolEventCard key={evt.id} event={evt} />
                      ))}
                    </div>
                  </div>
                )}
                {error && (
                  <div className="flex justify-center">
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2.5 text-sm text-red-400 max-w-lg text-center">
                      {error}
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center -mt-12">
                {showFirstLaunchBanner && (
                  <div className="mb-6 p-4 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 max-w-md w-full">
                    <p className="text-sm font-medium text-[var(--text-primary)] mb-1">
                      {t('local.firstLaunchTitle')}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)] mb-3">
                      {t('local.firstLaunchDesc')}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setShowFirstLaunchBanner(false)
                          localStorage.setItem('agent0_first_launch_prompted', 'true')
                          setSettingsTab('local')
                          setSettingsOpen(true)
                        }}
                        className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-xs font-medium hover:opacity-90 transition-opacity"
                      >
                        {t('local.firstLaunchDownload')}
                      </button>
                      <button
                        onClick={() => {
                          setShowFirstLaunchBanner(false)
                          localStorage.setItem('agent0_first_launch_prompted', 'true')
                        }}
                        className="px-4 py-2 rounded-lg border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                      >
                        {t('local.firstLaunchSkip')}
                      </button>
                    </div>
                  </div>
                )}
                <div className="w-14 h-14 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center mb-5">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--accent)]">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                  </svg>
                </div>
                <h1 className="text-xl font-semibold text-[var(--text-primary)] mb-1.5">
                  {t('app.hero.title')}
                </h1>
                <p className="text-sm text-[var(--text-secondary)] mb-8 max-w-md text-center leading-relaxed">
                  {t('app.hero.desc')}
                </p>
                <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                  {SUGGESTIONS.map(s => (
                    <button
                      key={s}
                      onClick={() => {
                        setInput(s)
                        inputRef.current?.focus()
                      }}
                      className="group flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] hover:border-[var(--accent)]/40 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
                    >
                      <span className="group-hover:translate-x-0.5 transition-transform">{s}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="px-6 pb-3 pt-2 shrink-0">
            <div className="max-w-3xl mx-auto space-y-2">
              {showScrollBottom && (
                <div className="flex justify-center -mb-2">
                  <button
                    onClick={scrollToBottom}
                    className="w-14 h-6 rounded-full bg-[var(--bg-tertiary)] opacity-80 hover:opacity-100 border border-[var(--border)] text-[var(--text-secondary)] shadow-lg flex items-center justify-center hover:bg-[var(--accent)] hover:text-white hover:border-[var(--accent)] transition-all duration-200"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                </div>
              )}
              {pendingFiles.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {pendingFiles.map(f => (
                    <div
                      key={f.id}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border)] text-xs"
                    >
                      {f.fileType === 'image' ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-[var(--text-secondary)]">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
                        </svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-[var(--text-secondary)]">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                        </svg>
                      )}
                      <span className="text-[var(--text-primary)] max-w-[160px] truncate">{f.name}</span>
                      <span className="text-[var(--text-secondary)] text-[10px]">{formatFileSize(f.size)}</span>
                      {f.error ? (
                        <span className="text-red-400 text-[10px]" title={f.error}>err</span>
                      ) : null}
                      <button
                        onClick={() => removePendingFile(f.id)}
                        className="ml-0.5 p-0.5 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-stretch gap-2">
                <div className="flex-1 flex items-stretch rounded-xl border border-[var(--border)] bg-[var(--bg-tertiary)] overflow-hidden">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSend()
                        return
                      }
                      if (e.key === 'ArrowUp' && sentHistory.length > 0) {
                        e.preventDefault()
                        if (historyIndex === -1) {
                          setHistoryDraft(input)
                          setHistoryIndex(sentHistory.length - 1)
                          setInput(sentHistory[sentHistory.length - 1])
                        } else if (historyIndex > 0) {
                          const newIdx = historyIndex - 1
                          setHistoryIndex(newIdx)
                          setInput(sentHistory[newIdx])
                        }
                        return
                      }
                      if (e.key === 'ArrowDown') {
                        if (historyIndex !== -1) {
                          e.preventDefault()
                          if (historyIndex < sentHistory.length - 1) {
                            const newIdx = historyIndex + 1
                            setHistoryIndex(newIdx)
                            setInput(sentHistory[newIdx])
                          } else {
                            setHistoryIndex(-1)
                            setInput(historyDraft)
                          }
                        }
                        return
                      }
                    }}
                    onPaste={async e => {
                      const items = e.clipboardData?.items
                      if (!items) return
                      const fileItems: DataTransferItem[] = []
                      for (let i = 0; i < items.length; i++) {
                        if (items[i].kind === 'file') fileItems.push(items[i])
                      }
                      if (fileItems.length === 0) return
                      e.preventDefault()
                      const dt = new DataTransfer()
                      fileItems.forEach(item => dt.items.add(item.getAsFile()!))
                      await processFiles(dt.files)
                    }}
                    onDragOver={handleDragOver}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    placeholder={t('app.placeholder')}
                    rows={1}
                    className="w-full resize-none bg-transparent border-0 px-4 py-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] outline-none"
                    style={{ minHeight: '40px', maxHeight: '200px' }}
                    onInput={e => {
                      const el = e.currentTarget
                      el.style.height = 'auto'
                      el.style.height = Math.min(el.scrollHeight, 200) + 'px'
                    }}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="shrink-0 w-9 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                    title={t('app.attachFile')}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                    </svg>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </div>
                {isLoading ? (
                  <button
                    onClick={stopGeneration}
                    className="shrink-0 w-12 rounded-xl bg-red-500/80 hover:bg-red-500 flex items-center justify-center transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="6" y="6" width="12" height="12" rx="2" />
                    </svg>
                  </button>
                ) : (
                  <button
                    onClick={() => handleSend()}
                    disabled={!input.trim() && pendingFiles.length === 0}
                    className="shrink-0 w-12 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-all"
                  >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 2L11 13" />
                      <path d="M22 2L15 22L11 13L2 9L22 2Z" />
                    </svg>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1 px-1 py-1 min-h-[28px] rounded-full  border-[var(--border)] text-[var(--text-secondary)] text-[10px]">
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => {
                      const cfg = getAgentConfig()
                      const next: Mode = cfg.mode === 'build' ? 'plan' : 'build'
                      setAgentConfig({ mode: next })
                      forceUpdate()
                    }}
                    className={`text-[11px] font-medium px-2.5 py-1 rounded-md border transition-colors ${getAgentConfig().mode === 'plan'
                      ? 'btn-mode-plan'
                      : 'btn-mode-build'
                      }`}
                  >
                    {getAgentConfig().mode === 'plan' ? t('app.modePlan') : t('app.modeBuild')}
                  </button>
                  <span className="text-[10px] text-[var(--text-secondary)] opacity-40"></span>
                </div>
                <div className="px-2">
                  <ModelSelector label={currentModelLabel} onSelect={() => { recheckProviders(); forceUpdate(); }} />
                  <span className="text-[10px] text-[var(--text-secondary)] opacity-30"></span>
                </div>
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <span className="text-[10px] text-[var(--text-secondary)] opacity-50 whitespace-nowrap font-mono">
                    {realTokens.input > 0 || realTokens.output > 0
                      ? `${realTokens.input} in · ${realTokens.output} out`
                      : sessionStats.tokens > 0
                        ? `~${sessionStats.tokens} tokens`
                        : `0 tokens`}
                  </span>
                  <span className="text-[10px] text-[var(--text-secondary)] opacity-30">·</span>
                  <span className="text-[10px] text-[var(--text-secondary)] opacity-50 truncate max-w-[200px]" title={getAgentConfig().workspaceRoot}>
                    {getAgentConfig().workspaceRoot || t('settings.workspaceRoot')}
                  </span>
                </div>
                <div className="ml-auto flex items-center gap-3 shrink-0">
                  <span className="text-[10px] text-[var(--text-secondary)] opacity-50 whitespace-nowrap">
                    {messages.length - 1} {t('app.messages')}
                  </span>
                  <button
                    onClick={createSession}
                    className="text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors whitespace-nowrap"
                  >
                    {t('app.newChat')}
                  </button>
                </div>
              </div>
            </div>
          </div>
          
        </div>
        <SettingsDialog
          open={settingsOpen}
          onOpenChange={(open) => { setSettingsOpen(open); if (!open) setSettingsTab(undefined) }}
          onRecheckProviders={recheckProviders}
          onConfigChange={() => forceUpdate()}
          defaultTab={settingsTab}
        />
      </div>
    </div>
  )
}

export default App
