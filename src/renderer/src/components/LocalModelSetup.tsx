import * as React from 'react'
import { useLanguage } from '../lib/i18n'

interface SetupState {
  status: 'checking' | 'ready' | 'downloading' | 'installing' | 'pulling' | 'error' | 'complete'
  installed: boolean
  running: boolean
  progress: number
  message: string
  platform: string
  installerPath?: string
}

const MODELS = [
  { id: 'llama3.2', name: 'Llama 3.2 (Recommended)', size: '2.0 GB' },
  { id: 'llama3.1:8b', name: 'Llama 3.1 8B', size: '4.7 GB' },
  { id: 'mistral', name: 'Mistral', size: '4.1 GB' },
  { id: 'qwen2.5:7b', name: 'Qwen 2.5 7B', size: '4.3 GB' }
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

export function LocalModelSetup({ onComplete }: { onComplete?: () => void }) {
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
  const cleanupRef = React.useRef<(() => void) | null>(null)

  React.useEffect(() => {
    checkStatus()
    return () => cleanupRef.current?.()
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
      setState(prev => ({
        ...prev,
        status: 'error',
        message: t('local.checkFailed')
      }))
    }
  }

  React.useEffect(() => {
    const unsub = window.electronAPI.ollama.onProgress((data) => {
      setState(prev => ({
        ...prev,
        progress: data.percent,
        message: data.message,
        status: data.stage as SetupState['status']
      }))

      if (data.stage === 'ready') {
        setTimeout(() => {
          setState(prev => ({ ...prev, status: 'complete', progress: 100 }))
          onComplete?.()
        }, 1000)
      }
    })
    cleanupRef.current = unsub
    return unsub
  }, [onComplete])

  async function startSetup() {
    setState(prev => ({ ...prev, status: 'downloading', progress: 0, message: t('local.startDownload') }))

    const dl = await window.electronAPI.ollama.downloadInstaller()
    if (!dl.success) {
      setState(prev => ({ ...prev, status: 'error', message: dl.error || t('local.downloadFailed') }))
      return
    }

    setState(prev => ({ ...prev, installerPath: dl.path }))

    if (dl.platform === 'linux') {
      setState(prev => ({ ...prev, status: 'ready', installed: true, running: false, message: t('local.linuxHint') }))
      return
    }

    const install = await window.electronAPI.ollama.installOllama(dl.path!)
    if (!install.success) {
      setState(prev => ({ ...prev, status: 'error', message: install.error || t('local.installFailed') }))
      return
    }

    setState(prev => ({ ...prev, status: 'pulling', progress: 0, message: t('local.step3') + '...' }))

    const pull = await window.electronAPI.ollama.pullModel(selectedModel)
    if (!pull.success) {
      setState(prev => ({ ...prev, status: 'error', message: pull.error || t('local.modelPullFailed') }))
    }
  }

  async function skipInstall() {
    setState(prev => ({ ...prev, status: 'pulling', progress: 0, message: t('local.step3') + '...' }))
    const pull = await window.electronAPI.ollama.pullModel(selectedModel)
    if (!pull.success) {
      setState(prev => ({ ...prev, status: 'error', message: pull.error || t('local.modelPullFailed') }))
    }
  }

  if (state.status === 'complete') {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-emerald-400">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <span className="text-sm font-medium">{t('local.ready')}</span>
        </div>
        <p className="text-xs text-[var(--text-secondary)]">
          {selectedModel} {t('local.readyDesc')}
        </p>
      </div>
    )
  }

  const isBusy = state.status === 'downloading' || state.status === 'installing' || state.status === 'pulling'
  const stepInfo = getStepInfo(state.status, t)
  const modelSize = MODELS.find(m => m.id === selectedModel)?.size || ''

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-[var(--accent)]/20 flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--accent)]">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
        <span className="text-sm font-medium">{t('local.title')}</span>
      </div>

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
        </div>
      )}

      {!isBusy && (
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

      {state.status === 'ready' && !state.installed && (
        <button
          onClick={startSetup}
          className="w-full py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          {t('local.install')}
        </button>
      )}

      {state.status === 'ready' && state.installed && !state.running && (
        <div className="space-y-2">
          <p className="text-xs text-amber-400">
            {t('local.installedNotRunningHint')} <code className="px-1 py-0.5 rounded bg-[var(--bg-tertiary)]">ollama serve</code> {t('local.inTerminal')}
          </p>
          <button
            onClick={skipInstall}
            className="w-full py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            {t('local.pullOnly')}
          </button>
        </div>
      )}

      {state.status === 'error' && (
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

      {state.status === 'ready' && !state.installed && (
        <p className="text-xs text-[var(--text-secondary)]">
          {t('local.readyDesc')}
        </p>
      )}
    </div>
  )
}
