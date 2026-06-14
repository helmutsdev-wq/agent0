import { memPath } from '../memory'

const BACKUP_DIR = '.evolution_backups'
const MAX_BACKUPS = 10

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

async function fileExists(path: string): Promise<boolean> {
  const r = await window.electronAPI.file.read(path)
  return !r.error
}

export async function createBackup(
  workspaceRoot: string,
  files: string[]
): Promise<string | null> {
  const existing: string[] = []
  for (const f of files) {
    if (await fileExists(f)) existing.push(f)
  }
  if (existing.length === 0) return null

  const ts = new Date()
  const backupId =
    `${ts.getFullYear()}${String(ts.getMonth() + 1).padStart(2, '0')}${String(ts.getDate()).padStart(2, '0')}-` +
    `${String(ts.getHours()).padStart(2, '0')}${String(ts.getMinutes()).padStart(2, '0')}${String(ts.getSeconds()).padStart(2, '0')}`
  const root = memPath(workspaceRoot, BACKUP_DIR)
  const target = root + '\\' + backupId

  try {
    await writeFile(target + '\\.mkdir', '')
    const manifest: Array<{ rel: string; bak: string }> = []
    for (let i = 0; i < existing.length; i++) {
      const src = existing[i]
      const content = await readFile(src)
      const bakName = `${i}.bak`
      await writeFile(target + '\\' + bakName, content)
      manifest.push({ rel: src, bak: bakName })
    }
    await writeFile(target + '\\manifest.json', JSON.stringify(manifest, null, 2))
    await pruneOldBackups(root)
    return backupId
  } catch {
    return null
  }
}

export async function restoreBackup(
  workspaceRoot: string,
  backupId: string
): Promise<boolean> {
  const root = memPath(workspaceRoot, BACKUP_DIR) + '\\' + backupId
  try {
    const manifestRaw = await readFile(root + '\\manifest.json')
    if (!manifestRaw) return false
    const manifest = JSON.parse(manifestRaw) as Array<{ rel: string; bak: string }>
    for (const entry of manifest) {
      const content = await readFile(root + '\\' + entry.bak)
      if (content) {
        await writeFile(entry.rel, content)
      }
    }
    return true
  } catch {
    return false
  }
}

async function pruneOldBackups(root: string): Promise<void> {
  try {
    const raw = await window.electronAPI.dir.list(root)
    if (raw.error) return
    const dirs = (raw.items || [])
      .filter((i: { name: string; isDir: boolean }) => i.isDir)
      .map((i: { name: string }) => i.name)
      .sort()
    while (dirs.length > MAX_BACKUPS) {
      const old = dirs.shift()
      if (old) {
        const oldPath = root + '\\' + old
        try {
          const oldItems = await window.electronAPI.dir.list(oldPath)
          if (!oldItems.error) {
            for (const item of (oldItems.items || [])) {
              await writeFile(oldPath + '\\' + item.name + '.deleted', '')
            }
          }
        } catch { }
      }
    }
  } catch { }
}
