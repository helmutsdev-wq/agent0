import { AIProvider, ChatMessage, ModelConfig, StreamChunk } from './types'

export class GeminiProvider extends AIProvider {
  id = 'gemini'
  name = 'Google Gemini'
  apiKeyRequired = true

  models: ModelConfig[] = [
    {
      id: 'gemini-2.0-flash-exp',
      name: 'Gemini 2.0 Flash',
      provider: 'gemini',
      capabilities: ['chat', 'code', 'reasoning', 'multimodal'],
      speed: 'fast',
      quality: 'high',
      available: true,
      cost: 'free'
    },
    {
      id: 'gemini-1.5-flash',
      name: 'Gemini 1.5 Flash',
      provider: 'gemini',
      capabilities: ['chat', 'multimodal'],
      speed: 'fast',
      quality: 'medium',
      available: true,
      cost: 'free'
    },
    {
      id: 'gemini-1.5-pro',
      name: 'Gemini 1.5 Pro',
      provider: 'gemini',
      capabilities: ['chat', 'code', 'reasoning', 'multimodal'],
      speed: 'medium',
      quality: 'high',
      available: true,
      cost: 'free'
    }
  ]

  hasApiKey = false

  async checkAvailability(): Promise<boolean> {
    return true
  }

  async chat(
    messages: ChatMessage[],
    modelId: string,
    onChunk: (chunk: StreamChunk) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const apiKey = localStorage.getItem('gemini_api_key')
    if (!apiKey) {
      onChunk({ type: 'error', content: 'Gemini API key not set. Add it in Settings.' })
      return
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:streamGenerateContent?alt=sse&key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: messages.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
          })),
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' }
          ]
        }),
        signal
      }
    )

    if (!res.ok) {
      const text = await res.text()
      onChunk({ type: 'error', content: `Gemini error: ${text}` })
      return
    }

    const reader = res.body?.getReader()
    if (!reader) {
      onChunk({ type: 'error', content: 'No response stream' })
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
          const text = json.candidates?.[0]?.content?.parts?.[0]?.text
          if (text) {
            onChunk({ type: 'text', content: text })
          }
        } catch {
          // skip parse errors
        }
      }
    }

    onChunk({ type: 'done', content: '' })
  }
}
