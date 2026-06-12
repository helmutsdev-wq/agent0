import { AIProvider, ChatMessage, ModelConfig, StreamChunk } from './types'
import { TOOL_DEFS } from '../toolDefs'

function toGeminiContents(messages: ChatMessage[]) {
  const contents: Array<Record<string, unknown>> = []
  const systemParts: string[] = []

  for (const m of messages) {
    if (m.role === 'system') {
      systemParts.push(m.content)
      continue
    }
    const parts: Array<Record<string, unknown>> = []
    if (m.role === 'assistant' && m.tool_calls?.length) {
      for (const tc of m.tool_calls) {
        parts.push({
          functionCall: {
            name: tc.function.name,
            args: JSON.parse(tc.function.arguments || '{}')
          }
        })
      }
    } else if (m.role === 'tool') {
      parts.push({
        functionResponse: {
          name: m.tool_call_id?.split(':')[0] || '',
          response: { result: m.content }
        }
      })
    } else if (m.content) {
      parts.push({ text: m.content })
    }
    if (parts.length > 0) {
      contents.push({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts
      })
    }
  }
  return { contents, systemParts }
}

export class GeminiProvider extends AIProvider {
  id = 'gemini'
  name = 'Google Gemini'
  apiKeyRequired = true

  models: ModelConfig[] = [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'gemini', capabilities: ['chat', 'code', 'reasoning'], speed: 'fast', quality: 'high', available: true, cost: 'free' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'gemini', capabilities: ['chat', 'code', 'reasoning'], speed: 'fast', quality: 'high', available: true, cost: 'free' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'gemini', capabilities: ['chat'], speed: 'fast', quality: 'medium', available: true, cost: 'free' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'gemini', capabilities: ['chat', 'code', 'reasoning'], speed: 'medium', quality: 'high', available: true, cost: 'free' }
  ]

  async checkAvailability(): Promise<boolean> {
    const apiKey = localStorage.getItem('gemini_api_key')
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
      const apiKey = localStorage.getItem('gemini_api_key')
      if (!apiKey) {
        onChunk({ type: 'error', content: 'Gemini API key not set.' })
        return
      }

      const { contents, systemParts } = toGeminiContents(messages)

      const body: Record<string, unknown> = {
        contents,
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' }
        ],
        tools: [{ functionDeclarations: TOOL_DEFS.map(t => t.function) }],
        toolConfig: { functionCallingConfig: { mode: 'AUTO' } }
      }

      if (systemParts.length > 0) {
        body.systemInstruction = { parts: systemParts.map(s => ({ text: s })) }
      }

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:streamGenerateContent?alt=sse&key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal
        }
      )

      if (!res.ok) {
        const text = await res.text()
        let msg = `Gemini API error (${res.status})`
        try { const err = JSON.parse(text); msg = err.error?.message || msg } catch { /* */ }
        onChunk({ type: 'error', content: msg })
        return
      }

      const reader = res.body?.getReader()
      if (!reader) { onChunk({ type: 'error', content: 'Gemini: no response stream' }); return }

      const decoder = new TextDecoder()
      let buffer = ''
      let sawDone = false
      const toolCallAccum: Map<string, { name: string; args: Record<string, unknown> }> = new Map()

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
            const parts = json.candidates?.[0]?.content?.parts
            if (!parts) continue
            for (const part of parts) {
              if (part.text !== undefined) {
                onChunk({ type: 'text', content: part.text })
              }
              if (part.functionCall) {
                const fc = part.functionCall
                const key = fc.name || 'unknown'
                if (!toolCallAccum.has(key)) {
                  toolCallAccum.set(key, { name: fc.name, args: fc.args || {} })
                }
                // Gemini sends complete functionCall (non-streaming parts)
                onChunk({
                  type: 'tool_call',
                  content: '',
                  toolCallId: key,
                  toolCallName: fc.name,
                  toolCallArgs: JSON.stringify(fc.args || {})
                })
                onChunk({
                  type: 'tool_use',
                  content: `Using ${fc.name}...`,
                  toolName: fc.name,
                  toolInput: fc.args || {}
                })
              }
            }
          } catch { /* skip */ }
        }
      }

      if (!sawDone) onChunk({ type: 'done', content: '' })
      else onChunk({ type: 'done', content: '' })
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        onChunk({ type: 'error', content: `Gemini error: ${(err as Error).message}` })
      }
    }
  }
}
