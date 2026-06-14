import { ChatMessage, StreamChunk } from './providers/types'
import { getProvider, initProviders, getAllModels, getAvailableModels } from './providers'
import { executeTool } from './tools'
import { classifyAndRoute } from './router'
import { t } from './i18n'
import { getMemoryContext, initMemoryFiles } from './memory'

export type Mode = 'build' | 'plan'

export interface AgentConfig {
  provider: string
  model: string
  systemPrompt: string
  useRouter: boolean
  autoFallback: boolean
  mode: Mode
  workspaceRoot: string
}

let currentConfig: AgentConfig = {
  provider: 'ollama',
  model: 'llama3.2',
  systemPrompt: t('system.prompt'),
  useRouter: false,
  autoFallback: false,
  mode: 'build',
  workspaceRoot: ''
}

export function getEffectiveSystemPrompt(): string {
  let prompt = currentConfig.systemPrompt
  if (currentConfig.mode === 'plan') {
    prompt = t('system.planPrefix') + '\n\n' + prompt
  }
  return prompt
}

export function setAgentConfig(config: Partial<AgentConfig>) {
  currentConfig = { ...currentConfig, ...config }
}

export function getAgentConfig(): AgentConfig {
  return { ...currentConfig }
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

    const candidates: Array<{ providerId: string; modelId: string; label: string }> = []

    const useFallback = currentConfig.useRouter || currentConfig.autoFallback

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

    if (!userPick && useFallback) {
      onChunk({
        type: 'info',
        content: t('agent.fallback', { model: currentConfig.model, fallback: userModel.name })
      })
      if (!candidates.some(c => c.modelId === userModel.id && c.providerId === userModel.provider)) {
        candidates.push({ providerId: userModel.provider, modelId: userModel.id, label: userModel.name })
      }
      for (const m of availableModels) {
        if (!candidates.some(c => c.modelId === m.id && c.providerId === m.provider)) {
          candidates.push({ providerId: m.provider, modelId: m.id, label: m.name })
        }
      }
    } else if (!userPick && !useFallback) {
      onChunk({ type: 'error', content: t('agent.modelFailed', { model: currentConfig.model || currentConfig.provider }) })
      return
    } else if (!useFallback) {
      candidates.push({ providerId: userPick!.provider, modelId: userPick!.id, label: userPick!.name })
    } else {
      if (!candidates.some(c => c.modelId === userModel.id && c.providerId === userModel.provider)) {
        candidates.push({ providerId: userModel.provider, modelId: userModel.id, label: userModel.name })
      }
      for (const m of availableModels) {
        if (!candidates.some(c => c.modelId === m.id && c.providerId === m.provider)) {
          candidates.push({ providerId: m.provider, modelId: m.id, label: m.name })
        }
      }
    }

    const ws = currentConfig.workspaceRoot
    let sysPrompt = getEffectiveSystemPrompt()
    if (ws) {
      await initMemoryFiles(ws)
      const memoryCtx = await getMemoryContext(ws)
      if (memoryCtx) {
        sysPrompt = `[Long-term Memory]\n${memoryCtx}\n\n---\n${sysPrompt}`
      }
    }

    const allMessages: ChatMessage[] = [
      { role: 'system', content: sysPrompt },
      ...messages
    ]

    let maxIterations = 10
    let globalError = ''

    for (const candidate of candidates) {
      if (signal?.aborted) return

      const provider = getProvider(candidate.providerId)
      if (!provider) continue

      const idx = candidates.indexOf(candidate)
      if (idx === 0 && candidate.label.includes('Routing')) {
        onChunk({ type: 'info', content: candidate.label })
      } else if (idx === 1) {
        onChunk({ type: 'info', content: t('agent.fallback', { model: currentConfig.model, fallback: candidate.label }) })
      } else if (idx === 2) {
        onChunk({ type: 'info', content: t('agent.tryingOthers') })
      }

      setAgentConfig({ provider: candidate.providerId, model: candidate.modelId })

      let iteration = 0
      let failed = false
      const sessionToolKeys = new Set<string>()

      while (iteration < maxIterations) {
        iteration++

        let iterationText = ''
        const iterationToolCalls: Array<{ id: string; name: string; args: string }> = []

        await provider.chat(allMessages, candidate.modelId, (chunk) => {
          if (chunk.type === 'text') {
            iterationText += chunk.content
            onChunk(chunk)
          } else if (chunk.type === 'error') {
            globalError = chunk.content
            failed = true
          } else if (chunk.type === 'done') {
            // no-op
          } else if (chunk.type === 'tool_use') {
            onChunk({ type: 'tool_use', content: '', toolName: chunk.toolName, toolInput: chunk.toolInput })
          } else if (chunk.type === 'tool_call') {
            if (chunk.toolCallId && chunk.toolCallName) {
              iterationToolCalls.push({
                id: chunk.toolCallId,
                name: chunk.toolCallName,
                args: chunk.toolCallArgs || '{}'
              })
            }
          }
        }, signal)

        if (failed) {
          iterationToolCalls.length = 0
          break
        }

        // Text-only response — store and done
        if (iterationText && iterationToolCalls.length === 0) {
          allMessages.push({ role: 'assistant', content: iterationText })
          break
        }

        if (iterationToolCalls.length === 0) break

        // Collect unique tool calls (cross-iteration dedup)
        const processedCalls: Array<typeof iterationToolCalls[0] & { input: Record<string, unknown> }> = []
        for (const tc of iterationToolCalls) {
          const key = `${tc.name}:${tc.args}`
          if (sessionToolKeys.has(key)) continue
          sessionToolKeys.add(key)
          let input: Record<string, unknown> = {}
          try { input = JSON.parse(tc.args) } catch { /* */ }
          processedCalls.push({ ...tc, input })
        }

        if (processedCalls.length === 0) break

        // Push one assistant message with all tool_calls
        allMessages.push({
          role: 'assistant',
          content: iterationText || '',
          tool_calls: processedCalls.map(tc => ({
            id: tc.id,
            type: 'function',
            function: { name: tc.name, arguments: tc.args }
          }))
        })

        for (const tc of processedCalls) {
          const result = await executeTool({ name: tc.name, input: tc.input })

          onChunk({
            type: 'tool_result',
            content: '',
            toolName: tc.name,
            toolResult: result.output || (result.error || '')
          })

          allMessages.push({
            role: 'tool',
            content: result.output || result.error || '(empty)',
            tool_call_id: tc.id
          })
        }

        // Send done chunk for UI
        onChunk({ type: 'done', content: '' })
      }

      if (!failed) {
        globalError = ''
        break
      }
    }

    if (globalError) {
      const hint = (!currentConfig.useRouter && !currentConfig.autoFallback) ? '\n\n' + t('agent.trySwitch') : ''
      onChunk({ type: 'error', content: globalError + hint })
    }
  } catch (err) {
    if ((err as Error).name !== 'AbortError') {
      onChunk({ type: 'error', content: t('agent.error', { message: (err as Error).message }) })
    }
  }
}
