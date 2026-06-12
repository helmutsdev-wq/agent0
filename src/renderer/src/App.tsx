import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useChat } from './hooks/useChat'
import { initProviders, getProvider } from './lib/providers'
import { getAgentConfig } from './lib/agent'
import { SettingsDialog } from './components/SettingsDialog'
import { StatusBar } from './components/StatusBar'

function App() {
  const { messages, isLoading, error, sendMessage, stopGeneration, clearMessages } = useChat()
  const [input, setInput] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [providerLabel, setProviderLabel] = useState('Ollama')
  const messagesEndRef = useRef<HTMLDivElement>(null)

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

  function recheckProviders() {
    initProviders().then(() => {
      const cfg = getAgentConfig()
      const p = getProvider(cfg.provider)
      setProviderLabel(p?.name || 'Ollama')
    })
  }

  async function handleSend() {
    if (!input.trim() || isLoading) return
    const content = input.trim()
    setInput('')
    await sendMessage(content)
  }

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-secondary)] shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[var(--accent)] flex items-center justify-center text-sm font-bold">
            A0
          </div>
          <span className="font-semibold text-sm">Agent0</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 rounded-md bg-[var(--bg-tertiary)] text-xs text-[var(--text-secondary)]">
            {providerLabel}
          </span>
          <button
            onClick={() => setSettingsOpen(true)}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
          </button>
          <button
            onClick={clearMessages}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[var(--accent)] text-white rounded-br-md'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-bl-md'
              }`}
            >
              {msg.role === 'user' ? (
                msg.content
              ) : (
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      code({ className, children, ...props }) {
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
                            <code
                              className={`block px-3 py-2 rounded-b-lg bg-[var(--bg-primary)] text-xs overflow-x-auto ${className || ''}`}
                              {...props}
                            >
                              {children}
                            </code>
                          </div>
                        )
                      },
                      pre({ children }) {
                        return <>{children}</>
                      },
                      a({ href, children }) {
                        return (
                          <a href={href} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">
                            {children}
                          </a>
                        )
                      }
                    }}
                  >
                    {msg.content || (msg.isStreaming ? '' : '...')}
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
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2 text-sm text-red-400 max-w-md text-center">
              {error}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-[var(--border)] p-4 shrink-0">
        <div className="flex items-end gap-2 max-w-4xl mx-auto w-full">
          <div className="flex-1 relative">
            <textarea
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
              className="w-full resize-none rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border)] px-4 py-3 pr-12 text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] outline-none focus:border-[var(--accent)] transition-colors"
              style={{ minHeight: '44px', maxHeight: '200px' }}
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
              className="shrink-0 w-10 h-10 rounded-xl bg-red-500/80 hover:bg-red-500 flex items-center justify-center transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="shrink-0 w-10 h-10 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13" />
                <path d="M22 2L15 22L11 13L2 9L22 2Z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <StatusBar
        providerName={providerLabel}
        modelName={getAgentConfig().model}
        isConnected={true}
        messageCount={messages.length}
      />

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onRecheckProviders={recheckProviders}
      />
    </div>
  )
}

export default App
