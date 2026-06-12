interface TaskType {
  id: string
  name: string
  keywords: RegExp[]
  requiredCapabilities: string[]
}

const TASK_TYPES: TaskType[] = [
  {
    id: 'code',
    name: 'Coding',
    keywords: [
      /write\s+(a\s+)?(function|class|program|script|code)/i,
      /debug|refactor|implement|fix\s+(bug|issue)|code\s+review/i,
      /create\s+(a\s+)?(react|vue|component|api|endpoint|module)/i,
      /how\s+do\s+I\s+(implement|write|build|create|code)/i,
      /explain\s+(this\s+)?code|what\s+does\s+this\s+code/i,
      /^[.\/\\][a-zA-Z0-9_\/\\\.\-]+\s+/,
      /npm|yarn|pnpm|pip|cargo|go\s+mod|bundle/i,
      /typescript|javascript|python|rust|golang|react|vue/i,
      /error|exception|compil|syntax/i
    ],
    requiredCapabilities: ['code']
  },
  {
    id: 'research',
    name: 'Research',
    keywords: [
      /search|find|look\s+up|research|investigate/i,
      /what\s+is|tell\s+me\s+about|explain\s+(the\s+)?concept/i,
      /latest|news|recent|current|trend/i,
      /how\s+does\s+\w+\s+work/i,
      /difference\s+between|compare|contrast/i,
      /summarize|summary\s+of/i
    ],
    requiredCapabilities: ['reasoning']
  },
  {
    id: 'writing',
    name: 'Writing',
    keywords: [
      /write\s+(a\s+)?(email|letter|article|blog|post|essay|report|doc)/i,
      /draft|rewrite|proofread|grammar|edit/i,
      /make\s+(this\s+)?(more\s+)?(professional|formal|concise|clear)/i,
      /translate/i
    ],
    requiredCapabilities: ['chat']
  },
  {
    id: 'analysis',
    name: 'Analysis',
    keywords: [
      /analyze|analyse|evaluate|assess|examine/i,
      /data|statistics|numbers|metrics|chart|graph/i,
      /review\s+this|break\s+down|walk\s+me\s+through/i,
      /pros\s+and\s+cons|trade.?offs/i
    ],
    requiredCapabilities: ['reasoning']
  },
  {
    id: 'creative',
    name: 'Creative',
    keywords: [
      /generate|create|design|brainstorm|ideas/i,
      /story|poem|creative|art|image|music/i,
      /slogan|tagline|name\s+suggestion|brand/i,
      /color|layout|ui|ux|mockup|wireframe/i
    ],
    requiredCapabilities: ['chat']
  }
]

export function classifyTask(input: string): TaskType {
  for (const task of TASK_TYPES) {
    for (const regex of task.keywords) {
      if (regex.test(input)) {
        return task
      }
    }
  }
  return {
    id: 'general',
    name: 'General',
    keywords: [],
    requiredCapabilities: ['chat']
  }
}

export interface ModelScore {
  modelId: string
  providerId: string
  score: number
}

export function rankModels(
  taskType: TaskType,
  models: Array<{ id: string; provider: string; capabilities: string[]; quality: string; speed: string; available: boolean }>
): ModelScore[] {
  const scored: ModelScore[] = []

  for (const model of models) {
    if (!model.available) continue

    let score = 0
    const hasRequired = taskType.requiredCapabilities.every(cap =>
      model.capabilities.includes(cap)
    )
    if (!hasRequired) continue

    score += 10

    const matchedCapabilities = model.capabilities.filter(c =>
      taskType.requiredCapabilities.includes(c)
    ).length
    score += matchedCapabilities * 3

    const qualityBonus: Record<string, number> = { high: 5, medium: 3, low: 0 }
    score += qualityBonus[model.quality] || 0

    const speedBonus: Record<string, number> = { fast: 3, medium: 2, slow: 0 }
    score += speedBonus[model.speed] || 0

    scored.push({
      modelId: model.id,
      providerId: model.provider,
      score
    })
  }

  return scored.sort((a, b) => b.score - a.score)
}

export function classifyAndRoute(
  input: string,
  models: Array<{ id: string; provider: string; capabilities: string[]; quality: string; speed: string; available: boolean }>
): { task: string; modelId: string; providerId: string } | null {
  const task = classifyTask(input)
  const ranked = rankModels(task, models)

  if (ranked.length === 0) return null

  return {
    task: task.name,
    modelId: ranked[0].modelId,
    providerId: ranked[0].providerId
  }
}
