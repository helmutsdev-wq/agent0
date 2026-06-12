import * as React from 'react'
import { cn } from '../../lib/utils'

const DialogContext = React.createContext<{
  open: boolean
  onOpenChange: (open: boolean) => void
} | null>(null)

export function Dialog({
  open,
  onOpenChange,
  children
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}) {
  return (
    <DialogContext.Provider value={{ open, onOpenChange }}>
      {children}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/60"
            onClick={() => onOpenChange(false)}
          />
          <div className="relative z-50 w-full max-w-lg max-h-[85vh] overflow-auto rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-6 shadow-2xl">
            {children}
          </div>
        </div>
      )}
    </DialogContext.Provider>
  )
}

export function DialogHeader({ children }: { children: React.ReactNode }) {
  return <div className="mb-4">{children}</div>
}

export function DialogTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold text-[var(--text-primary)]">{children}</h2>
}

export function DialogDescription({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-sm text-[var(--text-secondary)]">{children}</p>
}
