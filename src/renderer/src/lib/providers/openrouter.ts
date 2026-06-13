import { AIProvider, ChatMessage, ModelConfig, StreamChunk } from './types'
import { TOOL_DEFS } from '../toolDefs'

export class OpenRouterProvider extends AIProvider {
  id = 'openrouter'
  name = 'OpenRouter'
  apiKeyRequired = true

  models: ModelConfig[] = [
    { id: 'nex-agi/nex-n2-pro:free', name: 'Nex-N2-Pro', provider: 'openrouter', capabilities: ['chat', 'code', 'reasoning'], speed: 'fast', quality: 'high', available: true, cost: 'free' },
    { id: 'meta-llama/llama-4-maverick:free', name: 'Llama 4 Maverick', provider: 'openrouter', capabilities: ['chat', 'code'], speed: 'fast', quality: 'high', available: true, cost: 'free' },
    { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B', provider: 'openrouter', capabilities: ['chat', 'code'], speed: 'fast', quality: 'high', available: true, cost: 'free' },
    { id: 'meta-llama/llama-3.1-405b-instruct:free', name: 'Llama 3.1 405B', provider: 'openrouter', capabilities: ['chat', 'code', 'reasoning'], speed: 'slow', quality: 'very_high', available: true, cost: 'free' },
    { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek R1', provider: 'openrouter', capabilities: ['code', 'reasoning'], speed: 'medium', quality: 'high', available: true, cost: 'free' },
    { id: 'deepseek/deepseek-r1-0528:free', name: 'DeepSeek R1 0528', provider: 'openrouter', capabilities: ['code', 'reasoning'], speed: 'medium', quality: 'high', available: true, cost: 'free' },
    { id: 'qwen/qwen-3-235b-a22b:free', name: 'Qwen 3 235B', provider: 'openrouter', capabilities: ['chat', 'code', 'reasoning'], speed: 'medium', quality: 'very_high', available: true, cost: 'free' },
    { id: 'qwen/qwen-3-coder:free', name: 'Qwen 3 Coder', provider: 'openrouter', capabilities: ['code'], speed: 'fast', quality: 'high', available: true, cost: 'free' },
    { id: 'qwen/qwen3.6-35b-a3b:free', name: 'Qwen 3.6 35B-A3B', provider: 'openrouter', capabilities: ['chat', 'code'], speed: 'fast', quality: 'high', available: true, cost: 'free' },
    { id: 'google/gemma-3-27b-it:free', name: 'Gemma 3 27B', provider: 'openrouter', capabilities: ['chat'], speed: 'fast', quality: 'medium', available: true, cost: 'free' },
    { id: 'google/gemma-3-4b-it:free', name: 'Gemma 3 4B', provider: 'openrouter', capabilities: ['chat'], speed: 'very_fast', quality: 'low', available: true, cost: 'free' },
    { id: 'mistralai/mistral-small-3.1-24b:free', name: 'Mistral Small 3.1 24B', provider: 'openrouter', capabilities: ['chat', 'code'], speed: 'fast', quality: 'high', available: true, cost: 'free' },
    { id: 'mistralai/mistral-7b-instruct:free', name: 'Mistral 7B', provider: 'openrouter', capabilities: ['chat'], speed: 'very_fast', quality: 'medium', available: true, cost: 'free' },
    { id: 'mistralai/devstral-2512:free', name: 'Devstral 2512', provider: 'openrouter', capabilities: ['code'], speed: 'fast', quality: 'high', available: true, cost: 'free' },
    { id: 'nvidia/nemotron-3-ultra-550b-a55b:free', name: 'Nemotron 3 Ultra', provider: 'openrouter', capabilities: ['chat', 'code', 'reasoning'], speed: 'slow', quality: 'very_high', available: true, cost: 'free' },
    { id: 'minimax/minimax-m3:free', name: 'MiniMax M3', provider: 'openrouter', capabilities: ['chat', 'code'], speed: 'fast', quality: 'high', available: true, cost: 'free' }
  ]

  async checkAvailability(): Promise<boolean> {
    const apiKey = localStorage.getItem('openrouter_api_key')
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
      const apiKey = localStorage.getItem('openrouter_api_key')
      if (!apiKey) {
        onChunk({ type: 'error', content: 'OpenRouter API key not set.' })
        return
      }

      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://agent0.app',
          'X-Title': 'Agent0'
        },
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
        let msg = `OpenRouter error (${res.status})`
        try { const err = JSON.parse(text); msg = err.error?.message || msg } catch { /* */ }
        onChunk({ type: 'error', content: msg })
        return
      }

      const inputTokens = parseInt(res.headers.get('x-openrouter-tokens-input') || '0')
      const outputTokens = parseInt(res.headers.get('x-openrouter-tokens-output') || '0')
      if (inputTokens || outputTokens) {
        onChunk({ type: 'usage', content: '', inputTokens, outputTokens })
      }

      const reader = res.body?.getReader()
      if (!reader) { onChunk({ type: 'error', content: 'OpenRouter: no response stream' }); return }

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
          onChunk({ type: 'tool_call', content: '', toolCallId: tc.id, toolCallName: tc.name, toolCallArgs: tc.args })
          onChunk({ type: 'tool_use', content: `Using ${tc.name}...`, toolName: tc.name, toolInput: input })
        } catch { /* */ }
      }

      onChunk({ type: 'done', content: '' })
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        onChunk({ type: 'error', content: `OpenRouter error: ${(err as Error).message}` })
      }
    }
  }
}
