import { useEffect, useRef, useState } from 'react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hi! I\'m Agent0. I can help you with coding, research, and tasks across multiple AI models. What would you like to do?'
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    if (!input.trim() || isLoading) return
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim()
    }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    setTimeout(() => {
      const reply: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Agent functionality coming soon. This is a placeholder response.'
      }
      setMessages(prev => [...prev, reply])
      setIsLoading(false)
    }, 1000)
  }

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-secondary)]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[var(--accent)] flex items-center justify-center text-sm font-bold">
            A
          </div>
          <span className="font-semibold text-sm">Agent0</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
          <span className="px-2 py-1 rounded bg-[var(--bg-tertiary)]">Ollama</span>
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
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-[var(--bg-tertiary)] rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[var(--text-secondary)] animate-bounce" />
                <div className="w-2 h-2 rounded-full bg-[var(--text-secondary)] animate-bounce [animation-delay:0.1s]" />
                <div className="w-2 h-2 rounded-full bg-[var(--text-secondary)] animate-bounce [animation-delay:0.2s]" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-[var(--border)] p-4">
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
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="shrink-0 w-10 h-10 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13" />
              <path d="M22 2L15 22L11 13L2 9L22 2Z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

export default App
