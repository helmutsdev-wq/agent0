import { AIProvider, ModelConfig, ProviderConfig } from './types'
import { OllamaProvider } from './ollama'
import { GeminiProvider } from './gemini'
import { GroqProvider } from './groq'

const providers: AIProvider[] = [
  new OllamaProvider(),
  new GeminiProvider(),
  new GroqProvider()
]

let initialized = false

export async function initProviders(): Promise<void> {
  if (initialized) return
  await Promise.all(providers.map(p => p.checkAvailability()))
  initialized = true
}

export function getProviders(): AIProvider[] {
  return providers
}

export function getProvider(id: string): AIProvider | undefined {
  return providers.find(p => p.id === id)
}

export function getConfigs(): ProviderConfig[] {
  return providers.map(p => ({
    id: p.id,
    name: p.name,
    models: p.models,
    apiKeyRequired: p.apiKeyRequired,
    hasApiKey: p.models.some(m => m.available),
    baseUrl: p.id === 'ollama' ? 'http://localhost:11434' : undefined
  }))
}

export function getAvailableModels(): ModelConfig[] {
  return providers.flatMap(p => p.models)
}

export function getAllModels(): ModelConfig[] {
  return providers.flatMap(p => p.models)
}

export function getModelById(id: string): ModelConfig | undefined {
  for (const p of providers) {
    const m = p.models.find(m => m.id === id)
    if (m) return m
  }
  return undefined
}
