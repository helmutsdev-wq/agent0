import { getAgentConfig } from './agent'
import { readMemoryFile, appendMemory, appendDaily, readDailyFile } from './memory'

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
    case 'list_files':
      return listFiles(tool.input.path as string)
    case 'web_fetch':
      return webFetch(tool.input.url as string)
    case 'web_search':
      return webSearch(tool.input.query as string)
    case 'code_search':
      return codeSearch(tool.input.pattern as string, tool.input.path as string)
    case 'format_file':
      return formatFile(tool.input.path as string)
    case 'run_tests':
      return runTests(tool.input.command as string)
    case 'read_memory':
      return readMemory()
    case 'append_memory':
      return appendMemory(getAgentConfig().workspaceRoot, tool.input.entry as string)
    case 'read_daily':
      return readDaily()
    case 'append_daily':
      return appendDaily(getAgentConfig().workspaceRoot, tool.input.entry as string)
    case 'read_document':
      return readDocument(tool.input.path as string)
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
    const newContent = content.replaceAll(oldString, newString)
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
    const result = await window.electronAPI.bash.exec(command)
    const output = result.output || ''
    if (result.error) {
      return { success: false, output, error: result.error }
    }
    return { success: true, output: output.slice(0, 50000) }
  } catch (e) {
    return { success: false, output: '', error: (e as Error).message }
  }
}

async function listFiles(dirPath: string): Promise<ToolResult> {
  try {
    const path = dirPath || '.'
    const result = await window.electronAPI.dir.list(path)
    if (result.error) return { success: false, output: '', error: result.error }
    const items = result.items || []
    const output = (items as Array<{ name: string; isDir: boolean; size: number }>)
      .map(i => `${i.isDir ? 'd' : 'f'} ${i.name} (${i.size} bytes)`)
      .join('\n')
    return { success: true, output }
  } catch (e) {
    return { success: false, output: '', error: (e as Error).message }
  }
}

async function webFetch(url: string): Promise<ToolResult> {
  try {
    const result = await window.electronAPI.web.fetch(url)
    if (result.error) return { success: false, output: '', error: result.error }
    return { success: true, output: result.content?.slice(0, 10000) || '' }
  } catch (e) {
    return { success: false, output: '', error: (e as Error).message }
  }
}

async function webSearch(query: string): Promise<ToolResult> {
  try {
    const result = await window.electronAPI.web.search(query)
    if (result.error) return { success: false, output: '', error: result.error }
    return { success: true, output: result.content || '' }
  } catch (e) {
    return { success: false, output: '', error: (e as Error).message }
  }
}

async function codeSearch(pattern: string, searchPath?: string): Promise<ToolResult> {
  try {
    const result = await window.electronAPI.code.search(pattern, searchPath)
    if (result.error) return { success: false, output: '', error: result.error }
    return { success: true, output: result.content || '' }
  } catch (e) {
    return { success: false, output: '', error: (e as Error).message }
  }
}

async function formatFile(path: string): Promise<ToolResult> {
  try {
    const result = await window.electronAPI.code.format(path)
    if (result.error) return { success: false, output: '', error: result.error }
    return { success: true, output: result.content || '' }
  } catch (e) {
    return { success: false, output: '', error: (e as Error).message }
  }
}

async function runTests(command: string): Promise<ToolResult> {
  try {
    const result = await window.electronAPI.code.test(command)
    if (result.error) return { success: false, output: '', error: result.error }
    return { success: true, output: result.content || '' }
  } catch (e) {
    return { success: false, output: '', error: (e as Error).message }
  }
}

async function readDocument(path: string): Promise<ToolResult> {
  try {
    const ext = path.toLowerCase().split('.').pop()
    if (ext === 'pdf') {
      const result = await window.electronAPI.documents.readPdf(path)
      if (result.error) return { success: false, output: '', error: result.error }
      let output = result.content || ''
      const meta: string[] = []
      if (result.pages) meta.push(`${result.pages} page(s)`)
      if (result.info?.pdfVersion) meta.push(`PDF version: ${result.info.pdfVersion}`)
      if (result.info?.isEncrypted) meta.push('(encrypted)')
      if (meta.length) output = `[${meta.join(' | ')}]\n\n${output}`
      return { success: true, output }
    }
    if (ext === 'docx') {
      const result = await window.electronAPI.documents.readDocx(path)
      if (result.error) return { success: false, output: '', error: result.error }
      return { success: true, output: result.content || '' }
    }
    return { success: false, output: '', error: `Unsupported document format: .${ext}. Only .pdf and .docx are supported.` }
  } catch (e) {
    return { success: false, output: '', error: (e as Error).message }
  }
}

async function readMemory(): Promise<ToolResult> {
  const ws = getAgentConfig().workspaceRoot
  if (!ws) return { success: false, output: '', error: 'No workspace root configured' }
  return readMemoryFile(ws)
}

async function readDaily(): Promise<ToolResult> {
  const ws = getAgentConfig().workspaceRoot
  if (!ws) return { success: false, output: '', error: 'No workspace root configured' }
  return readDailyFile(ws)
}
