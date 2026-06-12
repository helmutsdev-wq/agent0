export interface ModelConfig {
  id: string
  name: string
  provider: string
  capabilities: string[]
  speed: 'fast' | 'medium' | 'slow'
  quality: 'low' | 'medium' | 'high'
  available: boolean
  cost: 'free' | 'cheap' | 'moderate' | 'expensive'
}

export interface ProviderConfig {
  id: string
  name: string
  models: ModelConfig[]
  apiKeyRequired: boolean
  hasApiKey: boolean
  baseUrl?: string
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface StreamChunk {
  type: 'text' | 'tool_use' | 'tool_result' | 'error' | 'done' | 'info'
  content: string
  toolName?: string
  toolInput?: Record<string, unknown>
  toolResult?: string
}

export abstract class AIProvider {
  abstract id: string
  abstract name: string
  abstract models: ModelConfig[]
  abstract apiKeyRequired: boolean

  abstract checkAvailability(): Promise<boolean>

  abstract chat(
    messages: ChatMessage[],
    modelId: string,
    onChunk: (chunk: StreamChunk) => void,
    signal?: AbortSignal
  ): Promise<void>
}
