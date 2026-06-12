import * as React from 'react'
import { getConfigs } from '../lib/providers'
import { getAgentConfig, setAgentConfig } from '../lib/agent'
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs'
import { Input, Label } from './ui/input'
import { Badge } from './ui/badge'

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
  const configs = getConfigs()
  const agentConfig = getAgentConfig()
  const [activeTab, setActiveTab] = React.useState('models')
  const [localApiKeys, setLocalApiKeys] = React.useState<Record<string, string>>(() => ({
    gemini: localStorage.getItem('gemini_api_key') || '',
    groq: localStorage.getItem('groq_api_key') || ''
  }))

  function saveApiKey(provider: string, key: string) {
    localStorage.setItem(`${provider}_api_key`, key)
    setLocalApiKeys(prev => ({ ...prev, [provider]: key }))
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
          <TabsTrigger value="about" activeValue={activeTab} onClick={() => setActiveTab('about')}>
            About
          </TabsTrigger>
        </TabsList>

        <TabsContent value="models" activeValue={activeTab}>
          <div className="space-y-4">
            <div>
              <Label>Active Provider</Label>
              <select
                value={agentConfig.provider}
                onChange={e => {
                  setAgentConfig({ provider: e.target.value })
                  onRecheckProviders()
                }}
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
                onChange={e => setAgentConfig({ model: e.target.value })}
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

            <div className="pt-2">
              <Label>Available Providers</Label>
              <div className="mt-2 space-y-2">
                {configs.map(c => {
                  const info = PROVIDER_NAMES[c.id] || { label: c.apiKeyRequired ? 'Requires Key' : 'Ready', color: 'default', docsUrl: '' }
                  return (
                    <div
                      key={c.id}
                      className="flex items-center justify-between rounded-lg bg-[var(--bg-tertiary)] px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{c.name}</span>
                        <Badge variant={(info.color as 'success' | 'warning' | 'error' | 'default')}>
                          {info.label}
                        </Badge>
                      </div>
                      <span className="text-xs text-[var(--text-secondary)]">
                        {c.models.filter(m => m.available).length} models
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
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
          </div>
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
            <p>Free providers included: Ollama (local), Gemini (Google), Groq</p>
            <p className="text-xs mt-4">
              Your API keys are stored locally and never sent anywhere except to
              the provider's API.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </Dialog>
  )
}
