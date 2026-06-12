import * as React from 'react'
import { cn } from '../../lib/utils'

export function Tabs({
  value,
  onValueChange,
  children,
  className
}: {
  value: string
  onValueChange: (v: string) => void
  children: React.ReactNode
  className?: string
}) {
  return <div className={cn('w-full', className)}>{children}</div>
}

export function TabsList({
  children,
  className
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex gap-1 rounded-lg bg-[var(--bg-tertiary)] p-1',
        className
      )}
    >
      {children}
    </div>
  )
}

export function TabsTrigger({
  value,
  activeValue,
  onClick,
  children
}: {
  value: string
  activeValue: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 text-sm rounded-md transition-colors',
        activeValue === value
          ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm'
          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
      )}
    >
      {children}
    </button>
  )
}

export function TabsContent({
  value,
  activeValue,
  children
}: {
  value: string
  activeValue: string
  children: React.ReactNode
}) {
  if (value !== activeValue) return null
  return <div className="mt-4">{children}</div>
}
