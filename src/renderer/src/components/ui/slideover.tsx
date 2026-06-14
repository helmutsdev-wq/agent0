import * as React from 'react'
import { cn } from '../../lib/utils'

export function SlideOver({
  open,
  onOpenChange,
  children,
  title
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
  title?: string
}) {
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false)
    }
    if (open) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onOpenChange])

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/50 transition-opacity duration-200',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={() => onOpenChange(false)}
      />
      <div
        className={cn(
          'fixed top-0 right-0 z-50 h-full w-[480px] bg-[var(--bg-secondary)] border-l border-[var(--border)] shadow-2xl transition-transform duration-200 ease-out',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] shrink-0">
            <h2 className="text-sm font-semibold">{title || 'Settings'}</h2>
            <button
              onClick={() => onOpenChange(false)}
              className="p-1 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {children}
          </div>
        </div>
      </div>
    </>
  )
}
