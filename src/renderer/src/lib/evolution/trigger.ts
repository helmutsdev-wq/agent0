import { ChatMessage } from '../providers/types'
import { getEvolutionConfig } from './config'
import { runEvolutionForSession } from './executor'
import { getAgentConfig } from '../agent'
import { initMemoryFiles } from '../memory'

const SCAN_INTERVAL = 60000
const MAX_CONCURRENT = 2

const sessionEvoState = new Map<string, {
  lastActive: number
  turnCount: number
  processedMsgCount: number
  running: boolean
}>()

let intervalId: ReturnType<typeof setInterval> | null = null

export function noteUserTurn(sessionId: string, messageCount: number): void {
  const state = sessionEvoState.get(sessionId) || {
    lastActive: 0,
    turnCount: 0,
    processedMsgCount: 0,
    running: false
  }
  state.lastActive = Date.now()
  state.turnCount++
  sessionEvoState.set(sessionId, state)
}

export function markSessionProcessed(sessionId: string, messageCount: number): void {
  const state = sessionEvoState.get(sessionId)
  if (state) {
    state.processedMsgCount = messageCount
    sessionEvoState.set(sessionId, state)
  }
}

export function startEvolutionTrigger(
  getSessions: () => Array<{ id: string; messages: Array<{ role: string; content: string }> }>
): void {
  if (intervalId !== null) return

  intervalId = setInterval(async () => {
    const cfg = getEvolutionConfig()
    if (!cfg.enabled) return

    const workspaceRoot = getAgentConfig().workspaceRoot
    if (!workspaceRoot) return

    await initMemoryFiles(workspaceRoot)

    const sessions = getSessions()
    const now = Date.now()

    let runningCount = 0
    for (const [, state] of sessionEvoState) {
      if (state.running) runningCount++
    }

    for (const session of sessions) {
      if (runningCount >= MAX_CONCURRENT) break

      const state = sessionEvoState.get(session.id) || {
        lastActive: Date.now(),
        turnCount: 0,
        processedMsgCount: 0,
        running: false
      }

      if (state.running) continue

      const idleMs = now - state.lastActive
      if (idleMs < cfg.idleMinutes * 60 * 1000) continue
      if (state.turnCount < cfg.minTurns) continue

      // Check if there are new messages to review
      const totalMsgs = session.messages.length
      const newMsgs = totalMsgs - state.processedMsgCount
      if (newMsgs < 2) continue

      // Mark as running
      state.running = true
      sessionEvoState.set(session.id, state)
      runningCount++

      // Run evolution in background (no await here — fire and forget)
      runEvolutionForSession(
        session.id,
        session.messages as ChatMessage[],
        workspaceRoot
      ).then((changed) => {
        const s = sessionEvoState.get(session.id)
        if (s) {
          s.running = false
          s.processedMsgCount = session.messages.length
          s.turnCount = 0
          sessionEvoState.set(session.id, s)
        }
      }).catch(() => {
        const s = sessionEvoState.get(session.id)
        if (s) {
          s.running = false
          sessionEvoState.set(session.id, s)
        }
      })
    }
  }, SCAN_INTERVAL)
}

export function stopEvolutionTrigger(): void {
  if (intervalId !== null) {
    clearInterval(intervalId)
    intervalId = null
  }
}

export function clearEvolutionState(): void {
  sessionEvoState.clear()
}
