import { useState, useCallback, useRef, useEffect } from 'react'
import { ChatMessage } from '../lib/providers/types'
import { noteUserTurn } from '../lib/evolution/trigger'
import { runAgent, setAgentConfig, getAgentConfig } from '../lib/agent'
import { t } from '../lib/i18n'
import { incrementMessages, incrementTools, addToSession, getSessionStats } from '../lib/usage'
import { getProvider } from '../lib/providers'
import { ChatSession, loadSessions, saveSessions, createSession, generateSessionTitle } from '../lib/sessionStore'
import { UIMessage, ToolEvent, AttachedFile, formatFileSize } from '../lib/types'

function enrichWithAttachments(msg: UIMessage): string {
  if (!msg.attachments || msg.attachments.length === 0) return msg.content
  const blocks = msg.attachments.map(a => {
    if (a.error) {
      return `[Attached file: ${a.name} (${formatFileSize(a.size)}) — failed to read: ${a.error}]`
    }
    if (a.fileType === 'image' && a.imageDataUrl) {
      return `[Attached image: ${a.name} (${formatFileSize(a.size)})]\n${a.imageDataUrl}`
    }
    if (a.content) {
      return `[Attached file: ${a.name} (${formatFileSize(a.size)})]\n\`\`\`\n${a.content}\n\`\`\``
    }
    return `[Attached file: ${a.name} (${formatFileSize(a.size)})]`
  }).join('\n\n')
  return blocks + '\n\n' + msg.content
}

export type { UIMessage, ToolEvent }

function updateSessionInList(
  sessions: ChatSession[],
  id: string,
  updater: (s: ChatSession) => ChatSession
): ChatSession[] {
  return sessions.map(s => (s.id === id ? { ...updater(s), updatedAt: Date.now() } : s))
}

export function useChat() {
  const [sessions, setSessions] = useState<ChatSession[]>(() => loadSessions())
  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    const saved = loadSessions()
    return saved[0]?.id || ''
  })

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0]

  const [sessionStats, setSessionStats] = useState<ReturnType<typeof getSessionStats>>(getSessionStats())
  const abortRef = useRef<AbortController | null>(null)
  const sessionsRef = useRef(sessions)
  const activeIdRef = useRef(activeSessionId)

  useEffect(() => { sessionsRef.current = sessions }, [sessions])
  useEffect(() => { activeIdRef.current = activeSessionId }, [activeSessionId])

  const persist = useCallback((updated: ChatSession[]) => {
    saveSessions(updated)
    setSessions(updated)
  }, [])

  const createNewSession = useCallback(() => {
    const session = createSession()
    const updated = [...sessionsRef.current, session]
    persist(updated)
    setActiveSessionId(session.id)
  }, [persist])

  const switchSession = useCallback((id: string) => {
    if (sessionsRef.current.some(s => s.id === id)) {
      setActiveSessionId(id)
    }
  }, [])

  const deleteSession = useCallback((id: string) => {
    const current = sessionsRef.current
    const updated = current.filter(s => s.id !== id)
    if (updated.length === 0) {
      const fresh = createSession()
      persist([fresh])
      setActiveSessionId(fresh.id)
    } else {
      persist(updated)
      if (activeIdRef.current === id) {
        setActiveSessionId(updated[0].id)
      }
    }
  }, [persist])

  const setSessionTitle = useCallback((id: string, title: string) => {
    setSessions(prev => {
      const updated = updateSessionInList(prev, id, s => ({ ...s, title }))
      saveSessions(updated)
      return updated
    })
  }, [])

  const sendMessage = useCallback(async (content: string, attachments?: AttachedFile[]) => {
    const session = sessionsRef.current.find(s => s.id === activeIdRef.current)
    if (!session || (!content.trim() && (!attachments || attachments.length === 0)) || session.isLoading) return

    const sid = activeIdRef.current

    noteUserTurn(sid, session.messages.length + 1)

    const userContent = content.trim()
    const userMsg: UIMessage = {
      id: `${Date.now()}-user`,
      role: 'user',
      content: userContent || (attachments?.length ? `Attached: ${attachments.map(a => a.name).join(', ')}` : ''),
      attachments
    }

    const assistantMsg: UIMessage = {
      id: `${Date.now()}-assistant`,
      role: 'assistant',
      content: '',
      isStreaming: true
    }

    const prevMessages = session.messages

    setSessions(prev => {
      const updated = updateSessionInList(prev, sid, s => ({
        ...s,
        messages: [...s.messages, userMsg, assistantMsg],
        isLoading: true,
        error: null,
        toolEvents: [],
        statusLines: [],
        realTokens: { input: 0, output: 0 },
        title: s.title === t('session.new') ? generateSessionTitle([...prevMessages, userMsg]) : s.title
      }))
      saveSessions(updated)
      return updated
    })

    const abortController = new AbortController()
    abortRef.current = abortController

    const myAiContent = enrichWithAttachments({ ...userMsg, content: content.trim() })

    const chatMessages: ChatMessage[] = [
      ...prevMessages
        .filter(m => m.id !== 'welcome')
        .map(m => ({ role: m.role as 'user' | 'assistant', content: enrichWithAttachments(m) })),
      { role: 'user' as const, content: myAiContent }
    ]

    let fullResponse = ''
    let toolCount = 0
    const inputChars = myAiContent.length

    try {
      await runAgent(
        chatMessages,
        (chunk) => {
          if (chunk.type === 'text') {
            fullResponse += chunk.content
            setSessions(prev => {
              const updated = updateSessionInList(prev, sid, s => {
                const msgs = [...s.messages]
                const last = msgs[msgs.length - 1]
                if (last?.isStreaming) {
                  msgs[msgs.length - 1] = { ...last, content: fullResponse }
                }
                return { ...s, messages: msgs }
              })
              return updated
            })
          } else if (chunk.type === 'info') {
            setSessions(prev => {
              const updated = updateSessionInList(prev, sid, s => ({
                ...s,
                statusLines: [...s.statusLines, chunk.content]
              }))
              return updated
            })
          } else if (chunk.type === 'usage') {
            setSessions(prev => {
              const updated = updateSessionInList(prev, sid, s => ({
                ...s,
                realTokens: { input: chunk.inputTokens || 0, output: chunk.outputTokens || 0 }
              }))
              return updated
            })
          } else if (chunk.type === 'error') {
            setSessions(prev => {
              const updated = updateSessionInList(prev, sid, s => ({ ...s, error: chunk.content }))
              return updated
            })
          } else if (chunk.type === 'tool_use') {
            toolCount++
            incrementTools()
            const evt: ToolEvent = {
              id: `${Date.now()}-${chunk.toolName}`,
              toolName: chunk.toolName || 'tool',
              toolInput: chunk.toolInput || {},
              status: 'running'
            }
            setSessions(prev => {
              const updated = updateSessionInList(prev, sid, s => ({
                ...s,
                toolEvents: [...s.toolEvents, evt]
              }))
              return updated
            })
          } else if (chunk.type === 'tool_result') {
            setSessions(prev => {
              const updated = updateSessionInList(prev, sid, s => {
                const events = [...s.toolEvents]
                const running = events.filter(t => t.status === 'running')
                if (running.length > 0) {
                  const idx = events.indexOf(running[0])
                  events[idx] = {
                    ...running[0],
                    status: 'done',
                    result: chunk.toolResult || '',
                    isError: !chunk.toolResult || chunk.toolResult.startsWith('Error') || chunk.toolResult.includes('failed')
                  }
                }
                return { ...s, toolEvents: events }
              })
              return updated
            })
          }
        },
        abortController.signal
      )
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setSessions(prev => {
          const updated = updateSessionInList(prev, sid, s => ({ ...s, error: (err as Error).message }))
          return updated
        })
      }
    } finally {
      incrementMessages(2)
      setSessions(prev => {
        const updated = updateSessionInList(prev, sid, s => {
          const msgs = [...s.messages]
          const last = msgs[msgs.length - 1]
          if (last?.isStreaming) {
            msgs[msgs.length - 1] = { ...last, isStreaming: false }
          }
          const cfg = getAgentConfig()
          const p = getProvider(cfg.provider)
          const m = p?.models.find(m => m.id === cfg.model)
          const label = `${p?.name || cfg.provider} / ${m?.name || cfg.model}`
          return { ...s, messages: msgs, isLoading: false, activeModelLabel: label }
        })
        saveSessions(updated)
        return updated
      })
      abortRef.current = null
      addToSession(inputChars, fullResponse.length, toolCount)
      setSessionStats(getSessionStats())
    }
  }, [])

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort()
    const sid = activeIdRef.current
    setSessions(prev => {
      const updated = updateSessionInList(prev, sid, s => {
        const msgs = [...s.messages]
        const last = msgs[msgs.length - 1]
        if (last?.isStreaming) {
          if (!last.content) {
            // No content received — remove the empty assistant message
            msgs.pop()
          } else {
            msgs[msgs.length - 1] = { ...last, isStreaming: false }
          }
        }
        return { ...s, messages: msgs, isLoading: false }
      })
      saveSessions(updated)
      return updated
    })
  }, [])

  const clearMessages = useCallback(() => {
    createNewSession()
  }, [createNewSession])

  const updateConfig = useCallback((config: Parameters<typeof setAgentConfig>[0]) => {
    setAgentConfig(config)
  }, [])

  const messages = activeSession?.messages || []
  const isLoading = activeSession?.isLoading || false
  const error = activeSession?.error || null
  const toolEvents = activeSession?.toolEvents || []
  const statusLines = activeSession?.statusLines || []
  const activeModelLabel = activeSession?.activeModelLabel || ''
  const realTokens = activeSession?.realTokens || { input: 0, output: 0 }

  return {
    sessions,
    activeSessionId,
    createSession: createNewSession,
    switchSession,
    deleteSession,
    setSessionTitle,
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
