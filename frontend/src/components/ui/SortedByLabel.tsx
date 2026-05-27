/**
 * SortedByLabel — tiny "Sorted by: SC avg ↓" label that sits next to
 * a list/table so the active sort is visible without inspecting headers.
 *
 * Pair with useListSort. Pass the column→label dictionary so
 * abbreviations ("sc_avg") render as their human names ("SC avg").
 */

import type { SortDirection } from '../../hooks/useListSort'

export interface SortedByLabelProps {
  column: string
  direction: SortDirection
  columnLabels?: Record<string, string>
  className?: string
}

export function SortedByLabel({ column, direction, columnLabels, className }: SortedByLabelProps) {
  const label = columnLabels?.[column] ?? column
  const arrow = direction === 'asc' ? '↑' : '↓'
  return (
    <span className={['sorted-by', className ?? ''].filter(Boolean).join(' ')}>
      Sorted by: <strong>{label}</strong> <span aria-hidden>{arrow}</span>
    </span>
  )
}
