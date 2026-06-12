import { ChatMessage, StreamChunk } from './providers/types'
import { getProvider, initProviders, getAllModels, getAvailableModels } from './providers'
import { executeTool, ToolCall } from './tools'
import { classifyAndRoute } from './router'
import { t } from './i18n'

export interface AgentConfig {
  provider: string
  model: string
  systemPrompt: string
  useRouter: boolean
}

let currentConfig: AgentConfig = {
  provider: 'ollama',
  model: 'llama3.2',
  systemPrompt: t('system.prompt'),
  useRouter: true
}

export function setAgentConfig(config: Partial<AgentConfig>) {
  currentConfig = { ...currentConfig, ...config }
}

export function getAgentConfig(): AgentConfig {
  return { ...currentConfig }
}

function stripToolCallFromText(text: string): string {
  let out = ''
  let i = 0
  while (i < text.length) {
    const markerIdx = text.indexOf('TOOL_CALL:', i)
    if (markerIdx === -1) {
      out += text.slice(i)
      break
    }
    out += text.slice(i, markerIdx)
    const jsonStart = text.indexOf('{', markerIdx)
    if (jsonStart === -1) {
      i = markerIdx + 'TOOL_CALL:'.length
      continue
    }
    let depth = 0
    let inString = false
    let escape = false
    let foundEnd = false
    for (let j = jsonStart; j < text.length; j++) {
      const ch = text[j]
      if (escape) { escape = false; continue }
      if (ch === '\\' && inString) { escape = true; continue }
      if (ch === '"') { inString = !inString; continue }
      if (inString) continue
      if (ch === '{') depth++
      if (ch === '}') {
        depth--
        if (depth === 0) {
          i = j + 1
          foundEnd = true
          break
        }
      }
    }
    if (!foundEnd) {
      break
    }
  }
  return out
}

function extractToolCalls(content: string): ToolCall[] {
  const calls: ToolCall[] = []

  const marker = 'TOOL_CALL:'
  let searchFrom = 0
  while (true) {
    const markerIdx = content.indexOf(marker, searchFrom)
    if (markerIdx === -1) break

    const jsonStart = content.indexOf('{', markerIdx + marker.length)
    if (jsonStart === -1) {
      searchFrom = markerIdx + marker.length
      continue
    }

    let depth = 0
    let inString = false
    let escape = false
    let jsonEnd = -1
    for (let i = jsonStart; i < content.length; i++) {
      const ch = content[i]
      if (escape) {
        escape = false
        continue
      }
      if (ch === '\\' && inString) {
        escape = true
        continue
      }
      if (ch === '"') {
        inString = !inString
        continue
      }
      if (inString) continue
      if (ch === '{') depth++
      if (ch === '}') {
        depth--
        if (depth === 0) {
          jsonEnd = i
          break
        }
      }
    }

    if (jsonEnd === -1) {
      searchFrom = jsonStart + 1
      continue
    }

    const jsonStr = content.slice(jsonStart, jsonEnd + 1)
    searchFrom = jsonEnd + 1

    try {
      const parsed = JSON.parse(jsonStr)
      const name = parsed.name as string
      const input = parsed.input as Record<string, unknown> || parsed.arguments || {}
      if (name) {
        calls.push({ name, input })
      }
    } catch {
      // skip
    }
  }

  const jsonRegex = /```json\n([\s\S]*?)```/g
  let match
  while ((match = jsonRegex.exec(content)) !== null) {
    try {
      const json = JSON.parse(match[1])
      if (json.tool_calls) {
        for (const tc of json.tool_calls) {
          const name = tc.function?.name || tc.name
          let input = tc.function?.arguments || tc.input || {}
          if (typeof input === 'string') {
            try { input = JSON.parse(input) } catch { /* keep as string */ }
          }
          if (name) {
            calls.push({ name, input })
          }
        }
      }
    } catch {
      // skip
    }
  }

  return calls
}

export async function runAgent(
  messages: ChatMessage[],
  onChunk: (chunk: StreamChunk) => void,
  signal?: AbortSignal
): Promise<void> {
  try {
    await initProviders()

    const availableModels = getAvailableModels()
    if (availableModels.length === 0) {
      const allModels = getAllModels()
      const hasOllama = allModels.some(m => m.id.startsWith('llama') || m.id.startsWith('mistral'))
      const hasKeyed = allModels.some(m => m.provider !== 'ollama')

      let hint = ''
      if (hasOllama) {
        hint = '\n\n' + t('agent.ollamaHint')
      } else if (hasKeyed) {
        hint = '\n\n' + t('agent.keyHint')
      }
      onChunk({ type: 'error', content: t('agent.noModels') + hint })
      return
    }

    const userInput = messages[messages.length - 1]?.content || ''

    let activeProvider = currentConfig.provider
    let activeModel = currentConfig.model

    // Build ordered candidate list: route pick -> user selection -> remaining
    const candidates: Array<{ providerId: string; modelId: string; label: string }> = []

    if (currentConfig.useRouter && userInput && availableModels.length > 0) {
      const route = classifyAndRoute(userInput, availableModels)
      if (route) {
        candidates.push({
          providerId: route.providerId,
          modelId: route.modelId,
          label: t('agent.routing', { task: route.task, provider: route.providerId, model: route.modelId })
        })
      }
    }

    const userPick = availableModels.find(m => m.id === currentConfig.model)
    const userModel = userPick || availableModels[0]
    if (!userPick) {
      onChunk({
        type: 'info',
        content: t('agent.fallback', { model: currentConfig.model, fallback: userModel.name })
      })
    }
    if (!candidates.some(c => c.modelId === userModel.id && c.providerId === userModel.provider)) {
      candidates.push({
        providerId: userModel.provider,
        modelId: userModel.id,
        label: userModel.name
      })
    }

    for (const m of availableModels) {
      if (!candidates.some(c => c.modelId === m.id && c.providerId === m.provider)) {
        candidates.push({ providerId: m.provider, modelId: m.id, label: m.name })
      }
    }

    const systemMessages: ChatMessage[] = [
      { role: 'system', content: currentConfig.systemPrompt }
    ]

    const allMessages = [...systemMessages, ...messages]
    let maxIterations = 10
    let globalError = ''

    for (const candidate of candidates) {
      if (signal?.aborted) return

      const provider = getProvider(candidate.providerId)
      if (!provider) continue

      if (candidates.indexOf(candidate) > 0) {
        onChunk({
          type: 'info',
          content: t('agent.fallback', { model: activeModel, fallback: candidate.label })
        })
      } else if (candidate.label.includes('Routing')) {
        onChunk({ type: 'info', content: candidate.label })
      }

      activeProvider = candidate.providerId
      activeModel = candidate.modelId
      setAgentConfig({ provider: activeProvider, model: activeModel })

      let iteration = 0
      let accumulatedContent = ''
      let failed = false

      while (iteration < maxIterations) {
        iteration++
        accumulatedContent = ''
        let rawBuffer = ''
        let cleanLen = 0

        await provider.chat(allMessages, activeModel, (chunk) => {
          if (chunk.type === 'text') {
            rawBuffer += chunk.content
            const cleaned = stripToolCallFromText(rawBuffer)
            if (cleaned.length > cleanLen) {
              const newText = cleaned.slice(cleanLen)
              cleanLen = cleaned.length
              if (newText) {
                onChunk({ type: 'text', content: newText })
              }
            }
          } else if (chunk.type === 'error') {
            globalError = chunk.content
            failed = true
          } else if (chunk.type === 'done') {
            onChunk(chunk)
          }
        }, signal)

        if (failed) break

        accumulatedContent = rawBuffer

        const toolCalls = extractToolCalls(accumulatedContent)
        if (toolCalls.length === 0) break

        const seenKeys = new Set<string>()
        const uniqueCalls: ToolCall[] = []
        for (const tc of toolCalls) {
          const key = `${tc.name}:${JSON.stringify(tc.input)}`
          if (!seenKeys.has(key)) {
            seenKeys.add(key)
            uniqueCalls.push(tc)
          }
          if (uniqueCalls.length >= 3) break
        }

        for (const toolCall of uniqueCalls) {
          onChunk({
            type: 'tool_use',
            content: `Using ${toolCall.name}...`,
            toolName: toolCall.name,
            toolInput: toolCall.input
          })

          const result = await executeTool(toolCall)

          onChunk({
            type: 'tool_result',
            content: '',
            toolName: toolCall.name,
            toolResult: result.output || (result.error || '')
          })

          allMessages.push({ role: 'assistant', content: stripToolCallFromText(accumulatedContent) })
          allMessages.push({
            role: 'system',
            content: `${result.output || result.error || '(empty)'}`
          })
        }
      }

      if (!failed) {
        globalError = ''
        break
      }
    }

    if (globalError) {
      onChunk({ type: 'error', content: globalError })
    }
  } catch (err) {
    if ((err as Error).name !== 'AbortError') {
      onChunk({ type: 'error', content: t('agent.error', { message: (err as Error).message }) })
    }
  }
}
