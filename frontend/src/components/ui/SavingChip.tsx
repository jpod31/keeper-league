/**
 * SavingChip — tiny inline status indicator for optimistic mutations.
 *
 * Pairs with useOptimisticMutation. Renders "Saving…" while a request
 * is in flight, a check mark on success, an exclamation on error.
 * Returns null when status is 'idle' so it disappears between actions.
 *
 * Styles live as .schip-* in static/style.css.
 */

import type { SaveStatus } from '../../hooks/useOptimisticMutation'

export interface SavingChipProps {
  status: SaveStatus
  /** Override the default label per state. Useful for accessibility. */
  labels?: Partial<Record<SaveStatus, string>>
  className?: string
}

const DEFAULT_LABELS: Record<SaveStatus, string> = {
  idle: '',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Save failed',
}

export function SavingChip({ status, labels, className }: SavingChipProps) {
  if (status === 'idle') return null
  const label = labels?.[status] ?? DEFAULT_LABELS[status]
  const icon = status === 'saving' ? '•' : status === 'saved' ? '✓' : '!'
  return (
    <span
      className={['schip', `schip-${status}`, className ?? ''].filter(Boolean).join(' ')}
      role="status"
      aria-live="polite"
    >
      <span className="schip-icon" aria-hidden>{icon}</span>
      <span className="schip-label">{label}</span>
    </span>
  )
}
