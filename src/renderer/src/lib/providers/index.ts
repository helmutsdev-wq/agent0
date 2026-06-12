import { AIProvider, ModelConfig, ProviderConfig } from './types'
import { OllamaProvider } from './ollama'
import { GeminiProvider } from './gemini'
import { GroqProvider } from './groq'
import { HuggingFaceProvider } from './huggingface'

const providers: AIProvider[] = [
  new OllamaProvider(),
  new GeminiProvider(),
  new GroqProvider(),
  new HuggingFaceProvider()
]

export async function initProviders(): Promise<void> {
  await Promise.all(providers.map(p => p.checkAvailability()))
}

export async function recheckProviders(): Promise<void> {
  await initProviders()
}

export function getProviders(): AIProvider[] {
  return providers
}

export function getProvider(id: string): AIProvider | undefined {
  return providers.find(p => p.id === id)
}

export function getConfigs(): ProviderConfig[] {
  return providers.map(p => {
    let hasApiKey = !p.apiKeyRequired
    if (p.apiKeyRequired) {
      const key = localStorage.getItem(`${p.id}_api_key`)
      hasApiKey = !!key
    }
    return {
      id: p.id,
      name: p.name,
      models: p.models,
      apiKeyRequired: p.apiKeyRequired,
      hasApiKey,
      baseUrl: p.id === 'ollama' ? 'http://localhost:11434' : undefined
    }
  })
}

export function getAvailableModels(): ModelConfig[] {
  return providers.flatMap(p => p.models.filter(m => m.available))
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
