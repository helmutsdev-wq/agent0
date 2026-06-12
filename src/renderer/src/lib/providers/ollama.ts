import { AIProvider, ChatMessage, ModelConfig, StreamChunk } from './types'
import { TOOL_DEFS } from '../toolDefs'

function extractInlineFunctions(content: string): Array<{ name: string; args: string }> | null {
  const funcs: Array<{ name: string; args: string }> = []
  const regex = /<function\/([^>]+)>(\{[\s\S]*?\})<\/function>/g
  let match
  while ((match = regex.exec(content)) !== null) {
    funcs.push({ name: match[1], args: match[2] })
  }
  return funcs.length > 0 ? funcs : null
}

function stripInlineFunctions(content: string): string {
  return content.replace(/<function\/[^>]+>\{[\s\S]*?\}<\/function>/g, '')
}

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
          messages: messages.map(m => {
            const msg: Record<string, unknown> = { role: m.role, content: m.content }
            if (m.tool_calls) msg.tool_calls = m.tool_calls
            return msg
          }),
          tools: TOOL_DEFS,
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

      let sawDone = false

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
              sawDone = true
              onChunk({ type: 'done', content: '' })
            } else if (json.message?.content !== undefined && json.message?.content !== '') {
              const inlineFuncs = extractInlineFunctions(json.message.content)
              if (inlineFuncs) {
                for (const fn of inlineFuncs) {
                  onChunk({
                    type: 'tool_call',
                    content: '',
                    toolCallId: fn.name,
                    toolCallName: fn.name,
                    toolCallArgs: fn.args
                  })
                  try {
                    const input = JSON.parse(fn.args)
                    onChunk({
                      type: 'tool_use',
                      content: `Using ${fn.name}...`,
                      toolName: fn.name,
                      toolInput: input
                    })
                  } catch { /* */ }
                }
                const cleaned = stripInlineFunctions(json.message.content)
                if (cleaned.trim()) {
                  onChunk({ type: 'text', content: cleaned })
                }
              } else {
                onChunk({ type: 'text', content: json.message.content })
              }
            }
            if (json.message?.tool_calls) {
              for (const tc of json.message.tool_calls) {
                const fn = tc.function || tc
                try {
                  const input = typeof fn.arguments === 'string' ? JSON.parse(fn.arguments) : (fn.arguments || {})
                  onChunk({
                    type: 'tool_call',
                    content: '',
                    toolCallId: tc.id || fn.name,
                    toolCallName: fn.name,
                    toolCallArgs: typeof fn.arguments === 'string' ? fn.arguments : JSON.stringify(fn.arguments || {})
                  })
                  onChunk({
                    type: 'tool_use',
                    content: `Using ${fn.name}...`,
                    toolName: fn.name,
                    toolInput: input
                  })
                } catch { /* skip */ }
              }
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
            sawDone = true
            onChunk({ type: 'done', content: '' })
          } else if (json.message?.content) {
            onChunk({ type: 'text', content: json.message.content })
          }
          if (json.message?.tool_calls) {
            for (const tc of json.message.tool_calls) {
              // handle buffer tool calls same as above
            }
          }
        } catch {
          // ignore trailing partial
        }
      }

      if (!sawDone) {
        onChunk({ type: 'done', content: '' })
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        onChunk({ type: 'error', content: `Ollama connection failed: ${(err as Error).message}` })
      }
    }
  }
}
