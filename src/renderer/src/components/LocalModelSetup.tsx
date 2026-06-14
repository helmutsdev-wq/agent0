import * as React from 'react'
import { useLanguage } from '../lib/i18n'
import { getProvider, getConfigs } from '../lib/providers'
import { setAgentConfig, getAgentConfig } from '../lib/agent'

interface SetupState {
  status: 'checking' | 'ready' | 'downloading' | 'installing' | 'pulling' | 'error' | 'complete'
  installed: boolean
  running: boolean
  progress: number
  message: string
  platform: string
  installerPath?: string
  tmpDir?: string
}

interface InstallState {
  stage: 'downloading' | 'downloaded' | 'installing' | 'pulling' | 'complete' | 'error'
  modelName: string
  installerPath?: string
  tmpDir?: string
  timestamp: number
}

interface PulledModel {
  name: string
  size: string
}

const MODELS = [
  { id: 'llama3.2', name: 'Llama 3.2 (Recommended)', size: '2.0 GB' },
  { id: 'llama3.1:8b', name: 'Llama 3.1 8B', size: '4.7 GB' },
  { id: 'mistral', name: 'Mistral', size: '4.1 GB' },
  { id: 'qwen2.5:7b', name: 'Qwen 2.5 7B', size: '4.3 GB' },
  { id: 'deepseek-coder-v2', name: 'DeepSeek Coder V2', size: '4.4 GB' }
]

const TOTAL_STEPS = 3

function getStepInfo(status: string, t: (k: string) => string): { step: number; label: string } {
  switch (status) {
    case 'downloading': return { step: 1, label: t('local.step1') }
    case 'installing': return { step: 2, label: t('local.step2') }
    case 'pulling': return { step: 3, label: t('local.step3') }
    default: return { step: 0, label: '' }
  }
}

const INSTALL_STATE_KEY = 'agent0_install_state'
const FIRST_LAUNCH_KEY = 'agent0_first_launch_prompted'

function saveInstallState(stage: InstallState['stage'], modelName: string, extra?: Partial<InstallState>) {
  try {
    const prev = JSON.parse(localStorage.getItem(INSTALL_STATE_KEY) || '{}')
    const state: InstallState = { stage, modelName, timestamp: Date.now(), ...prev, ...extra }
    localStorage.setItem(INSTALL_STATE_KEY, JSON.stringify(state))
  } catch { /* ignore storage errors */ }
}

function clearInstallState() {
  try { localStorage.removeItem(INSTALL_STATE_KEY) } catch { /* */ }
}

function loadInstallState(): InstallState | null {
  try {
    const raw = localStorage.getItem(INSTALL_STATE_KEY)
    if (!raw) return null
    const state = JSON.parse(raw) as InstallState
    if (state.stage === 'complete' || state.stage === 'error') {
      clearInstallState()
      return null
    }
    return state
  } catch {
    clearInstallState()
    return null
  }
}

export function LocalModelSetup({ onComplete, autoStart }: { onComplete?: () => void; autoStart?: boolean }) {
  const { t } = useLanguage()
  const [state, setState] = React.useState<SetupState>({
    status: 'checking',
    installed: false,
    running: false,
    progress: 0,
    message: t('local.checking'),
    platform: 'win32'
  })
  const [selectedModel, setSelectedModel] = React.useState('llama3.2')
  const [pulledModels, setPulledModels] = React.useState<PulledModel[]>([])
  const [recovery, setRecovery] = React.useState<InstallState | null>(null)
  const [activeModel, setActiveModel] = React.useState('')
  const [customModel, setCustomModel] = React.useState('')
  const [justAddedModel, setJustAddedModel] = React.useState('')
  const [logLines, setLogLines] = React.useState<string[]>([])
  const [showDetails, setShowDetails] = React.useState(false)
  const logEndRef = React.useRef<HTMLDivElement>(null)
  const cleanupRef = React.useRef<(() => void) | null>(null)
  const startedRef = React.useRef(false)
  const cancelledRef = React.useRef(false)

  React.useEffect(() => {
    checkStatus()
    loadPulledModels()
    return () => cleanupRef.current?.()
  }, [])

  React.useEffect(() => {
    const unsub = window.electronAPI.ollama.onProgress((data) => {
      if (cancelledRef.current) return
      setState(prev => ({
        ...prev,
        progress: data.percent,
        message: data.message,
        status: data.stage as SetupState['status']
      }))
      if (data.rawLine) {
        setLogLines(prev => {
          const next = [...prev, data.rawLine!]
          if (next.length > 500) next.splice(0, next.length - 500)
          return next
        })
      }
      if (data.stage === 'ready') {
        clearInstallState()
        setTimeout(() => {
          setState(prev => ({ ...prev, status: 'complete', progress: 100 }))
          loadPulledModels()
          onComplete?.()
        }, 1000)
      }
    })
    cleanupRef.current = unsub
    return unsub
  }, [onComplete])

  React.useEffect(() => {
    if (state.status === 'complete' || state.status === 'ready' || state.status === 'error') {
      checkRecovery()
    }
  }, [state.status])

  React.useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logLines])

  React.useEffect(() => {
    if (autoStart && !startedRef.current && state.status === 'ready' && !state.installed) {
      startedRef.current = true
      startSetup()
    }
  }, [autoStart, state.status, state.installed])

  React.useEffect(() => {
    const cfg = getAgentConfig()
    const ollama = getProvider('ollama')
    if (ollama) {
      const m = ollama.models.find(mm => mm.id === cfg.model)
      setActiveModel(m?.name || cfg.model)
    }
  }, [])

  async function checkStatus() {
    try {
      const result = await window.electronAPI.ollama.checkInstalled()
      setState(prev => ({
        ...prev,
        status: result.installed && result.running ? 'complete' : result.installed ? 'ready' : 'ready',
        installed: result.installed,
        running: result.running,
        platform: result.platform,
        message: result.installed && result.running
          ? t('local.running')
          : result.installed
            ? t('local.installedNotRunning')
            : t('local.notInstalled'),
        progress: result.installed && result.running ? 100 : 0
      }))
    } catch {
      setState(prev => ({ ...prev, status: 'error', message: t('local.checkFailed') }))
    }
  }

  async function loadPulledModels() {
    try {
      const result = await window.electronAPI.ollama.listPulled()
      if (result.models) {
        setPulledModels(result.models)
      }
    } catch { /* ollama not running */ }
  }

  function checkRecovery() {
    const saved = loadInstallState()
    if (!saved) return

    if (saved.stage === 'downloading' || saved.stage === 'downloaded') {
      window.electronAPI.install.cleanupTemp(saved.tmpDir || '').catch(() => {})
    }
    if (saved.stage === 'installing' && state.installed) {
      clearInstallState()
      handleResumePull(saved.modelName)
      return
    }
    if (saved.stage === 'pulling' && state.running) {
      checkModelPulled(saved.modelName).then(isPulled => {
        if (isPulled) {
          clearInstallState()
          setState(prev => ({ ...prev, status: 'complete', progress: 100, message: `${saved.modelName} ${t('local.recoveryComplete')}` }))
        } else {
          setRecovery(saved)
        }
      })
      return
    }
    setRecovery(saved)
  }

  async function checkModelPulled(modelName: string): Promise<boolean> {
    try {
      const result = await window.electronAPI.ollama.listPulled()
      return result.models?.some(m => m.name === modelName || m.name.startsWith(modelName)) || false
    } catch {
      return false
    }
  }

  function setModelActive(modelId: string) {
    setAgentConfig({ provider: 'ollama', model: modelId })
    const ollama = getProvider('ollama')
    const m = ollama?.models.find(mm => mm.id === modelId)
    setActiveModel(m?.name || modelId)
  }

  function addLocalModel() {
    const name = customModel.trim()
    if (!name) return
    const ollama = getProvider('ollama')
    if (!ollama) return
    const exists = ollama.models.some(m => m.id === name || m.name === name)
    if (exists) {
      setModelActive(name)
      setJustAddedModel(name)
      setCustomModel('')
      setTimeout(() => setJustAddedModel(''), 2000)
      return
    }
    ollama.models.push({
      id: name,
      name,
      provider: 'ollama',
      capabilities: ['chat'],
      speed: 'medium',
      quality: 'medium',
      available: true,
      cost: 'free'
    })
    setPulledModels(prev => {
      if (prev.some(m => m.name === name)) return prev
      return [...prev, { name, size: '' }]
    })
    setModelActive(name)
    setJustAddedModel(name)
    setCustomModel('')
    setTimeout(() => setJustAddedModel(''), 2000)
  }

  function handleResumePull(modelName: string) {
    setSelectedModel(modelName)
    setState(prev => ({ ...prev, status: 'pulling', progress: 0, message: t('local.step3') + '...' }))
    saveInstallState('pulling', modelName)
    window.electronAPI.ollama.pullModel(modelName).then(pull => {
      if (!pull.success) {
        setState(prev => ({ ...prev, status: 'error', message: pull.error || t('local.modelPullFailed') }))
      }
    })
  }

  function handleDismissRecovery() {
    clearInstallState()
    setRecovery(null)
  }

  function handleRestartSetup() {
    clearInstallState()
    setRecovery(null)
    setState(prev => ({ ...prev, status: 'ready', installed: false, message: t('local.notInstalled') }))
  }

  async function startSetup() {
    setLogLines([])
    saveInstallState('downloading', selectedModel)
    setState(prev => ({ ...prev, status: 'downloading', progress: 0, message: t('local.startDownload') }))

    const dl = await window.electronAPI.ollama.downloadInstaller()
    if (cancelledRef.current) return
    if (!dl.success) {
      clearInstallState()
      setState(prev => ({ ...prev, status: 'error', message: dl.error || t('local.downloadFailed') }))
      return
    }

    saveInstallState('downloaded', selectedModel, { installerPath: dl.path, tmpDir: dl.path?.substring(0, dl.path.lastIndexOf('\\')) })

    setState(prev => ({ ...prev, installerPath: dl.path }))

    if (dl.platform === 'linux') {
      clearInstallState()
      setState(prev => ({ ...prev, status: 'ready', installed: true, running: false, message: t('local.linuxHint') }))
      return
    }

    saveInstallState('installing', selectedModel)
    const install = await window.electronAPI.ollama.installOllama(dl.path!)
    if (cancelledRef.current) return
    if (!install.success) {
      clearInstallState()
      setState(prev => ({ ...prev, status: 'error', message: install.error || t('local.installFailed') }))
      return
    }

    saveInstallState('pulling', selectedModel)
    setState(prev => ({ ...prev, status: 'pulling', progress: 0, message: t('local.step3') + '...' }))

    const pull = await window.electronAPI.ollama.pullModel(selectedModel)
    if (cancelledRef.current) return
    if (!pull.success) {
      clearInstallState()
      setState(prev => ({ ...prev, status: 'error', message: pull.error || t('local.modelPullFailed') }))
    }
  }

  async function skipInstall() {
    saveInstallState('pulling', selectedModel)
    setState(prev => ({ ...prev, status: 'pulling', progress: 0, message: t('local.step3') + '...' }))
    const pull = await window.electronAPI.ollama.pullModel(selectedModel)
    if (cancelledRef.current) return
    if (!pull.success) {
      clearInstallState()
      setState(prev => ({ ...prev, status: 'error', message: pull.error || t('local.modelPullFailed') }))
    }
  }

  function cancelSetup() {
    cancelledRef.current = true
    clearInstallState()
    window.electronAPI.ollama.cancel()
    setState(prev => ({
      ...prev,
      status: 'ready',
      installed: prev.installed,
      running: prev.running,
      progress: 0,
      message: prev.installed ? t('local.installedNotRunning') : t('local.notInstalled')
    }))
    setTimeout(() => { cancelledRef.current = false }, 500)
  }

  const isBusy = state.status === 'downloading' || state.status === 'installing' || state.status === 'pulling'
  const stepInfo = getStepInfo(state.status, t)
  const modelSize = MODELS.find(m => m.id === selectedModel)?.size || ''

  return (
    <div className="space-y-3">
      {state.status === 'complete' && (
        <div className="flex items-center gap-2 text-emerald-400">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <span className="text-sm font-medium">{t('local.ready')}</span>
        </div>
      )}
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-[var(--accent)]/20 flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--accent)]">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
        <span className="text-sm font-medium">{t('local.title')}</span>
      </div>

      {recovery && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
          <p className="text-xs font-medium text-amber-400">{t('local.recoveryTitle')}</p>
          <p className="text-xs text-[var(--text-secondary)]">
            {recovery.stage === 'downloading' || recovery.stage === 'downloaded' ? t('local.recoveryDownloading') :
             recovery.stage === 'installing' ? t('local.recoveryInstalling') :
             t('local.recoveryPulling')}
          </p>
          <div className="flex gap-2">
            {(recovery.stage === 'installing' || recovery.stage === 'pulling') && (
              <button onClick={() => handleResumePull(recovery.modelName)}
                className="px-3 py-1.5 rounded-md bg-[var(--accent)] text-white text-xs font-medium hover:opacity-90 transition-opacity"
              >{t('local.recoveryResume')}</button>
            )}
            <button onClick={handleRestartSetup}
              className="px-3 py-1.5 rounded-md border border-[var(--border)] text-xs text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
            >{t('local.recoveryRestart')}</button>
            <button onClick={handleDismissRecovery}
              className="px-3 py-1.5 rounded-md text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >{t('local.recoveryDismiss')}</button>
          </div>
        </div>
      )}

      {isBusy && (
        <div className="rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] p-3 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-[var(--text-primary)] font-medium">
              {t('local.step1').split(' ')[0]} {stepInfo.step}/{TOTAL_STEPS}: {stepInfo.label}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
              style={{ width: `${Math.max(state.progress, 2)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-[var(--text-secondary)]">{state.message}</span>
            <span className="text-[var(--text-secondary)]">{state.progress}%</span>
          </div>
          <p className="text-[10px] text-[var(--text-secondary)]">
            {state.status === 'downloading' && t('local.step1desc')}
            {state.status === 'installing' && t('local.step2desc')}
            {state.status === 'pulling' && t('local.step3desc', { model: selectedModel, size: modelSize })}
          </p>
          {logLines.length > 0 && (
            <div className="space-y-1">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  className={`transition-transform ${showDetails ? 'rotate-0' : '-rotate-90'}`}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
                {showDetails ? 'Hide' : 'Show'} details
              </button>
              {showDetails && (
                <div className="max-h-48 overflow-y-auto rounded-md bg-[#1e1e1e] p-2 font-mono text-[11px] leading-relaxed text-[#d4d4d4] select-text">
                  {logLines.map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                  <div ref={logEndRef} />
                </div>
              )}
            </div>
          )}
          <button
            onClick={cancelSetup}
            className="w-full py-1.5 rounded-md border border-red-500/30 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {!isBusy && !recovery && (
        <div className="rounded-lg bg-[var(--bg-tertiary)] p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--text-secondary)]">{t('local.status')}</span>
            <span className={
              state.status === 'error' ? 'text-red-400' :
              'text-[var(--text-primary)]'
            }>
              {state.message}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--text-secondary)]">{t('local.model')}</span>
            <select
              value={selectedModel}
              onChange={e => setSelectedModel(e.target.value)}
              className="bg-transparent text-[var(--text-primary)] outline-none cursor-pointer"
            >
              {MODELS.map(m => (
                <option key={m.id} value={m.id} className="bg-[var(--bg-secondary)]">
                  {m.name} ({m.size})
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {pulledModels.length > 0 && !isBusy && renderPulledModels()}

      {!isBusy && (
        <div className="rounded-lg bg-[var(--bg-tertiary)] p-3 space-y-2">
          <div className="flex items-center gap-2">
            <input
              value={customModel}
              onChange={e => setCustomModel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addLocalModel() }}
              placeholder={t('local.addModelPlaceholder')}
              className="flex-1 bg-[var(--bg-primary)] border border-[var(--border)] rounded-md px-2.5 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-colors placeholder:text-[var(--text-secondary)]"
            />
            <button
              onClick={addLocalModel}
              disabled={!customModel.trim()}
              className="px-3 py-1.5 rounded-md bg-[var(--accent)] text-white text-xs font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity shrink-0"
            >
              {justAddedModel ? t('local.modelAdded') : t('local.addModel')}
            </button>
          </div>
          <p className="text-[10px] text-[var(--text-secondary)]">{t('local.addModelHint')}</p>
        </div>
      )}

      {state.status === 'ready' && !state.installed && !recovery && (
        <>
          <button
            onClick={startSetup}
            className="w-full py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            {t('local.install')}
          </button>
          <p className="text-xs text-[var(--text-secondary)]">
            {t('local.readyDesc')}
          </p>
        </>
      )}

      {((state.status === 'ready' && state.installed && !state.running) || state.status === 'complete') && !recovery && (
        <div className="space-y-2">
          {state.status === 'ready' && state.installed && !state.running && (
            <p className="text-xs text-amber-400">
              {t('local.installedNotRunningHint')} <code className="px-1 py-0.5 rounded bg-[var(--bg-tertiary)]">ollama serve</code> {t('local.inTerminal')}
            </p>
          )}
          {state.status === 'complete' && (
            <p className="text-xs text-[var(--text-secondary)]">
              {selectedModel} {t('local.readyDesc')}
            </p>
          )}
          <button
            onClick={skipInstall}
            className="w-full py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            {state.status === 'complete' ? `Pull ${selectedModel}` : t('local.pullOnly')}
          </button>
        </div>
      )}

      {state.status === 'error' && !recovery && (
        <div className="space-y-2">
          <p className="text-xs text-red-400">{state.message}</p>
          <button
            onClick={checkStatus}
            className="w-full py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            {t('local.retry')}
          </button>
        </div>
      )}
    </div>
  )

  function renderPulledModels() {
    const cfg = getAgentConfig()
    return (
      <div className="rounded-lg bg-[var(--bg-tertiary)] p-3 space-y-2">
        <p className="text-xs font-medium text-[var(--text-primary)]">
          {t('local.installedModels')} ({pulledModels.length})
        </p>
        <p className="text-[10px] text-[var(--text-secondary)]">{t('local.installedModelsDesc')}</p>
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {pulledModels.map(m => {
            const isActive = cfg.provider === 'ollama' && (cfg.model === m.name || cfg.model.startsWith(m.name.split(':')[0]))
            return (
              <div key={m.name}
                className={`flex items-center justify-between px-2 py-1.5 rounded-md text-xs transition-colors ${isActive ? 'bg-[var(--accent)]/10' : 'hover:bg-[var(--bg-secondary)]'}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[var(--text-primary)] truncate">{m.name}</span>
                  <span className="text-[10px] text-[var(--text-secondary)] shrink-0">{m.size}</span>
                </div>
                {isActive ? (
                  <span className="text-[10px] text-[var(--accent)] shrink-0">{t('local.active')}</span>
                ) : (
                  <button onClick={() => setModelActive(m.name)}
                    className="text-[10px] text-[var(--text-secondary)] hover:text-[var(--accent)] shrink-0 transition-colors"
                  >{t('local.setActive')}</button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }
}
