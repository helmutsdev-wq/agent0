import { UIMessage, ToolEvent } from './types'
import { t } from './i18n'

const STORAGE_KEY = 'agent0_sessions'
const MAX_SESSIONS = 50

let nextId = Date.now()

export interface ChatSession {
  id: string
  title: string
  messages: UIMessage[]
  toolEvents: ToolEvent[]
  statusLines: string[]
  isLoading: boolean
  error: string | null
  realTokens: { input: number; output: number }
  activeModelLabel: string
  createdAt: number
  updatedAt: number
  titleGenerated: boolean
}

export function createSession(): ChatSession {
  return {
    id: String(++nextId),
    title: t('session.new'),
    messages: [{ id: `${Date.now()}-welcome`, role: 'assistant', content: t('welcome') }],
    toolEvents: [],
    statusLines: [],
    isLoading: false,
    error: null,
    realTokens: { input: 0, output: 0 },
    activeModelLabel: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    titleGenerated: false
  }
}

export function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { }
  const first = createSession()
  saveSessions([first])
  return [first]
}

export function saveSessions(sessions: ChatSession[]) {
  try {
    const trimmed = sessions.slice(0, MAX_SESSIONS)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  } catch {
    try {
      const minimal = sessions.slice(-10)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(minimal))
    } catch { }
  }
}

export function generateSessionTitle(messages: UIMessage[]): string {
  const firstUser = messages.find(m => m.role === 'user')
  if (!firstUser) return t('session.new')
  const text = firstUser.content.trim()
  return text.length > 50 ? text.slice(0, 47) + '...' : text
}
