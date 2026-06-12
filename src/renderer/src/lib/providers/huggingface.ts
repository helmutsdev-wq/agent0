import { AIProvider, ChatMessage, ModelConfig, StreamChunk } from './types'

export class HuggingFaceProvider extends AIProvider {
  id = 'huggingface'
  name = 'Hugging Face'
  apiKeyRequired = true

  models: ModelConfig[] = [
    {
      id: 'mistralai/Mistral-7B-Instruct-v0.3',
      name: 'Mistral 7B Instruct',
      provider: 'huggingface',
      capabilities: ['chat', 'code'],
      speed: 'fast',
      quality: 'medium',
      available: true,
      cost: 'free'
    },
    {
      id: 'Qwen/Qwen2.5-7B-Instruct',
      name: 'Qwen 2.5 7B',
      provider: 'huggingface',
      capabilities: ['chat', 'code'],
      speed: 'medium',
      quality: 'medium',
      available: true,
      cost: 'free'
    },
    {
      id: 'microsoft/Phi-3.5-mini-instruct',
      name: 'Phi-3.5 Mini',
      provider: 'huggingface',
      capabilities: ['chat', 'code', 'reasoning'],
      speed: 'fast',
      quality: 'medium',
      available: true,
      cost: 'free'
    },
    {
      id: 'google/gemma-2-2b-it',
      name: 'Gemma 2 2B',
      provider: 'huggingface',
      capabilities: ['chat'],
      speed: 'fast',
      quality: 'low',
      available: true,
      cost: 'free'
    }
  ]

  async checkAvailability(): Promise<boolean> {
    const apiKey = localStorage.getItem('huggingface_api_key')
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
      const apiKey = localStorage.getItem('huggingface_api_key')
      if (!apiKey) {
        onChunk({ type: 'error', content: 'Hugging Face token not set. Go to Settings > API Keys.' })
        return
      }

      const prompt = messages.map(m => {
        if (m.role === 'system') return `<|system|>\n${m.content}</s>\n`
        if (m.role === 'assistant') return `<|assistant|>\n${m.content}</s>\n`
        return `<|user|>\n${m.content}</s>\n`
      }).join('') + '<|assistant|>\n'

      const res = await fetch(
        `https://api-inference.huggingface.co/models/${modelId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            inputs: prompt,
            parameters: {
              max_new_tokens: 2048,
              temperature: 0.7,
              return_full_text: false
            }
          }),
          signal
        }
      )

      if (!res.ok) {
        if (res.status === 503) {
          onChunk({ type: 'error', content: `Hugging Face model is loading. Wait a moment and try again. (${modelId})` })
        } else {
          const text = await res.text()
          let msg = `Hugging Face error (${res.status})`
          try { const err = JSON.parse(text); msg = err.error || msg } catch { /* */ }
          onChunk({ type: 'error', content: msg })
        }
        return
      }

      const data = await res.json()
      const text = Array.isArray(data) ? data[0]?.generated_text : data?.generated_text
      if (text) {
        onChunk({ type: 'text', content: text.trim() })
      }
      onChunk({ type: 'done', content: '' })
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        onChunk({ type: 'error', content: `Hugging Face error: ${(err as Error).message}` })
      }
    }
  }
}
