import { useEffect, useRef, useState, useCallback, useReducer } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useChat, ToolEvent } from './hooks/useChat'
import { initProviders, getConfigs, getProvider } from './lib/providers'
import { setAgentConfig, getAgentConfig, Mode } from './lib/agent'
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
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<string | undefined>()
  const [showFirstLaunchBanner, setShowFirstLaunchBanner] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [showScrollBottom, setShowScrollBottom] = useState(false)

  const [pendingFiles, setPendingFiles] = useState<AttachedFile[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounterRef = useRef(0)

  const hasMessages = messages.length > 1
  const forceUpdate = useReducer(n => n + 1, 0)[1]
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [zoom, setZoom] = useState(() => {
    const saved = localStorage.getItem('agent0_zoom')
    return saved ? parseInt(saved) : 100
  })

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
    initProviders().then(() => {
      const configs = getConfigs()
      const hasAnyAvailable = configs.some(c => c.models.some(m => m.available))
      const hasBeenPrompted = localStorage.getItem('agent0_first_launch_prompted')
      if (!hasAnyAvailable && !hasBeenPrompted) {
        setShowFirstLaunchBanner(true)
      }
      // Init memory + start evolution trigger after providers are ready
      const ws = getAgentConfig().workspaceRoot
      if (ws) {
        window.electronAPI.workspace.setRoot(ws)
        initMemoryFiles(ws)
      }
      startEvolutionTrigger(() => sessionsRef.current)
    })
    return () => { stopEvolutionTrigger() }
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
    setInput('')
    setPendingFiles([])
    await sendMessage(content, files)
  }, [input, isLoading, sendMessage, pendingFiles])

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between px-4 py-3 shrink-0 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            title="Toggle sidebar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div className="w-8 h-8 rounded-full bg-[var(--bg-secondary)] outline outline-1 outline-[var(--accent)] ">
            <svg viewBox="0 0 24 24" width="33px" height="33px"  fill="#6c5ce7" stroke="currentColor" strokeWidth="0" strokeLinecap="round" strokeLinejoin="round" shapeRendering="geometricPrecision">
              <path d="M12 0h.018c1.473-.002 2.88.261 4.179.754C20.755 2.456 24 6.85 24 12c0 6.627-5.373 12-12 12S0 18.627 0 12 5.373 0 12 0zm8.604 18.967A11.024 11.024 0 0023.07 12c0-1.717-.39-3.344-1.089-4.794a2.59 2.59 0 01-3.214.62 6.278 6.278 0 01-1.333-.992C16.283 5.73 15.109 4.66 13.696 3.9c-3.211-1.729-6.825-1.501-9.695.447A11.033 11.033 0 00.93 12c0 1.663.367 3.241 1.024 4.657.75-.973 2.131-1.346 3.232-.71.667.384 1.257.92 1.837 1.447l.176.16c1.365 1.234 2.794 2.355 4.558 2.965 3.053 1.053 6.356.437 8.847-1.552z" clipRule="evenodd"></path>
              <path d="M5.643 10.312c-.83.11-1.401.766-1.408 1.618a1.715 1.715 0 001.45 1.72c.805.128 1.64-.426 1.87-1.26.046-.167.076-.338.106-.51.025-.14.05-.282.084-.42.318-1.317 1.237-1.95 2.788-1.93 1.086.013 1.318.271 1.68 1.855.017.076.043.151.07.226.26.714.976 1.17 1.67 1.065a1.647 1.647 0 001.38-1.438c.083-.729-.348-1.264-1.122-1.575-.34-.136-.664-.158-.995-.141-.726.037-1.121-.36-1.339-.977a3.359 3.359 0 01-.134-.65c-.014-.093-.027-.186-.043-.278-.156-.887-.835-1.51-1.669-1.532-.791-.02-1.464.551-1.665 1.418l-.06.27-.025.117c-.355 1.636-.974 2.205-2.638 2.422z"></path>
              <path d="M18.059 13.644c.989-.206 1.577-.838 1.592-1.697.015-.83-.624-1.582-1.46-1.724-.77-.13-1.599.383-1.844 1.18-.069.22-.117.448-.165.676-.06.29-.122.58-.225.854-.367.986-1.593 1.546-2.926 1.394-.824-.095-1.106-.446-1.342-1.674-.18-.938-.864-1.535-1.681-1.467-.85.07-1.515.829-1.468 1.673.05.892.678 1.44 1.705 1.489 1.375.064 1.75.396 1.926 1.787.067.531.267.967.685 1.288 1.02.783 2.407.208 2.66-1.108l.022-.114c.152-.796.3-1.577 1.04-2.101.36-.255.761-.326 1.166-.397.105-.019.21-.037.315-.06zM13.83 7.961a.755.755 0 1 1-1.51 0 .755.755 0 0 1 1.51 0z"></path>
              <path d="M10.809 16.678a.755.755 0 100-1.511.755.755 0 000 1.51z"></path>
            </svg>
          </div>
          <span className="font-bold text-lg tracking-tight text-[var(--accent)] ">Agent O</span>
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
                              {activeModelLabel}
                            </span>
                            <CopyButton text={msg.content} />
                          </div>
                          <div className="prose prose-invert max-w-none">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={markdownComponents}
                            >
                              {msg.content || (msg.isStreaming ? '' : `_${t('app.thinking')}_`)}
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
                      forceUpdate(n => n + 1)
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
{showScrollBottom && (
            <div className="absolute left-1/2 -translate-x-1/2 bottom-28 z-40 mb-2">
              <button
                onClick={scrollToBottom}
                className="w-14 h-6 rounded-full bg-[var(--bg-tertiary)] opacity-80 hocer:opacity-100 border border-[var(--border)] text-[var(--text-secondary)] shadow-lg flex items-center justify-center hover:bg-[var(--accent)] hover:text-white hover:border-[var(--accent)] transition-all duration-200"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
            </div>
          )}
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
