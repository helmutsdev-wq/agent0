import { useEffect, useRef, useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useChat } from './hooks/useChat'
import { initProviders, getProvider } from './lib/providers'
import { getAgentConfig } from './lib/agent'
import { SettingsDialog } from './components/SettingsDialog'

const SUGGESTIONS = [
  { label: 'Write a Python function', icon: '>' },
  { label: 'Summarize this article', icon: '>' },
  { label: 'Help me debug', icon: '>' },
  { label: 'Explain a concept', icon: '>' }
]

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
  }
}

function App() {
  const { messages, isLoading, error, sendMessage, stopGeneration, clearMessages } = useChat()
  const [input, setInput] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [providerLabel, setProviderLabel] = useState('Ollama')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const hasMessages = messages.length > 1 // more than just welcome

  useEffect(() => {
    initProviders().then(() => {
      const cfg = getAgentConfig()
      const p = getProvider(cfg.provider)
      setProviderLabel(p?.name || 'Ollama')
    })
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const recheckProviders = useCallback(() => {
    initProviders().then(() => {
      const cfg = getAgentConfig()
      const p = getProvider(cfg.provider)
      setProviderLabel(p?.name || 'Ollama')
    })
  }, [])

  const handleSend = useCallback(async (text?: string) => {
    const content = text || input.trim()
    if (!content || isLoading) return
    setInput('')
    await sendMessage(content)
  }, [input, isLoading, sendMessage])

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between px-6 py-4 shrink-0">
        <div
          className="flex items-center gap-2.5 cursor-pointer"
          onClick={() => setSettingsOpen(true)}
          title="Open settings"
        >
          <div className="w-8 h-8 rounded-xl bg-[var(--accent)] flex items-center justify-center text-sm font-bold">
            A0
          </div>
          <span className="font-semibold text-[15px] tracking-tight">Agent0</span>
        </div>
      </header>

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
                      : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-bl-sm'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <div className="prose prose-invert prose-sm max-w-none">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={markdownComponents}
                      >
                        {msg.content || (msg.isStreaming ? '' : '_Thinking..._')}
                      </ReactMarkdown>
                      {msg.isStreaming && !msg.content && (
                        <div className="flex gap-1.5 py-1">
                          <div className="w-2 h-2 rounded-full bg-[var(--text-secondary)] animate-bounce" />
                          <div className="w-2 h-2 rounded-full bg-[var(--text-secondary)] animate-bounce [animation-delay:0.1s]" />
                          <div className="w-2 h-2 rounded-full bg-[var(--text-secondary)] animate-bounce [animation-delay:0.2s]" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
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
              What can I help you with?
            </h1>
            <p className="text-sm text-[var(--text-secondary)] mb-8 max-w-md text-center leading-relaxed">
              I'm an AI agent with multiple models. I can write code, research topics, edit files, run commands, and more.
            </p>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {SUGGESTIONS.map(s => (
                <button
                  key={s.label}
                  onClick={() => {
                    setInput(s.label)
                    inputRef.current?.focus()
                  }}
                  className="group flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] hover:border-[var(--accent)]/40 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
                >
                  <span className="group-hover:translate-x-0.5 transition-transform">{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="px-6 pb-3 pt-2 shrink-0">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2">
            <div className="flex-1">
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
                placeholder="Type a message..."
                rows={1}
                className="w-full resize-none rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border)] px-4 py-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] outline-none focus:border-[var(--accent)]/50 transition-colors"
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
                className="shrink-0 w-12 h-12 rounded-xl bg-red-500/80 hover:bg-red-500 flex items-center justify-center transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              </button>
            ) : (
              <button
                onClick={() => handleSend()}
                disabled={!input.trim()}
                className="shrink-0 w-12 h-12 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-all"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 2L11 13" />
                  <path d="M22 2L15 22L11 13L2 9L22 2Z" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {hasMessages && (
        <div className="px-6 pb-2 shrink-0">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-3 px-1 py-1.5">
              <button
                onClick={() => setSettingsOpen(true)}
                className="text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                {providerLabel}
              </button>
              <span className="text-[var(--border)]">·</span>
              <button
                onClick={clearMessages}
                className="text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                New chat
              </button>
              <span className="text-[var(--border)]">·</span>
              <span className="text-[11px] text-[var(--text-secondary)]">
                {messages.length - 1} messages
              </span>
            </div>
          </div>
        </div>
      )}

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onRecheckProviders={recheckProviders}
      />
    </div>
  )
}

export default App
