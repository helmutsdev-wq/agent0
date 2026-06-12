import { AIProvider, ChatMessage, ModelConfig, StreamChunk } from './types'
import { TOOL_DEFS } from '../toolDefs'

export class GroqProvider extends AIProvider {
  id = 'groq'
  name = 'Groq'
  apiKeyRequired = true

  models: ModelConfig[] = [
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', provider: 'groq', capabilities: ['chat', 'code', 'reasoning'], speed: 'fast', quality: 'high', available: true, cost: 'free' },
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', provider: 'groq', capabilities: ['chat', 'code'], speed: 'fast', quality: 'medium', available: true, cost: 'free' },
    { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', provider: 'groq', capabilities: ['chat', 'code', 'reasoning'], speed: 'fast', quality: 'high', available: true, cost: 'free' },
    { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 70B', provider: 'groq', capabilities: ['code', 'reasoning'], speed: 'fast', quality: 'high', available: true, cost: 'free' },
    { id: 'qwen-2.5-32b', name: 'Qwen 2.5 32B', provider: 'groq', capabilities: ['chat', 'code', 'reasoning'], speed: 'fast', quality: 'high', available: true, cost: 'free' }
  ]

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
        onChunk({ type: 'error', content: 'Groq API key not set.' })
        return
      }

      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: modelId,
          messages: messages.map(m => {
            const msg: Record<string, unknown> = { role: m.role, content: m.content }
            if (m.tool_calls) msg.tool_calls = m.tool_calls
            if (m.tool_call_id) msg.tool_call_id = m.tool_call_id
            return msg
          }),
          tools: TOOL_DEFS,
          tool_choice: 'auto',
          stream: true
        }),
        signal
      })

      if (!res.ok) {
        const text = await res.text()
        let msg = `Groq API error (${res.status})`
        try { const err = JSON.parse(text); msg = err.error?.message || msg } catch { /* */ }
        onChunk({ type: 'error', content: msg })
        return
      }

      const reader = res.body?.getReader()
      if (!reader) { onChunk({ type: 'error', content: 'Groq: no response stream' }); return }

      const decoder = new TextDecoder()
      let buffer = ''
      let sawDone = false
      const toolCalls: Map<number, { id: string; name: string; args: string }> = new Map()

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
          if (jsonStr === '[DONE]') { sawDone = true; continue }
          try {
            const json = JSON.parse(jsonStr)
            const delta = json.choices?.[0]?.delta
            if (!delta) continue

            if (delta.content) {
              onChunk({ type: 'text', content: delta.content })
            }

            const tcArr = delta.tool_calls
            if (tcArr) {
              for (const tc of tcArr) {
                const idx = tc.index ?? 0
                if (!toolCalls.has(idx)) {
                  toolCalls.set(idx, { id: tc.id || '', name: '', args: '' })
                }
                const entry = toolCalls.get(idx)!
                if (tc.id) entry.id = tc.id
                if (tc.function?.name) entry.name = tc.function.name
                if (tc.function?.arguments) entry.args += tc.function.arguments
              }
            }
          } catch { /* skip */ }
        }
      }

      for (const tc of Array.from(toolCalls.values())) {
        try {
          const input = JSON.parse(tc.args)
          onChunk({
            type: 'tool_call',
            content: '',
            toolCallId: tc.id,
            toolCallName: tc.name,
            toolCallArgs: tc.args
          })
          onChunk({
            type: 'tool_use',
            content: `Using ${tc.name}...`,
            toolName: tc.name,
            toolInput: input
          })
        } catch { /* invalid JSON */ }
      }

      if (!sawDone) onChunk({ type: 'done', content: '' })
      else onChunk({ type: 'done', content: '' })
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        onChunk({ type: 'error', content: `Groq error: ${(err as Error).message}` })
      }
    }
  }
}
