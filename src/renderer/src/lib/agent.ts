import { ChatMessage, StreamChunk } from './providers/types'
import { getProvider, initProviders, getAllModels, getAvailableModels } from './providers'
import { executeTool, ToolCall } from './tools'
import { classifyAndRoute } from './router'

export interface AgentConfig {
  provider: string
  model: string
  systemPrompt: string
  useRouter: boolean
}

const DEFAULT_SYSTEM_PROMPT = `You are Agent0, an AI assistant with access to tools.
You are running on a Windows system. Commands must use Windows shell syntax (cmd or PowerShell).

Available tools:
- read_file   {"path": "/absolute/or/relative/path"}
- write_file  {"path": "/absolute/or/relative/path", "content": "file contents"}
- edit_file   {"path": "/absolute/or/relative/path", "oldString": "text to find", "newString": "replacement"}
- list_files  {"path": "/absolute/or/relative/directory"}
- bash        {"command": "shell command"}
- web_fetch   {"url": "https://..."}

CRITICAL: When you need to use a tool, output ONLY the tool call line and NOTHING ELSE. Do not explain what you're doing. Do not say you're waiting. Just output:

TOOL_CALL: {"name": "tool_name", "input": {...}}

After receiving the tool result, respond directly with the answer. NEVER mention or thank for tool results — just use the data silently.
Always be helpful, concise, and honest about your capabilities.`

let currentConfig: AgentConfig = {
  provider: 'ollama',
  model: 'llama3.2',
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  useRouter: true
}

export function setAgentConfig(config: Partial<AgentConfig>) {
  currentConfig = { ...currentConfig, ...config }
}

export function getAgentConfig(): AgentConfig {
  return { ...currentConfig }
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
        hint = '\n\n**Quick setup:**\n1. Install Ollama from https://ollama.ai\n2. Run: `ollama pull llama3.2`\n3. Restart this app'
      } else if (hasKeyed) {
        hint = '\n\n**Quick setup:**\nGo to **Settings > API Keys** and add a key for Gemini or Groq.'
      }
      onChunk({ type: 'error', content: `No AI models are available.${hint}` })
      return
    }

    const userInput = messages[messages.length - 1]?.content || ''

    let activeProvider = currentConfig.provider
    let activeModel = currentConfig.model

    const selectedModel = availableModels.find(m => m.id === currentConfig.model)
    if (!selectedModel) {
      const fallback = availableModels[0]
      activeProvider = fallback.provider
      activeModel = fallback.id
      onChunk({
        type: 'text',
        content: `*Previously selected model "${currentConfig.model}" is not available. Falling back to **${fallback.name}**.*\n\n`
      })
    }

    if (currentConfig.useRouter && userInput && availableModels.length > 0) {
      const route = classifyAndRoute(userInput, availableModels)
      if (route) {
        activeModel = route.modelId
        activeProvider = route.providerId
        onChunk({
          type: 'text',
          content: `*Routing to **${route.task}**: ${route.providerId}/${route.modelId}*\n\n`
        })
      }
    }

    const provider = getProvider(activeProvider)
    if (!provider) {
      onChunk({
        type: 'error',
        content: `Provider "${activeProvider}" not found. Check your Settings.`
      })
      return
    }

    const systemMessages: ChatMessage[] = [
      { role: 'system', content: currentConfig.systemPrompt }
    ]

    const allMessages = [...systemMessages, ...messages]
    let accumulatedContent = ''
    let maxIterations = 10
    let iteration = 0

    while (iteration < maxIterations) {
      iteration++
      accumulatedContent = ''

      await provider.chat(allMessages, activeModel, (chunk) => {
        if (chunk.type === 'text') {
          accumulatedContent += chunk.content
          onChunk(chunk)
        } else if (chunk.type === 'error') {
          onChunk(chunk)
        } else if (chunk.type === 'done') {
          onChunk(chunk)
        }
      }, signal)

      const toolCalls = extractToolCalls(accumulatedContent)
      if (toolCalls.length === 0) break

      for (const toolCall of toolCalls) {
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

        allMessages.push({ role: 'assistant', content: accumulatedContent })
        allMessages.push({
          role: 'system',
          content: `${result.output || result.error || '(empty)'}`
        })
      }
    }
  } catch (err) {
    if ((err as Error).name !== 'AbortError') {
      onChunk({ type: 'error', content: `Agent error: ${(err as Error).message}` })
    }
  }
}
