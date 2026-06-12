import { AIProvider, ChatMessage, ModelConfig, StreamChunk } from './types'

export class GroqProvider extends AIProvider {
  id = 'groq'
  name = 'Groq'
  apiKeyRequired = true

  models: ModelConfig[] = [
    {
      id: 'llama3-8b-8192',
      name: 'Llama 3 8B',
      provider: 'groq',
      capabilities: ['chat', 'code'],
      speed: 'fast',
      quality: 'medium',
      available: true,
      cost: 'free'
    },
    {
      id: 'llama3-70b-8192',
      name: 'Llama 3 70B',
      provider: 'groq',
      capabilities: ['chat', 'code', 'reasoning'],
      speed: 'fast',
      quality: 'high',
      available: true,
      cost: 'free'
    },
    {
      id: 'mixtral-8x7b-32768',
      name: 'Mixtral 8x7B',
      provider: 'groq',
      capabilities: ['chat', 'code', 'reasoning'],
      speed: 'fast',
      quality: 'high',
      available: true,
      cost: 'free'
    },
    {
      id: 'llama-3.3-70b-versatile',
      name: 'Llama 3.3 70B',
      provider: 'groq',
      capabilities: ['chat', 'code', 'reasoning'],
      speed: 'fast',
      quality: 'high',
      available: true,
      cost: 'free'
    }
  ]

  hasApiKey = false

  async checkAvailability(): Promise<boolean> {
    const apiKey = localStorage.getItem('groq_api_key')
    const hasKey = !!apiKey
    this.models.forEach(m => (m.available = hasKey))
    return hasKey
  }

  async chat(
    messages: ChatMessage[],
    modelId: string,
    onChunk: (chunk: StreamChunk) => void,
    signal?: AbortSignal
  ): Promise<void> {
    try {
      const apiKey = localStorage.getItem('groq_api_key')
      if (!apiKey) {
        onChunk({ type: 'error', content: 'Groq API key not set. Go to Settings > API Keys to add one.' })
        return
      }

      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: modelId,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          stream: true
        }),
        signal
      })

      if (!res.ok) {
        const text = await res.text()
        let msg = `Groq API error (${res.status})`
        try {
          const err = JSON.parse(text)
          msg = err.error?.message || msg
        } catch { /* ignore */ }
        onChunk({ type: 'error', content: msg })
        return
      }

      const reader = res.body?.getReader()
      if (!reader) {
        onChunk({ type: 'error', content: 'Groq: no response stream available' })
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
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data: ')) continue
          const jsonStr = trimmed.slice(6)
          if (jsonStr === '[DONE]') {
            onChunk({ type: 'done', content: '' })
            continue
          }
          try {
            const json = JSON.parse(jsonStr)
            const content = json.choices?.[0]?.delta?.content
            if (content !== undefined && content !== null) {
              onChunk({ type: 'text', content })
            }
          } catch {
            // skip partial parse errors
          }
        }
      }

      onChunk({ type: 'done', content: '' })
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        onChunk({ type: 'error', content: `Groq error: ${(err as Error).message}` })
      }
    }
  }
}
