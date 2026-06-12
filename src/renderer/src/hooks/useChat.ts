import { useState, useCallback, useRef, useEffect } from 'react'
import { ChatMessage } from '../lib/providers/types'
import { runAgent, setAgentConfig } from '../lib/agent'
import { t } from '../lib/i18n'

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
          } else if (chunk.type === 'error') {
            setError(chunk.content)
          } else if (chunk.type === 'tool_use') {
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
    sendMessage,
    stopGeneration,
    clearMessages,
    updateConfig
  }
}
