import * as React from 'react'

interface StatusBarProps {
  providerName: string
  modelName: string
  isConnected: boolean
  messageCount: number
}

export function StatusBar({ providerName, modelName, isConnected, messageCount }: StatusBarProps) {
  return (
    <div className="flex items-center justify-between px-4 py-1.5 border-t border-[var(--border)] bg-[var(--bg-secondary)] text-[10px] text-[var(--text-secondary)] shrink-0">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-red-400'}`} />
          <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
        </div>
        <span>{providerName} / {modelName}</span>
      </div>
      <div className="flex items-center gap-3">
        <span>{messageCount} messages</span>
      </div>
    </div>
  )
}
