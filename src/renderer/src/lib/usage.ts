const STORAGE_KEY = 'agent0_usage'
const SESSION_START_KEY = 'agent0_session_start'

export interface UsageStats {
  messages: number
  tools: number
  firstDate: string
}

export interface SessionStats {
  messages: number
  tools: number
  inputChars: number
  outputChars: number
  startedAt: number
}

function load(): UsageStats {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return { messages: 0, tools: 0, firstDate: new Date().toISOString().slice(0, 10) }
}

function save(stats: UsageStats) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stats))
}

export function incrementMessages(n: number = 1) {
  const stats = load()
  stats.messages += n
  save(stats)
}

export function incrementTools(n: number = 1) {
  const stats = load()
  stats.tools += n
  save(stats)
}

export function getUsage(): UsageStats {
  return load()
}

function loadSession(): SessionStats {
  try {
    return JSON.parse(localStorage.getItem('agent0_session') || 'null')
  } catch { /* */ }
  return null as unknown as SessionStats
}

function saveSession(s: SessionStats) {
  localStorage.setItem('agent0_session', JSON.stringify(s))
}

export function startSession(): SessionStats {
  const s: SessionStats = { messages: 0, tools: 0, inputChars: 0, outputChars: 0, startedAt: Date.now() }
  saveSession(s)
  return s
}

export function addToSession(inputChars: number, outputChars: number, tools: number) {
  const s = loadSession() || startSession()
  s.messages++
  s.tools += tools
  s.inputChars += inputChars
  s.outputChars += outputChars
  saveSession(s)
}

function charsToTokens(chars: number): number {
  return Math.round(chars / 4)
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}m ${sec}s`
}

export function getSessionStats(): { label: string; tokens: number; duration: string; messages: number; tools: number } {
  const s = loadSession()
  if (!s) return { label: '', tokens: 0, duration: '', messages: 0, tools: 0 }
  const tokens = charsToTokens(s.inputChars + s.outputChars)
  const duration = formatDuration(Date.now() - s.startedAt)
  return {
    label: `${s.messages} msg · ~${tokens} tokens · ${duration}`,
    tokens,
    duration,
    messages: s.messages,
    tools: s.tools
  }
}

export function clearSession() {
  localStorage.removeItem('agent0_session')
}
