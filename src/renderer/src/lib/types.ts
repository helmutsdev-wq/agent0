export interface UIMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
}

export interface ToolEvent {
  id: string
  toolName: string
  toolInput: Record<string, unknown>
  status: 'running' | 'done'
  result?: string
  isError?: boolean
}
