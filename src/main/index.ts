import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { execSync } from 'child_process'

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

ipcMain.handle('file:read', (_event, filePath: string) => {
  try {
    return { content: readFileSync(filePath, 'utf-8') }
  } catch (e) {
    return { error: (e as Error).message }
  }
})

ipcMain.handle('file:write', (_event, filePath: string, content: string) => {
  try {
    writeFileSync(filePath, content, 'utf-8')
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
})

ipcMain.handle('file:exists', (_event, filePath: string) => {
  return existsSync(filePath)
})

ipcMain.handle('bash:exec', (_event, command: string) => {
  try {
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
    const { readdirSync, statSync } = require('fs')
    const entries = readdirSync(dirPath)
    const items = entries.map(name => {
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
