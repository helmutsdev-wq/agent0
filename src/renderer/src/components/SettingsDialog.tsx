import * as React from 'react'
import { getConfigs, getProvider } from '../lib/providers'
import { getAgentConfig, setAgentConfig } from '../lib/agent'
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs'
import { Input, Label } from './ui/input'
import { Badge } from './ui/badge'
import { LocalModelSetup } from './LocalModelSetup'

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
  onRecheckProviders
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onRecheckProviders: () => void
}) {
  const [, forceUpdate] = React.useState(0)
  const [activeTab, setActiveTab] = React.useState('models')
  const [localApiKeys, setLocalApiKeys] = React.useState<Record<string, string>>(() => ({
    gemini: localStorage.getItem('gemini_api_key') || '',
    groq: localStorage.getItem('groq_api_key') || '',
    huggingface: localStorage.getItem('huggingface_api_key') || ''
  }))

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
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>Settings</DialogTitle>
        <DialogDescription>
          Configure AI providers, models, and API keys
        </DialogDescription>
      </DialogHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full">
          <TabsTrigger value="models" activeValue={activeTab} onClick={() => setActiveTab('models')}>
            Models
          </TabsTrigger>
          <TabsTrigger value="keys" activeValue={activeTab} onClick={() => setActiveTab('keys')}>
            API Keys
          </TabsTrigger>
          <TabsTrigger value="local" activeValue={activeTab} onClick={() => setActiveTab('local')}>
            Local Setup
          </TabsTrigger>
          <TabsTrigger value="about" activeValue={activeTab} onClick={() => setActiveTab('about')}>
            About
          </TabsTrigger>
        </TabsList>

        <TabsContent value="models" activeValue={activeTab}>
          {(() => {
            const agentConfig = getAgentConfig()
            const configs = getConfigs()
            return (
              <div className="space-y-4">
                <div>
                  <Label>Active Provider</Label>
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
                  <Label>Active Model</Label>
                  <select
                    value={agentConfig.model}
                    onChange={e => {
                      setAgentConfig({ model: e.target.value })
                      forceUpdate(n => n + 1)
                    }}
                    className="w-full mt-1 appearance-none rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                  >
                    {configs
                      .find(c => c.id === agentConfig.provider)
                      ?.models.map(m => (
                        <option key={m.id} value={m.id} disabled={!m.available}>
                          {m.name} {!m.available ? '(unavailable)' : ''}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="flex items-center justify-between rounded-lg bg-[var(--bg-tertiary)] px-3 py-2">
                  <div>
                    <Label className="cursor-pointer">Smart Routing</Label>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                      Auto-select best model for each task
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

                <div className="pt-2">
                  <Label>Available Providers</Label>
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
                              {modelsAvailable > 0 ? 'Ready' :
                               c.id === 'ollama' ? 'Disconnected' :
                               !c.hasApiKey ? 'No Key' : 'Error'}
                            </Badge>
                          </div>
                          <span className="text-xs text-[var(--text-secondary)]">
                            {modelsAvailable} models
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
                  Get key
                </a>
              </div>
              <Input
                type="password"
                placeholder="Paste your Gemini API key..."
                value={localApiKeys.gemini}
                onChange={e => saveApiKey('gemini', e.target.value)}
              />
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                Free tier: 60 requests per minute
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
                  Get key
                </a>
              </div>
              <Input
                type="password"
                placeholder="Paste your Groq API key..."
                value={localApiKeys.groq}
                onChange={e => saveApiKey('groq', e.target.value)}
              />
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                Free tier: rate limited, generous free credits
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>Hugging Face Token</Label>
                <a
                  href="https://huggingface.co/settings/tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[var(--accent)] hover:underline"
                >
                  Get token
                </a>
              </div>
              <Input
                type="password"
                placeholder="Paste your Hugging Face token..."
                value={localApiKeys.huggingface}
                onChange={e => saveApiKey('huggingface', e.target.value)}
              />
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                Free inference API, no credit card needed
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
              <strong className="text-[var(--text-primary)]">Agent0</strong> v0.1.0
            </p>
            <p>
              An AI agent desktop app that routes tasks to the best model across
              multiple providers.
            </p>
            <p>Free providers: Ollama (local), Gemini (Google), Groq, Hugging Face</p>
            <div className="mt-3 p-3 rounded-lg bg-[var(--bg-tertiary)] space-y-1.5">
              <p className="text-xs font-medium text-[var(--text-primary)]">Troubleshooting API Keys</p>
              <p className="text-xs">
                <strong>Gemini:</strong> If https://aistudio.google.com/apikey gives an error, try creating the key from Google Cloud Console instead:
                <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] ml-1 hover:underline">
                  cloud.google.com/apis/credentials
                </a>
              </p>
            </div>
            <p className="text-xs mt-2">
              Your API keys are stored locally and never sent anywhere except to the provider's API.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </Dialog>
  )
}
