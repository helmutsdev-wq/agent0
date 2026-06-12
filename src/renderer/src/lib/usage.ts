const STORAGE_KEY = 'agent0_usage'

export interface UsageStats {
  messages: number
  tools: number
  firstDate: string
}

function load(): UsageStats {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  const today = new Date().toISOString().slice(0, 10)
  return { messages: 0, tools: 0, firstDate: today }
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
