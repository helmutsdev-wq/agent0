import { useEffect, useRef, useState, useCallback, useReducer } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useChat, ToolEvent } from './hooks/useChat'
import { initProviders, getConfigs, getProvider } from './lib/providers'
import { setAgentConfig, getAgentConfig, Mode } from './lib/agent'
import { SettingsDialog } from './components/SettingsDialog'
import { SessionSidebar } from './components/SessionSidebar'
import { useLanguage } from './lib/i18n'

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
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--bg-tertiary)] transition-colors ${
                      !m.available ? 'text-[var(--text-secondary)] opacity-40 cursor-not-allowed' : 'text-[var(--text-primary)]'
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
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

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
    initProviders()
    const cfg = getAgentConfig()
    if (cfg.workspaceRoot) {
      window.electronAPI.workspace.setRoot(cfg.workspaceRoot)
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const recheckProviders = useCallback(() => {
    initProviders()
  }, [])

  const currentConfig = getAgentConfig()
  const currentProvider = getProvider(currentConfig.provider)
  const currentModelLabel = `${currentProvider?.name || currentConfig.provider} / ${currentConfig.model}`

  const handleSend = useCallback(async (text?: string) => {
    const content = text || input.trim()
    if (!content || isLoading) return
    setInput('')
    await sendMessage(content)
  }, [input, isLoading, sendMessage])

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
          <div className="w-7 h-7 rounded-xl bg-[var(--accent)] flex items-center justify-center text-sm font-bold shrink-0">
            A0
          </div>
          <span className="font-semibold text-[15px] tracking-tight">{t('app.title')}</span>
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
      <div className="flex flex-1 overflow-hidden">
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

      <div className="flex-1 overflow-y-auto px-6">
        {hasMessages ? (
          <div className="max-w-3xl mx-auto space-y-5 py-4">
            {messages.slice(1).map(msg => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[var(--accent)] text-white rounded-br-sm'
                      : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-bl-sm group'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
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
          <div className="flex items-stretch gap-2">
            <div className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg-tertiary)] overflow-hidden">
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
                placeholder={t('app.placeholder')}
                rows={1}
                className="w-full resize-none bg-transparent border-0 px-4 py-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] outline-none"
                style={{ minHeight: '48px', maxHeight: '200px' }}
                onInput={e => {
                  const el = e.currentTarget
                  el.style.height = 'auto'
                  el.style.height = Math.min(el.scrollHeight, 200) + 'px'
                }}
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
                disabled={!input.trim()}
                className="shrink-0 w-12 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-all"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 2L11 13" />
                  <path d="M22 2L15 22L11 13L2 9L22 2Z" />
                </svg>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 px-1 py-1 min-h-[28px]">
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => {
                  const cfg = getAgentConfig()
                  const next: Mode = cfg.mode === 'build' ? 'plan' : 'build'
                  setAgentConfig({ mode: next })
                  forceUpdate(n => n + 1)
                }}
                className={`text-[11px] font-medium px-2.5 py-1 rounded-md border transition-colors ${
                  getAgentConfig().mode === 'plan'
                    ? 'border-[var(--accent)]/50 text-[var(--accent)] bg-[var(--accent)]/10'
                    : 'border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {getAgentConfig().mode === 'plan' ? t('app.modePlan') : t('app.modeBuild')}
              </button>
              <span className="text-[10px] text-[var(--text-secondary)] opacity-40">·</span>
            </div>

            <ModelSelector label={currentModelLabel} onSelect={() => { recheckProviders(); forceUpdate(); }} />
            <span className="text-[10px] text-[var(--text-secondary)] opacity-30">·</span>

            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <span className="text-[10px] text-[var(--text-secondary)] opacity-50 whitespace-nowrap font-mono">
                {realTokens.input > 0 || realTokens.output > 0
                  ? `${realTokens.input} in · ${realTokens.output} out`
                  : sessionStats.tokens > 0
                    ? `~${sessionStats.tokens} tok`
                    : `0 tok`}
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
        onOpenChange={setSettingsOpen}
        onRecheckProviders={recheckProviders}
        onConfigChange={() => forceUpdate()}
      />
    </div>
    </div>
  )
}

export default App
