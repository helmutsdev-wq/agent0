import { ChatMessage, StreamChunk } from './providers/types'
import { getProvider, initProviders } from './providers'
import { executeTool, ToolCall } from './tools'

export interface AgentConfig {
  provider: string
  model: string
  systemPrompt: string
}

const DEFAULT_SYSTEM_PROMPT = `You are Agent0, an AI assistant with access to tools.
You can:
- Read and write files on the local filesystem
- Execute bash commands
- Fetch URLs from the web

When you need to use a tool, respond with a tool call in the format:
TOOL_CALL: {"name": "tool_name", "input": {...}}
TOOL_RESULT: ...

Always be helpful, concise, and honest about your capabilities.`

let currentConfig: AgentConfig = {
  provider: 'ollama',
  model: 'llama3.2',
  systemPrompt: DEFAULT_SYSTEM_PROMPT
}

export function setAgentConfig(config: Partial<AgentConfig>) {
  currentConfig = { ...currentConfig, ...config }
}

export function getAgentConfig(): AgentConfig {
  return { ...currentConfig }
}

function extractToolCalls(content: string): ToolCall[] {
  const calls: ToolCall[] = []
  const regex = /TOOL_CALL:\s*(\{[\s\S]*?\})\s*\n([\s\S]*?)(?=TOOL_CALL:|TOOL_RESULT:|$)/g
  let match
  while ((match = regex.exec(content)) !== null) {
    try {
      const input = JSON.parse(match[1])
      const name = match[2].trim().split('\n')[0].trim()
      calls.push({ name, input })
    } catch {
      // skip invalid JSON
    }
  }

  // Also try parsing JSON blocks containing tool_calls
  const jsonRegex = /```json\n([\s\S]*?)```/g
  while ((match = jsonRegex.exec(content)) !== null) {
    try {
      const json = JSON.parse(match[1])
      if (json.tool_calls) {
        for (const tc of json.tool_calls) {
          calls.push({
            name: tc.function?.name || tc.name,
            input: tc.function?.arguments || tc.input || {}
          })
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
  await initProviders()

  const provider = getProvider(currentConfig.provider)
  if (!provider) {
    onChunk({ type: 'error', content: `Provider "${currentConfig.provider}" not found` })
    return
  }

  const modelId = currentConfig.model
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

    await provider.chat(allMessages, modelId, (chunk) => {
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
        toolResult: result.output
      })

      allMessages.push({
        role: 'assistant',
        content: accumulatedContent
      })
      allMessages.push({
        role: 'system',
        content: `Tool "${toolCall.name}" result:\n${result.output}`
      })
    }
  }
}
