import { useState, useCallback, useRef, useEffect } from 'react'
import { ChatMessage } from '../lib/providers/types'
import { runAgent, setAgentConfig } from '../lib/agent'

export interface UIMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
}

export function useChat() {
  const [messages, setMessages] = useState<UIMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Hi! I'm Agent0. I can help you with coding, research, and tasks using multiple AI models. What would you like to do?"
    }
  ])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const messagesRef = useRef(messages)

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return

    setError(null)
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
          } else if (chunk.type === 'error') {
            setError(chunk.content)
          } else if (chunk.type === 'tool_use') {
            const toolMsg = `\n\n_Using **${chunk.toolName}**..._\n`
            fullResponse += toolMsg
            setMessages(prev => {
              const updated = [...prev]
              const last = updated[updated.length - 1]
              if (last?.isStreaming) {
                updated[updated.length - 1] = { ...last, content: fullResponse }
              }
              return updated
            })
          } else if (chunk.type === 'tool_result') {
            const resultMsg = `\`\`\`tool-result\n${chunk.toolResult}\n\`\`\`\n`
            fullResponse += resultMsg
            setMessages(prev => {
              const updated = [...prev]
              const last = updated[updated.length - 1]
              if (last?.isStreaming) {
                updated[updated.length - 1] = { ...last, content: fullResponse }
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
        content: "Hi! I'm Agent0. I can help you with coding, research, and tasks using multiple AI models. What would you like to do?"
      }
    ])
    setError(null)
  }, [])

  const updateConfig = useCallback((config: Parameters<typeof setAgentConfig>[0]) => {
    setAgentConfig(config)
  }, [])

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    stopGeneration,
    clearMessages,
    updateConfig
  }
}
