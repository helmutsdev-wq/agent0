import { memPath, todayFile } from '../memory'

async function readFile(path: string): Promise<string> {
  const r = await window.electronAPI.file.read(path)
  if (r.error) return ''
  return r.content || ''
}

async function writeFile(path: string, content: string): Promise<boolean> {
  try {
    const r = await window.electronAPI.file.write(path, content)
    return !r.error
  } catch { return false }
}

export async function appendSessionEvolution(
  workspaceRoot: string,
  summary: string,
  backupId?: string
): Promise<void> {
  if (!summary || !summary.trim()) return

  const evoDir = memPath(workspaceRoot, 'evolution')
  try { await writeFile(evoDir + '\\.mkdir', '') } catch { }

  const today = new Date().toISOString().slice(0, 10)
  const logFile = evoDir + '\\' + today + '.md'

  const ts = new Date().toTimeString().slice(0, 5)
  let body = summary.trim()
  if (backupId) body += `\n\n_backup_id: ${backupId}_`

  const existing = await readFile(logFile)
  const content = existing
    ? existing + `\n\n## ${ts}\n\n${body}\n`
    : `# Self-Evolution: ${today}\n\n## ${ts}\n\n${body}\n`

  await writeFile(logFile, content)
}
