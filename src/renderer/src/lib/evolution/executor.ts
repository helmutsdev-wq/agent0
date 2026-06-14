import { ChatMessage } from '../providers/types'
import { getProvider } from '../providers'
import { getAgentConfig } from '../agent'
import { getEvolutionConfig } from './config'
import { EVOLUTION_SYSTEM_PROMPT, buildReviewUserMessage, SILENT_TOKEN } from './prompts'
import { appendSessionEvolution } from './record'
import { createBackup } from './backup'
import { getMemoryContext, readMemoryFile, appendMemory, initMemoryFiles, memPath } from '../memory'
import { executeTool, ToolCall } from '../tools'

async function readFile(path: string): Promise<string> {
  const r = await window.electronAPI.file.read(path)
  if (r.error) return ''
  return r.content || ''
}

export async function runEvolutionForSession(
  sessionId: string,
  messages: ChatMessage[],
  workspaceRoot: string
): Promise<boolean> {
  const cfg = getEvolutionConfig()
  if (!cfg.enabled || !workspaceRoot) return false

  await initMemoryFiles(workspaceRoot)

  // Build transcript from session messages (skip system prompt)
  const transcript = buildTranscript(messages)
  if (!transcript.trim()) return false

  const memFile = memPath(workspaceRoot, 'MEMORY.md')

  // Snapshot MEMORY.md before evolution
  const backupId = await createBackup(workspaceRoot, [memFile])

  // Snapshot workspace to detect changes
  const preSnap = await workspaceSnapshot(workspaceRoot)

  // Get the active provider/model
  const agentCfg = getAgentConfig()
  const provider = getProvider(agentCfg.provider)
  if (!provider) return false

  // Build the evolution messages
  // Include memory context so the evolution agent knows what's already recorded
  const memoryCtx = await getMemoryContext(workspaceRoot)
  let sysPrompt = EVOLUTION_SYSTEM_PROMPT
  if (memoryCtx) {
    sysPrompt = `Current memory context:\n${memoryCtx}\n\n---\n\n${sysPrompt}`
  }

  const evoMessages: ChatMessage[] = [
    { role: 'system', content: sysPrompt },
    { role: 'user', content: buildReviewUserMessage(transcript) }
  ]

  // Run the evolution as a single agent call with restricted tools
  let fullResponse = ''
  const evoToolCalls: Array<{ name: string; args: string }> = []

  await provider.chat(evoMessages, agentCfg.model, (chunk) => {
    if (chunk.type === 'text') {
      fullResponse += chunk.content
    } else if (chunk.type === 'tool_call' && chunk.toolCallName) {
      evoToolCalls.push({
        name: chunk.toolCallName,
        args: chunk.toolCallArgs || '{}'
      })
    }
  })

  // Execute any tool calls the evolution agent made
  for (const tc of evoToolCalls) {
    let input: Record<string, unknown> = {}
    try { input = JSON.parse(tc.args) } catch { }
    const result = await executeEvolutionTool(tc.name, input, workspaceRoot)
    // Feed result back as a follow-up tool response
    if (result.output || result.error) {
      evoMessages.push({
        role: 'assistant',
        content: '',
        tool_calls: [{ id: tc.name, type: 'function', function: { name: tc.name, arguments: tc.args } }]
      })
      evoMessages.push({
        role: 'tool',
        content: result.output || result.error || '',
        tool_call_id: tc.name
      })
      // Give the model a chance to respond to tool results
      await provider.chat(evoMessages, agentCfg.model, (chunk) => {
        if (chunk.type === 'text') {
          fullResponse += chunk.content
        }
      })
    }
  }

  const result = fullResponse.trim()

  // Silent means no change
  if (!result || result.startsWith(SILENT_TOKEN)) return false

  // Check if any workspace file actually changed
  if (!(await workspaceChanged(workspaceRoot, preSnap))) return false

  // Record the evolution
  const cleanResult = result.replace(SILENT_TOKEN, '').trim()
  if (!cleanResult) return false

  await appendSessionEvolution(workspaceRoot, cleanResult, backupId || undefined)
  return true
}

function buildTranscript(messages: ChatMessage[], maxChars = 12000): string {
  const lines: string[] = []
  for (const msg of messages) {
    if (msg.role === 'system') continue
    const text = extractText(msg.content)
    if (!text.trim()) continue
    const speaker = msg.role === 'user' ? 'User' : 'Assistant'
    lines.push(`${speaker}: ${text.trim()}`)
  }
  const transcript = lines.join('\n')
  if (transcript.length > maxChars) {
    return '...(earlier omitted)...\n' + transcript.slice(-maxChars)
  }
  return transcript
}

function extractText(content: string | unknown): string {
  if (typeof content === 'string') return content
  return ''
}

async function executeEvolutionTool(
  name: string,
  input: Record<string, unknown>,
  workspaceRoot: string
): Promise<{ output: string; error?: string }> {
  switch (name) {
    case 'read_memory': {
      const r = await readMemoryFile(workspaceRoot)
      return { output: r.output, error: r.error }
    }
    case 'append_memory': {
      const entry = input.entry as string
      if (!entry) return { output: '', error: 'Missing entry' }
      const r = await appendMemory(workspaceRoot, entry)
      return { output: r.output, error: r.error }
    }
    default:
      return { output: '', error: `Unknown evolution tool: ${name}` }
  }
}

const WATCH_FILES = ['MEMORY.md']

async function workspaceSnapshot(workspaceRoot: string): Promise<Record<string, string>> {
  const snap: Record<string, string> = {}
  for (const name of WATCH_FILES) {
    const path = memPath(workspaceRoot, name)
    try {
      const content = await readFile(path)
      snap[name] = content
    } catch {
      snap[name] = ''
    }
  }
  return snap
}

async function workspaceChanged(
  workspaceRoot: string,
  before: Record<string, string>
): Promise<boolean> {
  const after = await workspaceSnapshot(workspaceRoot)
  for (const key of Object.keys(before)) {
    if (before[key] !== after[key]) return true
  }
  return false
}
