import { useState, useCallback, useRef } from 'react'
import { ChatMessage } from '../lib/providers/types'
import { runAgent, AgentConfig, setAgentConfig, getAgentConfig } from '../lib/agent'

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

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return

    setError(null)
    const userMsg: UIMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim()
    }

    const assistantMsg: UIMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      isStreaming: true
    }

    setMessages(prev => [...prev, userMsg, assistantMsg])
    setIsLoading(true)

    const abortController = new AbortController()
    abortRef.current = abortController

    const chatMessages: ChatMessage[] = [
      ...messages
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
              if (last && last.isStreaming) {
                updated[updated.length - 1] = { ...last, content: fullResponse }
              }
              return updated
            })
          } else if (chunk.type === 'error') {
            setError(chunk.content)
          } else if (chunk.type === 'tool_use') {
            const toolMsg = `\n\n*Using tool: ${chunk.toolName}...*\n`
            fullResponse += toolMsg
            setMessages(prev => {
              const updated = [...prev]
              const last = updated[updated.length - 1]
              if (last && last.isStreaming) {
                updated[updated.length - 1] = { ...last, content: fullResponse }
              }
              return updated
            })
          } else if (chunk.type === 'tool_result') {
            const resultMsg = `\`\`\`\n${chunk.toolResult}\n\`\`\`\n`
            fullResponse += resultMsg
            setMessages(prev => {
              const updated = [...prev]
              const last = updated[updated.length - 1]
              if (last && last.isStreaming) {
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
        if (last && last.isStreaming) {
          updated[updated.length - 1] = { ...last, isStreaming: false }
        }
        return updated
      })
      abortRef.current = null
    }
  }, [messages, isLoading])

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort()
    setIsLoading(false)
    setMessages(prev => {
      const updated = [...prev]
      const last = updated[updated.length - 1]
      if (last && last.isStreaming) {
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

  const updateConfig = useCallback((config: Partial<AgentConfig>) => {
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
