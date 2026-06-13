import { ChatSession } from '../lib/sessionStore'
import { useLanguage } from '../lib/i18n'

interface SessionSidebarProps {
  sessions: ChatSession[]
  activeSessionId: string
  onCreate: () => void
  onSwitch: (id: string) => void
  onDelete: (id: string) => void
}

function formatTime(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60000) return 'now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`
  return `${Math.floor(diff / 86400000)}d`
}

export function SessionSidebar({ sessions, activeSessionId, onCreate, onSwitch, onDelete }: SessionSidebarProps) {
  const { t } = useLanguage()

  return (
    <div className="flex flex-col h-full w-56 border-r border-[var(--border)] bg-[var(--bg-secondary)] shrink-0">
      <div className="flex items-center justify-between px-3 py-3 border-b border-[var(--border)]">
        <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
          {t('session.chats')}
        </span>
        <button
          onClick={onCreate}
          className="w-6 h-6 rounded-md hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors"
          title={t('session.new')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {sessions.length === 0 && (
          <div className="px-3 py-8">
            <button
              onClick={onCreate}
              className="w-full py-2 rounded-lg border border-dashed border-[var(--border)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)]/40 transition-colors"
            >
              {t('session.new')}
            </button>
          </div>
        )}
        {sessions.map(session => (
          <SessionItem
            key={session.id}
            session={session}
            isActive={session.id === activeSessionId}
            canDelete={sessions.length > 1}
            onSelect={() => onSwitch(session.id)}
            onDelete={() => onDelete(session.id)}
          />
        ))}
      </div>
    </div>
  )
}

function SessionItem({ session, isActive, canDelete, onSelect, onDelete }: {
  session: ChatSession
  isActive: boolean
  canDelete: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  const msgCount = session.messages.filter(m => m.role === 'user').length

  return (
    <div
      onClick={onSelect}
      className={`group relative mx-1.5 my-0.5 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${
        isActive
          ? 'bg-[var(--accent)]/10 text-[var(--text-primary)]'
          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
      }`}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium truncate">{session.title}</p>
          <p className="text-[10px] text-[var(--text-secondary)] opacity-60 mt-0.5">
            {msgCount > 0 && <>{msgCount} msg · </>}{formatTime(session.updatedAt)}
          </p>
        </div>
        {canDelete && (
          <button
            onClick={e => { e.stopPropagation(); onDelete() }}
            className="shrink-0 w-5 h-5 rounded hover:bg-[var(--bg-secondary)] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[var(--text-secondary)] hover:text-red-400"
            title="Delete"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
