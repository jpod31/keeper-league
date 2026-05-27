/**
 * FilterBar — standardised filter row for list pages.
 *
 * Three slots:
 *   - search  → left  (typically an <input type="search">)
 *   - filters → middle (selects, multi-select chips, range pickers…)
 *   - actions → right (density toggle, sort dropdown, view switcher…)
 *
 * Active filters render as removable chips on a second row, with a
 * "Clear all" link. Pass them as data, not JSX, so the chip shape
 * stays consistent across pages.
 *
 * Sticky mode pins the bar to the top of the scroll container at the
 * given offset (defaults to 0). The page is responsible for providing
 * `position: relative` ancestry if it wants the stick to scope to it.
 *
 * Styles live as .fbar-* in static/style.css. Consumes --space-N tokens.
 */

import type { ReactNode } from 'react'

export interface ActiveFilter {
  key: string                  // unique id for React keys + remove targeting
  label: ReactNode             // displayed text (e.g. "POS: MID")
  onRemove: () => void
}

export interface FilterBarProps {
  search?: ReactNode
  filters?: ReactNode
  actions?: ReactNode
  activeFilters?: ActiveFilter[]
  onClearAll?: () => void
  sticky?: boolean
  stickyOffset?: number        // px from top; useful when there's a fixed app header
  className?: string
}

export function FilterBar({
  search,
  filters,
  actions,
  activeFilters,
  onClearAll,
  sticky,
  stickyOffset = 0,
  className,
}: FilterBarProps) {
  const hasActive = activeFilters && activeFilters.length > 0
  const stickyStyle = sticky ? { top: stickyOffset } : undefined

  return (
    <div
      className={[
        'fbar',
        sticky ? 'fbar-sticky' : '',
        className ?? '',
      ].filter(Boolean).join(' ')}
      style={stickyStyle}
    >
      <div className="fbar-row">
        {search && <div className="fbar-search">{search}</div>}
        {filters && <div className="fbar-filters">{filters}</div>}
        {actions && <div className="fbar-actions">{actions}</div>}
      </div>
      {hasActive && (
        <div className="fbar-active">
          {activeFilters!.map((f) => (
            <button
              key={f.key}
              type="button"
              className="kl-chip fbar-active-chip"
              onClick={f.onRemove}
              aria-label={`Remove filter ${typeof f.label === 'string' ? f.label : f.key}`}
            >
              {f.label}
              <span className="kl-chip-remove" aria-hidden>×</span>
            </button>
          ))}
          {onClearAll && (
            <button type="button" className="fbar-clear" onClick={onClearAll}>
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  )
}
