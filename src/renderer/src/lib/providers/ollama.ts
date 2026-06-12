import { AIProvider, ChatMessage, ModelConfig, StreamChunk } from './types'

interface OllamaModel {
  name: string
  modified_at: string
  size: number
}

export class OllamaProvider extends AIProvider {
  id = 'ollama'
  name = 'Ollama'
  apiKeyRequired = false
  private baseUrl = 'http://localhost:11434'

  models: ModelConfig[] = [
    {
      id: 'llama3.2',
      name: 'Llama 3.2',
      provider: 'ollama',
      capabilities: ['chat', 'code', 'reasoning'],
      speed: 'fast',
      quality: 'high',
      available: false,
      cost: 'free'
    },
    {
      id: 'llama3.1:8b',
      name: 'Llama 3.1 8B',
      provider: 'ollama',
      capabilities: ['chat', 'code'],
      speed: 'fast',
      quality: 'medium',
      available: false,
      cost: 'free'
    },
    {
      id: 'mistral',
      name: 'Mistral',
      provider: 'ollama',
      capabilities: ['chat', 'code'],
      speed: 'fast',
      quality: 'medium',
      available: false,
      cost: 'free'
    },
    {
      id: 'deepseek-coder:6.7b',
      name: 'DeepSeek Coder 6.7B',
      provider: 'ollama',
      capabilities: ['code'],
      speed: 'medium',
      quality: 'high',
      available: false,
      cost: 'free'
    },
    {
      id: 'qwen2.5:7b',
      name: 'Qwen 2.5 7B',
      provider: 'ollama',
      capabilities: ['chat', 'code', 'reasoning'],
      speed: 'fast',
      quality: 'high',
      available: false,
      cost: 'free'
    }
  ]

  async checkAvailability(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`)
      if (!res.ok) return false
      const data = await res.json()
      const availableModels = new Set(
        (data.models as OllamaModel[]).map(m => m.name.replace(':latest', ''))
      )
      for (const model of this.models) {
        model.available = availableModels.has(model.id) || availableModels.has(`${model.id}:latest`)
      }
      return data.models && data.models.length > 0
    } catch {
      this.models.forEach(m => (m.available = false))
      return false
    }
  }

  async chat(
    messages: ChatMessage[],
    modelId: string,
    onChunk: (chunk: StreamChunk) => void,
    signal?: AbortSignal
  ): Promise<void> {
    try {
      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelId,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          stream: true
        }),
        signal
      })

      if (!res.ok) {
        const text = await res.text()
        let msg = `Ollama error (${res.status})`
        try {
          const err = JSON.parse(text)
          msg = err.error || msg
        } catch { /* ignore */ }
        onChunk({ type: 'error', content: `${msg}. Make sure Ollama is running and the model "${modelId}" is pulled.` })
        return
      }

      const reader = res.body?.getReader()
      if (!reader) {
        onChunk({ type: 'error', content: 'Ollama: no response stream' })
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const json = JSON.parse(line)
            if (json.done) {
              onChunk({ type: 'done', content: '' })
            } else if (json.message?.content !== undefined) {
              onChunk({ type: 'text', content: json.message.content })
            }
          } catch {
            // partial JSON line, skip
          }
        }
      }

      if (buffer.trim()) {
        try {
          const json = JSON.parse(buffer)
          if (json.done) {
            onChunk({ type: 'done', content: '' })
          } else if (json.message?.content) {
            onChunk({ type: 'text', content: json.message.content })
          }
        } catch {
          // ignore trailing partial
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        onChunk({ type: 'error', content: `Ollama connection failed: ${(err as Error).message}` })
      }
    }
  }
}
