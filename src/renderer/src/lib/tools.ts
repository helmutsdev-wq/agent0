export interface ToolResult {
  success: boolean
  output: string
  error?: string
}

export interface ToolCall {
  name: string
  input: Record<string, unknown>
}

export async function executeTool(tool: ToolCall): Promise<ToolResult> {
  switch (tool.name) {
    case 'read_file':
      return readFile(tool.input.path as string)
    case 'write_file':
      return writeFile(tool.input.path as string, tool.input.content as string)
    case 'edit_file':
      return editFile(
        tool.input.path as string,
        tool.input.oldString as string,
        tool.input.newString as string
      )
    case 'bash':
      return bash(tool.input.command as string)
    case 'web_fetch':
      return webFetch(tool.input.url as string)
    default:
      return { success: false, output: '', error: `Unknown tool: ${tool.name}` }
  }
}

async function readFile(path: string): Promise<ToolResult> {
  try {
    const result = await window.electronAPI.file.read(path)
    if (result.error) return { success: false, output: '', error: result.error }
    return { success: true, output: result.content || '' }
  } catch (e) {
    return { success: false, output: '', error: (e as Error).message }
  }
}

async function writeFile(
  path: string,
  content: string
): Promise<ToolResult> {
  try {
    const result = await window.electronAPI.file.write(path, content)
    if (result.error) return { success: false, output: '', error: result.error }
    return { success: true, output: `File written: ${path}` }
  } catch (e) {
    return { success: false, output: '', error: (e as Error).message }
  }
}

async function editFile(
  path: string,
  oldString: string,
  newString: string
): Promise<ToolResult> {
  try {
    const readResult = await window.electronAPI.file.read(path)
    if (readResult.error) {
      return { success: false, output: '', error: readResult.error }
    }
    const content = readResult.content || ''
    if (!content.includes(oldString)) {
      return {
        success: false,
        output: '',
        error: `Could not find oldString in ${path}`
      }
    }
    const newContent = content.replace(oldString, newString)
    const writeResult = await window.electronAPI.file.write(path, newContent)
    if (writeResult.error) {
      return { success: false, output: '', error: writeResult.error }
    }
    return { success: true, output: `File edited: ${path}` }
  } catch (e) {
    return { success: false, output: '', error: (e as Error).message }
  }
}

async function bash(command: string): Promise<ToolResult> {
  try {
    // Execute command - in a real app this would use a proper shell execution
    // For now this is a placeholder that will be wired to Electron's main process
    return { success: true, output: `[bash] Command executed (shell integration coming): ${command}` }
  } catch (e) {
    return { success: false, output: '', error: (e as Error).message }
  }
}

async function webFetch(url: string): Promise<ToolResult> {
  try {
    const res = await fetch(url)
    const text = await res.text()
    return { success: true, output: text.slice(0, 10000) }
  } catch (e) {
    return { success: false, output: '', error: (e as Error).message }
  }
}
