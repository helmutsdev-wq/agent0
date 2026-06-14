export const EVO_CONFIG_KEY = 'agent0_evolution_config'

export interface EvolutionConfig {
  enabled: boolean
  idleMinutes: number
  minTurns: number
  maxSteps: number
}

const defaults: EvolutionConfig = {
  enabled: false,
  idleMinutes: 10,
  minTurns: 6,
  maxSteps: 12
}

export function getEvolutionConfig(): EvolutionConfig {
  try {
    const raw = localStorage.getItem(EVO_CONFIG_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return { ...defaults, ...parsed }
    }
  } catch { }
  return { ...defaults }
}

export function setEvolutionConfig(cfg: Partial<EvolutionConfig>): EvolutionConfig {
  const current = getEvolutionConfig()
  const next = { ...current, ...cfg }
  localStorage.setItem(EVO_CONFIG_KEY, JSON.stringify(next))
  return next
}
