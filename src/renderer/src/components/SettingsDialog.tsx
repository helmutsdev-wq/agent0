import * as React from 'react'
import { getConfigs, getProvider } from '../lib/providers'
import { getAgentConfig, setAgentConfig } from '../lib/agent'
import { SlideOver } from './ui/slideover'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs'
import { Input, Label } from './ui/input'
import { Badge } from './ui/badge'
import { LocalModelSetup } from './LocalModelSetup'
import { useLanguage, Lang } from '../lib/i18n'

const PROVIDER_NAMES: Record<string, { label: string; color: string; docsUrl: string }> = {
  ollama: {
    label: 'Local (Free)',
    color: 'success',
    docsUrl: 'https://ollama.ai/download'
  },
  gemini: {
    label: 'Free API Key',
    color: 'warning',
    docsUrl: 'https://aistudio.google.com/apikey'
  },
  groq: {
    label: 'Free API Key',
    color: 'warning',
    docsUrl: 'https://console.groq.com/keys'
  },
  huggingface: {
    label: 'Free Token',
    color: 'warning',
    docsUrl: 'https://huggingface.co/settings/tokens'
  }
}

export function SettingsDialog({
  open,
  onOpenChange,
  onRecheckProviders,
  onConfigChange
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onRecheckProviders: () => void
  onConfigChange?: () => void
}) {
  const { t, lang, setLang } = useLanguage()
  const [, forceUpdate] = React.useState(0)
  const [activeTab, setActiveTab] = React.useState('models')
  const [localApiKeys, setLocalApiKeys] = React.useState<Record<string, string>>(() => ({
    gemini: localStorage.getItem('gemini_api_key') || '',
    groq: localStorage.getItem('groq_api_key') || '',
    huggingface: localStorage.getItem('huggingface_api_key') || '',
    openrouter: localStorage.getItem('openrouter_api_key') || ''
  }))
  const [visibleKeys, setVisibleKeys] = React.useState<Record<string, boolean>>({})
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null)

  function copyKey(provider: string, value: string) {
    navigator.clipboard.writeText(value)
    setCopiedKey(provider)
    setTimeout(() => setCopiedKey(null), 1500)
  }

  function saveApiKey(provider: string, key: string) {
    localStorage.setItem(`${provider}_api_key`, key)
    setLocalApiKeys(prev => ({ ...prev, [provider]: key }))
    setTimeout(() => onRecheckProviders(), 100)
    forceUpdate(n => n + 1)
  }

  function handleProviderChange(providerId: string) {
    setAgentConfig({ provider: providerId })
    const p = getProvider(providerId)
    const firstAvailable = p?.models.find(m => m.available)
    if (firstAvailable) {
      setAgentConfig({ model: firstAvailable.id })
    }
    onRecheckProviders()
    forceUpdate(n => n + 1)
    onConfigChange?.()
  }

  const LANGUAGES: { value: Lang; label: string }[] = [
    { value: 'en', label: 'English' },
    { value: 'lv', label: 'Latviešu' }
  ]

  return (
    <SlideOver open={open} onOpenChange={onOpenChange} title={t('settings.title')}>
      <p className="text-xs text-[var(--text-secondary)] mb-4">
        {t('settings.desc')}
      </p>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full">
          <TabsTrigger value="models" activeValue={activeTab} onClick={() => setActiveTab('models')}>
            {t('settings.tab.models')}
          </TabsTrigger>
          <TabsTrigger value="keys" activeValue={activeTab} onClick={() => setActiveTab('keys')}>
            {t('settings.tab.keys')}
          </TabsTrigger>
          <TabsTrigger value="local" activeValue={activeTab} onClick={() => setActiveTab('local')}>
            {t('settings.tab.local')}
          </TabsTrigger>
          <TabsTrigger value="about" activeValue={activeTab} onClick={() => setActiveTab('about')}>
            {t('settings.tab.about')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="models" activeValue={activeTab}>
          {(() => {
            const agentConfig = getAgentConfig()
            const configs = getConfigs()
            return (
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg bg-[var(--bg-tertiary)] px-3 py-2">
                  <div>
                    <Label className="cursor-pointer">{t('settings.smartRouting')}</Label>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                      {t('settings.smartRoutingDesc')}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const cfg = getAgentConfig()
                      setAgentConfig({ useRouter: !cfg.useRouter })
                      forceUpdate(n => n + 1)
                    }}
                    className={`relative w-10 h-5 rounded-full transition-colors ${
                      agentConfig.useRouter ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                        agentConfig.useRouter ? 'translate-x-5' : ''
                      }`}
                    />
                  </button>
                </div>

                {!agentConfig.useRouter && (
                  <>
                    <div>
                      <Label>{t('settings.activeProvider')}</Label>
                      <select
                        value={agentConfig.provider}
                        onChange={e => handleProviderChange(e.target.value)}
                        className="w-full mt-1 appearance-none rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                      >
                        {configs.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <Label>{t('settings.activeModel')}</Label>
                      <select
                        value={agentConfig.model}
                        onChange={e => {
                          setAgentConfig({ model: e.target.value })
                          forceUpdate(n => n + 1)
                          onConfigChange?.()
                        }}
                        className="w-full mt-1 appearance-none rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                      >
                        {configs
                          .find(c => c.id === agentConfig.provider)
                          ?.models.map(m => (
                            <option key={m.id} value={m.id} disabled={!m.available}>
                              {m.name} {!m.available ? t('settings.unavailable') : ''}
                            </option>
                          ))}
                      </select>
                    </div>
                  </>
                )}

                {!agentConfig.useRouter && (
                  <div className="flex items-center justify-between rounded-lg bg-[var(--bg-tertiary)] px-3 py-2">
                    <div>
                      <Label className="cursor-pointer">{t('settings.autoFallback')}</Label>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                        {t('settings.autoFallbackDesc')}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        const cfg = getAgentConfig()
                        setAgentConfig({ autoFallback: !cfg.autoFallback })
                        forceUpdate(n => n + 1)
                      }}
                      className={`relative w-10 h-5 rounded-full transition-colors ${
                        agentConfig.autoFallback ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                          agentConfig.autoFallback ? 'translate-x-5' : ''
                        }`}
                      />
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-between rounded-lg bg-[var(--bg-tertiary)] px-3 py-2">
                  <div>
                    <Label className="cursor-pointer">{t('settings.language')}</Label>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                      {LANGUAGES.find(l => l.value === lang)?.label}
                    </p>
                  </div>
                  <select
                    value={lang}
                    onChange={e => setLang(e.target.value as Lang)}
                    className="appearance-none rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] px-2 py-1 text-xs text-[var(--text-primary)] outline-none"
                  >
                    {LANGUAGES.map(l => (
                      <option key={l.value} value={l.value}>{l.label}</option>
                    ))}
                  </select>
                </div>

                <div className="rounded-lg bg-[var(--bg-tertiary)] px-3 py-2">
                  <Label className="mb-1 block">{t('settings.workspaceRoot')}</Label>
                  <p className="text-xs text-[var(--text-secondary)] mb-2">
                    {t('settings.workspaceRootDesc')}
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={agentConfig.workspaceRoot}
                      onChange={e => {
                        setAgentConfig({ workspaceRoot: e.target.value })
                        window.electronAPI.workspace.setRoot(e.target.value)
                        forceUpdate(n => n + 1)
                      }}
                      placeholder="C:\Users\..."
                      className="flex-1 rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                    />
                    {agentConfig.workspaceRoot && (
                      <button
                        onClick={() => {
                          setAgentConfig({ workspaceRoot: '' })
                          window.electronAPI.workspace.setRoot('')
                          forceUpdate(n => n + 1)
                        }}
                        className="text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors shrink-0"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                <div className="pt-2">
                  <Label>{t('settings.availableProviders')}</Label>
                  <div className="mt-2 space-y-2">
                    {configs.map(c => {
                      const modelsAvailable = c.models.filter(m => m.available).length
                      const info = PROVIDER_NAMES[c.id] || { label: c.apiKeyRequired ? 'Requires Key' : 'Ready', color: 'default', docsUrl: '' }
                      return (
                        <div
                          key={c.id}
                          className="flex items-center justify-between rounded-lg bg-[var(--bg-tertiary)] px-3 py-2"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{c.name}</span>
                            <Badge variant={
                              modelsAvailable > 0 ? 'success' :
                              c.id === 'ollama' ? 'error' :
                              !c.hasApiKey ? 'warning' : 'error'
                            }>
                              {modelsAvailable > 0 ? t('settings.ready') :
                               c.id === 'ollama' ? t('settings.disconnected') :
                               !c.hasApiKey ? t('settings.noKey') : t('settings.error')}
                            </Badge>
                          </div>
                          <span className="text-xs text-[var(--text-secondary)]">
                            {modelsAvailable} {t('settings.modelsCount')}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })()}
        </TabsContent>

        <TabsContent value="keys" activeValue={activeTab}>
          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>Gemini API Key</Label>
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[var(--accent)] hover:underline"
                >
                  {t('settings.getKey')}
                </a>
              </div>
              <div className="flex items-center gap-1">
                <Input
                  type={visibleKeys['gemini'] ? 'text' : 'password'}
                  placeholder={t('settings.geminiPlaceholder')}
                  value={localApiKeys.gemini}
                  onChange={e => saveApiKey('gemini', e.target.value)}
                  className="flex-1"
                />
                <button
                  onClick={() => setVisibleKeys(prev => ({ ...prev, gemini: !prev['gemini'] }))}
                  className="shrink-0 p-2 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                  title={visibleKeys['gemini'] ? 'Hide' : 'Show'}
                >
                  {visibleKeys['gemini'] ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => copyKey('gemini', localApiKeys.gemini)}
                  className={`shrink-0 p-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors ${copiedKey === 'gemini' ? 'text-emerald-400' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                  title="Copy"
                >
                  {copiedKey === 'gemini' ? (
                    <span className="text-[10px] font-medium">Copied!</span>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  )}
                </button>
              </div>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                {t('settings.geminiRate')}
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>Groq API Key</Label>
                <a
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[var(--accent)] hover:underline"
                >
                  {t('settings.getKey')}
                </a>
              </div>
              <div className="flex items-center gap-1">
                <Input
                  type={visibleKeys['groq'] ? 'text' : 'password'}
                  placeholder={t('settings.groqPlaceholder')}
                  value={localApiKeys.groq}
                  onChange={e => saveApiKey('groq', e.target.value)}
                  className="flex-1"
                />
                <button
                  onClick={() => setVisibleKeys(prev => ({ ...prev, groq: !prev['groq'] }))}
                  className="shrink-0 p-2 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                  title={visibleKeys['groq'] ? 'Hide' : 'Show'}
                >
                  {visibleKeys['groq'] ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => copyKey('groq', localApiKeys.groq)}
                  className={`shrink-0 p-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors ${copiedKey === 'groq' ? 'text-emerald-400' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                  title="Copy"
                >
                  {copiedKey === 'groq' ? (
                    <span className="text-[10px] font-medium">Copied!</span>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  )}
                </button>
              </div>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                {t('settings.groqRate')}
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>{t('provider.huggingface')} Token</Label>
                <a
                  href="https://huggingface.co/settings/tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[var(--accent)] hover:underline"
                >
                  {t('settings.getToken')}
                </a>
              </div>
              <div className="flex items-center gap-1">
                <Input
                  type={visibleKeys['huggingface'] ? 'text' : 'password'}
                  placeholder={t('settings.hfPlaceholder')}
                  value={localApiKeys.huggingface}
                  onChange={e => saveApiKey('huggingface', e.target.value)}
                  className="flex-1"
                />
                <button
                  onClick={() => setVisibleKeys(prev => ({ ...prev, huggingface: !prev['huggingface'] }))}
                  className="shrink-0 p-2 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                  title={visibleKeys['huggingface'] ? 'Hide' : 'Show'}
                >
                  {visibleKeys['huggingface'] ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => copyKey('huggingface', localApiKeys.huggingface)}
                  className={`shrink-0 p-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors ${copiedKey === 'huggingface' ? 'text-emerald-400' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                  title="Copy"
                >
                  {copiedKey === 'huggingface' ? (
                    <span className="text-[10px] font-medium">Copied!</span>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  )}
                </button>
              </div>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                {t('settings.hfRate')}
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>OpenRouter API Key</Label>
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[var(--accent)] hover:underline"
                >
                  {t('settings.getKey')}
                </a>
              </div>
              <div className="flex items-center gap-1">
                <Input
                  type={visibleKeys['openrouter'] ? 'text' : 'password'}
                  placeholder="Paste your OpenRouter API key..."
                  value={localApiKeys.openrouter}
                  onChange={e => saveApiKey('openrouter', e.target.value)}
                  className="flex-1"
                />
                <button
                  onClick={() => setVisibleKeys(prev => ({ ...prev, openrouter: !prev['openrouter'] }))}
                  className="shrink-0 p-2 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                  title={visibleKeys['openrouter'] ? 'Hide' : 'Show'}
                >
                  {visibleKeys['openrouter'] ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => copyKey('openrouter', localApiKeys.openrouter)}
                  className={`shrink-0 p-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors ${copiedKey === 'openrouter' ? 'text-emerald-400' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                  title="Copy"
                >
                  {copiedKey === 'openrouter' ? (
                    <span className="text-[10px] font-medium">Copied!</span>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  )}
                </button>
              </div>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                Free tier available. 200+ models via one API.
              </p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="local" activeValue={activeTab}>
          <LocalModelSetup onComplete={() => forceUpdate(n => n + 1)} />
        </TabsContent>

        <TabsContent value="about" activeValue={activeTab}>
          <div className="space-y-3 text-sm text-[var(--text-secondary)]">
            <p>
              <strong className="text-[var(--text-primary)]">{t('settings.about.version')}</strong>
            </p>
            <p>{t('settings.about.desc')}</p>
            <p>{t('settings.about.providers')}</p>
            <div className="mt-3 p-3 rounded-lg bg-[var(--bg-tertiary)] space-y-1.5">
              <p className="text-xs font-medium text-[var(--text-primary)]">{t('settings.about.troubleshooting')}</p>
              <p className="text-xs">
                <strong>Gemini:</strong> {t('settings.about.geminiHelp')}
                <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] ml-1 hover:underline">
                  cloud.google.com/apis/credentials
                </a>
              </p>
            </div>
            <p className="text-xs mt-2">{t('settings.about.privacy')}</p>
          </div>
        </TabsContent>
      </Tabs>
    </SlideOver>
  )
}
