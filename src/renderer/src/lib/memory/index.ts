import { ToolResult } from '../tools'

function memoryDir(workspaceRoot: string): string {
  return workspaceRoot.replace(/\\+$/, '') + '\\memory'
}

export function memPath(workspaceRoot: string, name: string): string {
  return memoryDir(workspaceRoot) + '\\' + name
}

async function ensureDir(path: string): Promise<void> {
  await window.electronAPI.dir.list(path).catch(async () => {
    await window.electronAPI.file.write(path + '\\.mkdir', '')
    await window.electronAPI.file.write(path + '\\.mkdir', '').catch(() => {})
  })
}

async function fileExists(path: string): Promise<boolean> {
  const r = await window.electronAPI.file.read(path)
  return !r.error
}

async function readFile(path: string): Promise<string> {
  const r = await window.electronAPI.file.read(path)
  if (r.error) return ''
  return r.content || ''
}

async function writeFile(path: string, content: string): Promise<ToolResult> {
  try {
    const r = await window.electronAPI.file.write(path, content)
    if (r.error) return { success: false, output: '', error: r.error }
    return { success: true, output: `Written ${path.split('\\').pop()}` }
  } catch (e) {
    return { success: false, output: '', error: (e as Error).message }
  }
}

export async function initMemoryFiles(workspaceRoot: string): Promise<void> {
  if (!workspaceRoot) return
  const dir = memoryDir(workspaceRoot)
  try { await window.electronAPI.dir.list(dir) } catch {
    await writeFile(dir + '\\.mkdir', '')
  }
  const memFile = memPath(workspaceRoot, 'MEMORY.md')
  if (!(await fileExists(memFile))) {
    await writeFile(memFile, '# Long-term Memory\n\nKey facts, preferences, and decisions remembered across conversations.\n')
  }
  const daily = memPath(workspaceRoot, todayFile())
  if (!(await fileExists(daily))) {
    await writeFile(daily, `# Daily Memory — ${new Date().toLocaleDateString('en-CA')}\n\n`)
  }
  const evoDir = memoryDir(workspaceRoot) + '\\evolution'
  try { await window.electronAPI.dir.list(evoDir) } catch {
    await writeFile(evoDir + '\\.mkdir', '')
  }
}

function todayFile(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}.md`
}

export async function getMemoryContext(workspaceRoot: string): Promise<string> {
  if (!workspaceRoot) return ''
  const mem = await readFile(memPath(workspaceRoot, 'MEMORY.md'))
  const daily = await readFile(memPath(workspaceRoot, todayFile()))
  const parts: string[] = []
  if (mem.trim()) parts.push(mem.trim())
  if (daily.trim()) {
    const body = daily.trim().split('\n').slice(1).join('\n').trim()
    if (body) parts.push(`[Today's notes]\n${body}`)
  }
  return parts.join('\n\n')
}

export async function readMemoryFile(workspaceRoot: string): Promise<ToolResult> {
  if (!workspaceRoot) return { success: false, output: '', error: 'No workspace root configured' }
  const content = await readFile(memPath(workspaceRoot, 'MEMORY.md'))
  return { success: true, output: content || '(empty)' }
}

export async function appendMemory(
  workspaceRoot: string,
  entry: string
): Promise<ToolResult> {
  if (!workspaceRoot) return { success: false, output: '', error: 'No workspace root configured' }
  const path = memPath(workspaceRoot, 'MEMORY.md')
  const existing = await readFile(path)
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 16)
  const newContent = existing + `\n- [${ts}] ${entry}`
  return writeFile(path, newContent)
}

export async function writeMemoryFile(
  workspaceRoot: string,
  content: string
): Promise<ToolResult> {
  if (!workspaceRoot) return { success: false, output: '', error: 'No workspace root configured' }
  return writeFile(memPath(workspaceRoot, 'MEMORY.md'), content)
}

export async function appendDaily(
  workspaceRoot: string,
  entry: string
): Promise<ToolResult> {
  if (!workspaceRoot) return { success: false, output: '', error: 'No workspace root configured' }
  const path = memPath(workspaceRoot, todayFile())
  const existing = await readFile(path)
  const content = existing.trim() ? existing + `\n- ${entry}` : `# Daily Memory — ${new Date().toLocaleDateString('en-CA')}\n\n- ${entry}`
  return writeFile(path, content)
}

export async function readDailyFile(workspaceRoot: string): Promise<ToolResult> {
  if (!workspaceRoot) return { success: false, output: '', error: 'No workspace root configured' }
  const content = await readFile(memPath(workspaceRoot, todayFile()))
  return { success: true, output: content || '(empty)' }
}

export { todayFile }
