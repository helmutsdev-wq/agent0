import { useState, useCallback, useRef, useEffect } from 'react'
import { ChatMessage } from '../lib/providers/types'
import { runAgent, setAgentConfig } from '../lib/agent'
import { t } from '../lib/i18n'
import { incrementMessages, incrementTools, addToSession, getSessionStats, clearSession } from '../lib/usage'
import { getAgentConfig } from '../lib/agent'
import { getProvider } from '../lib/providers'

export interface UIMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
}

export interface ToolEvent {
  id: string
  toolName: string
  toolInput: Record<string, unknown>
  status: 'running' | 'done'
  result?: string
  isError?: boolean
}

export function useChat() {
  const [messages, setMessages] = useState<UIMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: t('welcome')
    }
  ])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toolEvents, setToolEvents] = useState<ToolEvent[]>([])
  const [statusLines, setStatusLines] = useState<string[]>([])
  const [activeModelLabel, setActiveModelLabel] = useState('')
  const [sessionStats, setSessionStats] = useState<ReturnType<typeof getSessionStats>>(getSessionStats())
  const [realTokens, setRealTokens] = useState({ input: 0, output: 0 })
  const abortRef = useRef<AbortController | null>(null)
  const messagesRef = useRef(messages)

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return

    setError(null)
    setToolEvents([])
    setStatusLines([])
    setRealTokens({ input: 0, output: 0 })

    const userMsg: UIMessage = {
      id: `${Date.now()}-user`,
      role: 'user',
      content: content.trim()
    }

    const assistantMsg: UIMessage = {
      id: `${Date.now()}-assistant`,
      role: 'assistant',
      content: '',
      isStreaming: true
    }

    const currentMessages = messagesRef.current

    setMessages(prev => [...prev, userMsg, assistantMsg])
    setIsLoading(true)

    const abortController = new AbortController()
    abortRef.current = abortController

    const chatMessages: ChatMessage[] = [
      ...currentMessages
        .filter(m => m.id !== 'welcome')
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user' as const, content: content.trim() }
    ]

    let fullResponse = ''
    let toolCount = 0
    const inputChars = content.trim().length

    try {
      await runAgent(
        chatMessages,
        (chunk) => {
          if (chunk.type === 'text') {
            fullResponse += chunk.content
            setMessages(prev => {
              const updated = [...prev]
              const last = updated[updated.length - 1]
              if (last?.isStreaming) {
                updated[updated.length - 1] = { ...last, content: fullResponse }
              }
              return updated
            })
          } else if (chunk.type === 'info') {
            setStatusLines(prev => [...prev, chunk.content])
          } else if (chunk.type === 'usage') {
            setRealTokens({ input: chunk.inputTokens || 0, output: chunk.outputTokens || 0 })
          } else if (chunk.type === 'error') {
            setError(chunk.content)
          } else if (chunk.type === 'tool_use') {
            toolCount++
            incrementTools()
            setToolEvents(prev => [...prev, {
              id: `${Date.now()}-${chunk.toolName}`,
              toolName: chunk.toolName || 'tool',
              toolInput: chunk.toolInput || {},
              status: 'running'
            }])
          } else if (chunk.type === 'tool_result') {
            setToolEvents(prev => {
              const updated = [...prev]
              const running = updated.filter(t => t.status === 'running')
              if (running.length > 0) {
                const idx = updated.indexOf(running[0])
                updated[idx] = {
                  ...running[0],
                  status: 'done',
                  result: chunk.toolResult || '',
                  isError: !chunk.toolResult || chunk.toolResult.startsWith('Error') || chunk.toolResult.includes('failed')
                }
              }
              return updated
            })
          }
        },
        abortController.signal
      )
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError((err as Error).message)
      }
    } finally {
      incrementMessages(2)
      setIsLoading(false)
      setMessages(prev => {
        const updated = [...prev]
        const last = updated[updated.length - 1]
        if (last?.isStreaming) {
          updated[updated.length - 1] = { ...last, isStreaming: false }
        }
        return updated
      })
      abortRef.current = null
      addToSession(inputChars, fullResponse.length, toolCount)
      setSessionStats(getSessionStats())
      const cfg = getAgentConfig()
      const p = getProvider(cfg.provider)
      const m = p?.models.find(m => m.id === cfg.model)
      setActiveModelLabel(`${p?.name || cfg.provider} / ${m?.name || cfg.model}`)
    }
  }, [isLoading])

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort()
    setIsLoading(false)
    setMessages(prev => {
      const updated = [...prev]
      const last = updated[updated.length - 1]
      if (last?.isStreaming) {
        updated[updated.length - 1] = { ...last, isStreaming: false }
      }
      return updated
    })
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: t('welcome')
      }
    ])
    setError(null)
    setToolEvents([])
    setStatusLines([])
    clearSession()
    setSessionStats(getSessionStats())
  }, [])

  const updateConfig = useCallback((config: Parameters<typeof setAgentConfig>[0]) => {
    setAgentConfig(config)
  }, [])

  return {
    messages,
    isLoading,
    error,
    toolEvents,
    statusLines,
    activeModelLabel,
    sessionStats,
    realTokens,
    sendMessage,
    stopGeneration,
    clearMessages,
    updateConfig
  }
}
