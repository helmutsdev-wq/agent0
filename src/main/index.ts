import { app, BrowserWindow, ipcMain, IpcMainInvokeEvent, Menu } from 'electron'
import { join, resolve, normalize } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdtempSync } from 'fs'
import { execSync, spawn, execFile } from 'child_process'
import https from 'https'
import http from 'http'
import { tmpdir } from 'os'

const BLOCKED_DIRS = [
  '/sys', '/proc', '/dev',
  'C:\\Windows', 'C:\\Windows\\System32', 'C:\\Windows\\SysWOW64',
  'C:\\ProgramData', '/etc', '/boot', '/root'
]

const DANGEROUS_COMMANDS = [
  /rm\s+-rf\s+\//, /dd\s+if=/, />\s*\/dev\/sd/,
  /format\s+[c-z]:/, /del\s+\/f\s+\/s\s+C:\\/i,
  /rd\s+\/s\s+C:\\/i, /format\s+C:/i
]

function isPathSafe(filePath: string): boolean {
  const resolved = resolve(normalize(filePath))
  for (const blocked of BLOCKED_DIRS) {
    if (normalize(resolved).toLowerCase().startsWith(normalize(blocked).toLowerCase())) {
      return false
    }
  }
  return true
}

function isCommandSafe(command: string): boolean {
  for (const pattern of DANGEROUS_COMMANDS) {
    if (pattern.test(command)) return false
  }
  return true
}

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Agent0',
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

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// ─── File System IPC ───────────────────────────────────────────────────

ipcMain.handle('file:read', (_event, filePath: string) => {
  try {
    if (!isPathSafe(filePath)) return { error: 'Access denied: path restricted' }
    return { content: readFileSync(filePath, 'utf-8') }
  } catch (e) {
    return { error: (e as Error).message }
  }
})

ipcMain.handle('file:write', (_event, filePath: string, content: string) => {
  try {
    if (!isPathSafe(filePath)) return { error: 'Access denied: path restricted' }
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

ipcMain.handle('bash:exec', (_event, command: string) => {
  try {
    if (!isCommandSafe(command)) return { error: 'Blocked: dangerous command detected' }
    const output = execSync(command, {
      encoding: 'utf-8',
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024
    })
    return { output }
  } catch (e) {
    const err = e as Error & { stdout?: string; stderr?: string }
    return {
      output: err.stdout || err.message,
      error: err.stderr || err.message
    }
  }
})

ipcMain.handle('dir:list', (_event, dirPath: string) => {
  try {
    if (!isPathSafe(dirPath)) return { error: 'Access denied: path restricted' }
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

// ─── Web Fetch IPC ──────────────────────────────────────────────────────

ipcMain.handle('web:fetch', (_event, url: string) => {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http

    function doFetch(fetchUrl: string, redirects: number) {
      if (redirects > 5) {
        resolve({ error: 'Too many redirects' })
        return
      }
      const req = protocol.get(fetchUrl, { timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, fetchUrl).href
          doFetch(redirectUrl, redirects + 1)
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

function sendProgress(event: IpcMainInvokeEvent, data: { stage: string; percent: number; message: string }) {
  event.sender.send('ollama:progress', data)
}

// ─── Ollama One-Click Setup ────────────────────────────────────────────

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
    execSync(`${bin} --version`, { encoding: 'utf-8', timeout: 5000 })
    return true
  } catch {
    return false
  }
}

function isOllamaRunning(): boolean {
  try {
    const bin = getOllamaBinary()
    execSync(`${bin} list`, { encoding: 'utf-8', timeout: 5000 })
    return true
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
      sendProgress(event, { stage: 'error', percent: 0, message: `Download failed: ${err.message}` })
      resolve({ success: false, error: err.message })
    })

    request.end()
  })
})

ipcMain.handle('ollama:install-ollama', async (event, installerPath: string) => {
  sendProgress(event, { stage: 'installing', percent: 50, message: 'Installing Ollama (this may take 1-2 minutes)...' })

  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      const startTime = Date.now()
      const progressTimer = setInterval(() => {
        const elapsed = Date.now() - startTime
        const pct = Math.min(50 + Math.round((elapsed / 120000) * 25), 74)
        sendProgress(event, { stage: 'installing', percent: pct, message: `Installing Ollama... ${Math.round(elapsed / 1000)}s` })
      }, 2000)

      const proc = execFile(installerPath, ['/S'], (err) => {
        clearInterval(progressTimer)
        if (err) {
          sendProgress(event, { stage: 'error', percent: 0, message: `Install failed: ${err.message}` })
          resolve({ success: false, error: err.message })
        } else {
          sendProgress(event, { stage: 'installed', percent: 80, message: 'Ollama installed successfully' })
          resolve({ success: true })
        }
      })
      proc.stdout?.on('data', (data) => {
        sendProgress(event, { stage: 'installing', percent: 65, message: data.toString().trim() })
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
      if (code === 0) {
        sendProgress(event, { stage: 'ready', percent: 100, message: `${modelName} is ready!` })
        resolve({ success: true })
      } else {
        sendProgress(event, { stage: 'error', percent: 0, message: `Failed to pull ${modelName}` })
        resolve({ success: false, error: `Process exited with code ${code}` })
      }
    })

    proc.on('error', (err) => {
      sendProgress(event, { stage: 'error', percent: 0, message: err.message })
      resolve({ success: false, error: err.message })
    })
  })
})
