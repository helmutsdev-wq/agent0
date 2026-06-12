import * as React from 'react'
import { cn } from '../../lib/utils'

export function Select({
  value,
  onValueChange,
  children,
  placeholder
}: {
  value: string
  onValueChange: (v: string) => void
  children: React.ReactNode
  placeholder?: string
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onValueChange(e.target.value)}
        className={cn(
          'w-full appearance-none rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] px-3 py-2 pr-8 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent)]'
        )}
      >
        {placeholder && !value && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {children}
      </select>
      <svg
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-secondary)]"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  )
}

export function SelectItem({
  value,
  children
}: {
  value: string
  children: React.ReactNode
}) {
  return <option value={value}>{children}</option>
}
