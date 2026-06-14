import { app, BrowserWindow, ipcMain, IpcMainInvokeEvent, Menu, dialog } from 'electron'
import { join, resolve, relative, normalize, isAbsolute, extname } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdtempSync, readFile } from 'fs'
import { spawnSync, spawn, execFile, ChildProcess } from 'child_process'
import https from 'https'
import http from 'http'
import { tmpdir } from 'os'
import { PDFParse } from 'pdf-parse'
import mammoth from 'mammoth'

// ─── Workspace Scoping ────────────────────────────────────────────────────

let workspaceRoot: string = ''

function isInsideWorkspace(filePath: string): boolean {
  if (!workspaceRoot) return true // no workspace set — allow (with blocklist still checked)
  const root = resolve(workspaceRoot)
  const candidate = resolve(root, normalize(filePath))
  const rel = relative(root, candidate)
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)
}

function isPathSafe(filePath: string): boolean {
  if (workspaceRoot) return isInsideWorkspace(filePath)

  // Legacy blocklist for when no workspace is set
  const blocked = [
    'C:\\Windows', 'C:\\Windows\\System32', 'C:\\Windows\\SysWOW64',
    'C:\\ProgramData', '/sys', '/proc', '/dev', '/etc', '/boot', '/root'
  ]
  const resolved = resolve(normalize(filePath))
  for (const b of blocked) {
    if (normalize(resolved).toLowerCase().startsWith(normalize(b).toLowerCase())) {
      return false
    }
  }
  return true
}

// ─── Bash Confirmation Dialog ─────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null

async function confirmBashCommand(command: string): Promise<boolean> {
  if (!mainWindow) return false
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    buttons: ['Cancel', 'Execute'],
    defaultId: 0,
    cancelId: 0,
    title: 'Execute Command?',
    message: 'The AI agent wants to run this command:',
    detail: command,
    icon: null
  })
  return response === 1
}

// ─── Blocked Command Patterns ──────────────────────────────────────────────

const DANGEROUS_COMMANDS = [
  /rm\s+-rf\s+\//, /dd\s+if=/, />\s*\/dev\/sd/,
  /format\s+[c-z]:/, /del\s+\/f\s+\/s\s+C:\\/i,
  /rd\s+\/s\s+C:\\/i, /format\s+C:/i
]

function isCommandSafe(command: string): boolean {
  for (const pattern of DANGEROUS_COMMANDS) {
    if (pattern.test(command)) return false
  }
  return true
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Agent O',
    icon: join(__dirname, '../../build/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.webContents.on('context-menu', (_event, params) => {
    const menu = Menu.buildFromTemplate([
      { label: 'Cut', role: 'cut', enabled: params.editFlags.canCut },
      { label: 'Copy', role: 'copy', enabled: params.editFlags.canCopy },
      { label: 'Paste', role: 'paste', enabled: params.editFlags.canPaste },
      { type: 'separator' },
      { label: 'Select All', role: 'selectAll' }
    ])
    menu.popup()
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

Menu.setApplicationMenu(null)

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// ─── Workspace IPC ────────────────────────────────────────────────────────

ipcMain.handle('workspace:set-root', (_event, root: string) => {
  workspaceRoot = root
  return true
})

ipcMain.handle('workspace:get-root', () => workspaceRoot)

// ─── File System IPC ───────────────────────────────────────────────────

ipcMain.handle('file:read', (_event, filePath: string) => {
  try {
    if (!isPathSafe(filePath)) return { error: 'Access denied: outside workspace' }
    return { content: readFileSync(filePath, 'utf-8') }
  } catch (e) {
    return { error: (e as Error).message }
  }
})

ipcMain.handle('file:read-unsafe', (_event, filePath: string) => {
  try {
    return { content: readFileSync(filePath, 'utf-8') }
  } catch (e) {
    return { error: (e as Error).message }
  }
})

ipcMain.handle('file:write', (_event, filePath: string, content: string) => {
  try {
    if (!isPathSafe(filePath)) return { error: 'Access denied: outside workspace' }
    writeFileSync(filePath, content, 'utf-8')
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
})

ipcMain.handle('file:exists', (_event, filePath: string) => {
  if (!isPathSafe(filePath)) return false
  return existsSync(filePath)
})

ipcMain.handle('dir:list', (_event, dirPath: string) => {
  try {
    if (!isPathSafe(dirPath)) return { error: 'Access denied: outside workspace' }
    const { readdirSync, statSync } = require('fs')
    const entries = readdirSync(dirPath)
    const items = entries.map((name: string) => {
      const fullPath = join(dirPath, name)
      try {
        const stat = statSync(fullPath)
        return { name, isDir: stat.isDirectory(), size: stat.size }
      } catch {
        return { name, isDir: false, size: 0 }
      }
    })
    return { items }
  } catch (e) {
    return { error: (e as Error).message }
  }
})

// ─── Bash IPC ─────────────────────────────────────────────────────────────

ipcMain.handle('bash:exec', async (_event, command: string) => {
  try {
    if (!isCommandSafe(command)) return { error: 'Blocked: dangerous command detected' }

    const confirmed = await confirmBashCommand(command)
    if (!confirmed) return { error: 'Execution cancelled — user denied permission' }

    return new Promise((resolve) => {
      const proc = spawn(command, [], { shell: true, timeout: 30000 })
      let stdout = ''
      let stderr = ''

      proc.stdout?.on('data', (data: Buffer) => { stdout += data.toString() })
      proc.stderr?.on('data', (data: Buffer) => { stderr += data.toString() })

      proc.on('close', (code) => {
        if (code === 0) {
          resolve({ output: stdout.slice(0, 50000) })
        } else {
          resolve({ output: stdout.slice(0, 50000), error: stderr.slice(0, 5000) || `Exit code ${code}` })
        }
      })

      proc.on('error', (err) => {
        resolve({ error: err.message })
      })
    })
  } catch (e) {
    return { error: (e as Error).message }
  }
})

// ─── Code Tools IPC ───────────────────────────────────────────────────────

ipcMain.handle('code:search', async (_event, pattern: string, searchPath?: string) => {
  const dir = searchPath || '.'
  try {
    if (workspaceRoot && !isInsideWorkspace(dir)) {
      return { error: 'Access denied: outside workspace' }
    }
    const result = spawnSync('rg', ['-n', '--no-heading', '-i', pattern, dir], { encoding: 'utf-8', timeout: 15000, shell: true })
    if (result.error && result.error.message.includes('ENOENT')) {
      return { error: 'ripgrep (rg) is not installed. Install from https://github.com/BurntSushi/ripgrep' }
    }
    if (result.status !== 0 && !result.stdout) {
      return { error: result.stderr || `No matches for "${pattern}"` }
    }
    const lines = result.stdout.split('\n').filter(Boolean)
    const output = lines.slice(0, 100).join('\n')
    const truncated = lines.length > 100 ? `\n... and ${lines.length - 100} more matches` : ''
    return { content: output + truncated }
  } catch (e) {
    return { error: (e as Error).message }
  }
})

ipcMain.handle('code:format', async (_event, filePath: string) => {
  try {
    if (!isPathSafe(filePath)) return { error: 'Access denied: outside workspace' }
    const result = spawnSync('npx', ['prettier', '--write', filePath], { encoding: 'utf-8', timeout: 30000, shell: true })
    if (result.error) {
      return { error: result.error.message }
    }
    if (result.status !== 0) {
      return { error: result.stderr || 'Formatting failed' }
    }
    return { content: `Formatted: ${filePath}` }
  } catch (e) {
    return { error: (e as Error).message }
  }
})

ipcMain.handle('code:test', async (_event, command: string) => {
  try {
    if (!isCommandSafe(command)) return { error: 'Blocked: dangerous command detected' }
    const confirmed = await confirmBashCommand(command)
    if (!confirmed) return { error: 'Execution cancelled — user denied permission' }
    const result = spawnSync(command, [], { encoding: 'utf-8', timeout: 60000, shell: true })
    const output = (result.stdout || '') + (result.stderr || '')
    if (result.status !== 0) {
      return { error: output.slice(0, 10000) || `Exit code ${result.status}` }
    }
    return { content: output.slice(0, 10000) }
  } catch (e) {
    return { error: (e as Error).message }
  }
})

// ─── Web Fetch IPC ──────────────────────────────────────────────────────

function isPrivateIP(hostname: string): boolean {
  const ip = hostname.toLowerCase()
  return (
    ip === 'localhost' ||
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip.startsWith('10.') ||
    ip.startsWith('172.16.') ||
    ip.startsWith('192.168.') ||
    ip.endsWith('.local') ||
    ip.endsWith('.internal')
  )
}

ipcMain.handle('web:fetch', (_event, url: string) => {
  return new Promise((resolve) => {
    let parsed: URL
    try {
      parsed = new URL(url)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        resolve({ error: 'Only http and https URLs are allowed' })
        return
      }
      if (isPrivateIP(parsed.hostname)) {
        resolve({ error: 'Access denied: cannot fetch local/private addresses' })
        return
      }
    } catch {
      resolve({ error: 'Invalid URL' })
      return
    }

    const protocol = parsed.protocol === 'https:' ? https : http

    function doFetch(fetchUrl: string, redirects: number) {
      if (redirects > 5) {
        resolve({ error: 'Too many redirects' })
        return
      }

      const req = protocol.get(fetchUrl, { timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          try {
            const redirectUrl = new URL(res.headers.location, fetchUrl).href
            const redirectParsed = new URL(redirectUrl)
            if (isPrivateIP(redirectParsed.hostname)) {
              resolve({ error: 'Access denied: redirect to local/private address' })
              return
            }
            doFetch(redirectUrl, redirects + 1)
          } catch {
            resolve({ error: 'Invalid redirect URL' })
          }
          return
        }
        let data = ''
        res.on('data', (chunk: string) => { data += chunk })
        res.on('end', () => {
          resolve({ content: data.slice(0, 50000), status: res.statusCode })
        })
      })
      req.on('error', (err) => {
        resolve({ error: `Cannot fetch ${fetchUrl}: ${err.message}` })
      })
      req.on('timeout', () => {
        req.destroy()
        resolve({ error: `Request to ${fetchUrl} timed out after 15s` })
      })
    }

    doFetch(url, 0)
  })
})

// ─── Web Search IPC ───────────────────────────────────────────────────────

ipcMain.handle('web:search', (_event, query: string) => {
  return new Promise((resolve) => {
    const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`

    https.get(url, { timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }, (res) => {
      let data = ''
      res.on('data', (chunk: string) => { data += chunk })
      res.on('end', () => {
        const results: Array<{ title: string; snippet: string; url: string }> = []
        const linkRegex = /<a[^>]+class="result-link"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi
        const snippetRegex = /<td[^>]*class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi
        const urls: string[] = []
        const titles: string[] = []
        const snippets: string[] = []

        let m
        while ((m = linkRegex.exec(data)) !== null) {
          titles.push(m[2].trim().replace(/<[^>]+>/g, ''))
          urls.push(m[1].replace(/^\/\/?/, 'https://'))
        }
        while ((m = snippetRegex.exec(data)) !== null) {
          snippets.push(m[1].trim().replace(/<[^>]+>/g, ''))
        }

        const count = Math.min(titles.length, urls.length, 8)
        for (let i = 0; i < count; i++) {
          results.push({ title: titles[i] || '', snippet: snippets[i] || '', url: urls[i] || '' })
        }

        const output = results.length > 0
          ? results.map((r, i) => `${i + 1}. ${r.title}\n   ${r.snippet}\n   ${r.url}`).join('\n\n')
          : 'No results found.'

        resolve({ content: output })
      })
    }).on('error', (err) => {
      resolve({ error: `Search failed: ${err.message}` })
    }).on('timeout', function () {
      this.destroy()
      resolve({ error: 'Search timed out' })
    })
  })
})

// ─── Ollama One-Click Setup ────────────────────────────────────────────

let activeProcess: ChildProcess | null = null
let activeRequest: http.ClientRequest | null = null

function sendProgress(event: IpcMainInvokeEvent, data: { stage: string; percent: number; message: string }) {
  event.sender.send('ollama:progress', data)
}

function getOllamaBinary(): string {
  if (process.platform === 'win32') {
    const paths = [
      'C:\\Program Files\\Ollama\\ollama.exe',
      join(process.env.LOCALAPPDATA || '', 'Programs\\Ollama\\ollama.exe'),
      join(process.env.USERPROFILE || '', '.ollama\\ollama.exe')
    ]
    for (const p of paths) {
      if (existsSync(p)) return p
    }
    return 'ollama.exe'
  }
  return 'ollama'
}

function isOllamaInstalled(): boolean {
  try {
    const bin = getOllamaBinary()
    if (!existsSync(bin) && process.platform === 'win32') return false
    const result = spawnSync(bin, ['--version'], { encoding: 'utf-8', timeout: 5000 })
    return result.status === 0
  } catch {
    return false
  }
}

function isOllamaRunning(): boolean {
  try {
    const bin = getOllamaBinary()
    const result = spawnSync(bin, ['list'], { encoding: 'utf-8', timeout: 5000 })
    return result.status === 0
  } catch {
    return false
  }
}

ipcMain.handle('ollama:check-installed', () => {
  return { installed: isOllamaInstalled(), running: isOllamaRunning(), platform: process.platform }
})

ipcMain.handle('ollama:download-installer', async (event) => {
  const platform = process.platform
  const tmpDir = mkdtempSync(join(tmpdir(), 'agent0-ollama-'))
  let url: string
  let dest: string

  if (platform === 'win32') {
    url = 'https://ollama.ai/download/OllamaSetup.exe'
    dest = join(tmpDir, 'OllamaSetup.exe')
  } else if (platform === 'darwin') {
    url = 'https://ollama.ai/download/Ollama-darwin.zip'
    dest = join(tmpDir, 'Ollama.zip')
  } else {
    sendProgress(event, { stage: 'error', percent: 0, message: 'Linux: please install via curl -fsSL https://ollama.ai/install.sh | sh' })
    return { success: false, error: 'Use the install script for Linux' }
  }

  return new Promise((resolve) => {
    sendProgress(event, { stage: 'downloading', percent: 0, message: 'Downloading Ollama installer...' })

    const file = require('fs').createWriteStream(dest)
    const request = https.get(url, (response) => {
      activeRequest = request
      const total = parseInt(response.headers['content-length'] || '0', 10)
      let downloaded = 0

      response.on('data', (chunk: Buffer) => {
        downloaded += chunk.length
        if (total > 0) {
          const percent = Math.round((downloaded / total) * 100)
          sendProgress(event, {
            stage: 'downloading',
            percent,
            message: `Downloading installer... ${percent}% (${Math.round(downloaded / 1024 / 1024 * 10) / 10} MB)`
          })
        }
      })

      response.pipe(file)
      file.on('finish', () => {
        file.close()
        sendProgress(event, { stage: 'downloaded', percent: 100, message: 'Download complete' })
        resolve({ success: true, path: dest, platform })
      })
    })

    request.on('error', (err) => {
      activeRequest = null
      sendProgress(event, { stage: 'error', percent: 0, message: `Download failed: ${err.message}` })
      resolve({ success: false, error: err.message })
    })

    request.end()
  })
})

ipcMain.handle('ollama:install-ollama', async (event, installerPath: string) => {
  // Confirm with user before installing
  if (mainWindow) {
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      buttons: ['Cancel', 'Install'],
      defaultId: 0,
      cancelId: 0,
      title: 'Install Ollama?',
      message: 'The app is about to install Ollama on your system.',
      detail: `Ollama will be installed silently. This will download and install:\n\n  • ollama.exe (AI model runner)\n  • CLI tools for managing models\n\nYou can uninstall anytime from Windows Settings > Apps.`
    })
    if (response === 0) {
      return { success: false, error: 'Install cancelled by user' }
    }
  }

  sendProgress(event, { stage: 'installing', percent: 0, message: 'Installing Ollama...' })

  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      const startTime = Date.now()
      const progressTimer = setInterval(() => {
        const elapsed = Date.now() - startTime
        const pct = Math.min(Math.round((elapsed / 120000) * 75), 74)
        sendProgress(event, { stage: 'installing', percent: pct, message: `Installing Ollama... ${Math.round(elapsed / 1000)}s` })
      }, 1000)

      const proc = execFile(installerPath, ['/S'])
      activeProcess = proc
      proc.on('close', (code) => {
        clearInterval(progressTimer)
        activeProcess = null
        if (code === 0) {
          sendProgress(event, { stage: 'installed', percent: 80, message: 'Ollama installed successfully' })
          resolve({ success: true })
        } else {
          sendProgress(event, { stage: 'error', percent: 0, message: `Install failed with code ${code}` })
          resolve({ success: false, error: `Exit code ${code}` })
        }
      })
      proc.on('error', (err) => {
        clearInterval(progressTimer)
        activeProcess = null
        sendProgress(event, { stage: 'error', percent: 0, message: `Install failed: ${err.message}` })
        resolve({ success: false, error: err.message })
      })
      proc.stdout?.on('data', (data) => {
        sendProgress(event, { stage: 'installing', percent: 60, message: data.toString().trim() })
      })
    } else {
      resolve({ success: false, error: 'Unsupported platform' })
    }
  })
})

ipcMain.handle('ollama:pull-model', async (event, modelName: string) => {
  const bin = getOllamaBinary()

  return new Promise((resolve) => {
    sendProgress(event, { stage: 'pulling', percent: 0, message: `Pulling ${modelName}...` })

    const proc = spawn(bin, ['pull', modelName], { shell: true })
    activeProcess = proc

    proc.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString().trim().split('\n')
      for (const line of lines) {
        try {
          const json = JSON.parse(line)
          if (json.status) {
            if (json.total && json.completed !== undefined) {
              const percent = Math.round((json.completed / json.total) * 100)
              const name = json.digest ? json.digest.substring(7, 19) : ''
              sendProgress(event, {
                stage: 'pulling',
                percent,
                message: name ? `Downloading layer ${name}... ${percent}%` : json.status
              })
            } else {
              sendProgress(event, { stage: 'pulling', percent: 90, message: json.status })
            }
          }
        } catch {
          sendProgress(event, { stage: 'pulling', percent: 85, message: line })
        }
      }
    })

    proc.stderr?.on('data', (data: Buffer) => {
      const msg = data.toString().trim()
      if (msg) {
        sendProgress(event, { stage: 'pulling', percent: 80, message: msg })
      }
    })

    proc.on('close', (code) => {
      activeProcess = null
      if (code === 0) {
        sendProgress(event, { stage: 'ready', percent: 100, message: `${modelName} is ready!` })
        resolve({ success: true })
      } else {
        sendProgress(event, { stage: 'error', percent: 0, message: `Failed to pull ${modelName}` })
        resolve({ success: false, error: `Process exited with code ${code}` })
      }
    })

    proc.on('error', (err) => {
      activeProcess = null
      sendProgress(event, { stage: 'error', percent: 0, message: err.message })
      resolve({ success: false, error: err.message })
    })
  })
})

ipcMain.on('ollama:cancel', () => {
  if (activeProcess) {
    try { activeProcess.kill() } catch { /* process may already be dead */ }
    activeProcess = null
  }
  if (activeRequest) {
    try { activeRequest.destroy() } catch { /* request may already be closed */ }
    activeRequest = null
  }
})

ipcMain.handle('ollama:list-pulled', async () => {
  const bin = getOllamaBinary()
  try {
    const result = spawnSync(bin, ['list'], { encoding: 'utf-8', timeout: 10000 })
    if (result.status !== 0) return { error: result.stderr || 'Failed to list models' }
    const lines = result.stdout.split('\n').filter(Boolean)
    const models = lines.slice(1).map(line => {
      const parts = line.split(/\s{2,}/)
      return { name: (parts[0] || '').replace(':latest', ''), size: parts[2] || '' }
    }).filter(m => m.name)
    return { models }
  } catch (e) {
    return { error: (e as Error).message }
  }
})

ipcMain.handle('install:cleanup-temp', async (_event, tmpDir: string) => {
  try {
    const { rmSync } = require('fs')
    if (tmpDir && tmpDir.includes('agent0-ollama')) {
      rmSync(tmpDir, { recursive: true, force: true })
    }
    return { success: true }
  } catch {
    return { success: false }
  }
})

// ─── Document Reading ───────────────────────────────────────────────────

ipcMain.handle('documents:read-pdf', async (_event, filePath: string) => {
  try {
    if (!isPathSafe(filePath)) return { error: 'Access denied: outside workspace' }
    return await readPdfFile(filePath)
  } catch (e) {
    return { error: (e as Error).message }
  }
})

ipcMain.handle('documents:read-pdf-unsafe', async (_event, filePath: string) => {
  try {
    return await readPdfFile(filePath)
  } catch (e) {
    return { error: (e as Error).message }
  }
})

async function readPdfFile(filePath: string) {
  const buf = await readFile(filePath)
  const parser = new PDFParse({ data: buf })
  await parser.load()
  const [textResult, infoResult] = await Promise.all([parser.getText(), parser.getInfo()])
  await parser.destroy()
  return {
    content: textResult.text,
    pages: textResult.total,
    info: {
      pdfVersion: infoResult.info?.PDFFormatVersion,
      isEncrypted: !!infoResult.info?.EncryptFilterName
    }
  }
}

ipcMain.handle('documents:read-docx', async (_event, filePath: string) => {
  try {
    if (!isPathSafe(filePath)) return { error: 'Access denied: outside workspace' }
    return await readDocxFile(filePath)
  } catch (e) {
    return { error: (e as Error).message }
  }
})

ipcMain.handle('documents:read-docx-unsafe', async (_event, filePath: string) => {
  try {
    return await readDocxFile(filePath)
  } catch (e) {
    return { error: (e as Error).message }
  }
})

async function readDocxFile(filePath: string) {
  const result = await mammoth.extractRawText({ path: filePath })
  return { content: result.value }
}

ipcMain.handle('documents:read-pdf-buffer', async (_event, { base64 }: { base64: string }) => {
  try {
    const buf = Buffer.from(base64, 'base64')
    const parser = new PDFParse({ data: buf })
    await parser.load()
    const [textResult, infoResult] = await Promise.all([parser.getText(), parser.getInfo()])
    await parser.destroy()
    return {
      content: textResult.text,
      pages: textResult.total,
      info: {
        pdfVersion: infoResult.info?.PDFFormatVersion,
        isEncrypted: !!infoResult.info?.EncryptFilterName
      }
    }
  } catch (e) {
    return { error: (e as Error).message }
  }
})

ipcMain.handle('documents:read-docx-buffer', async (_event, { base64 }: { base64: string }) => {
  try {
    const buf = Buffer.from(base64, 'base64')
    const result = await mammoth.extractRawText({ buffer: buf })
    return { content: result.value }
  } catch (e) {
    return { error: (e as Error).message }
  }
})
