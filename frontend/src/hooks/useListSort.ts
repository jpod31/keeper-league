/**
 * useListSort — opinionated default + persistence for list-page sorts.
 *
 * Per the project's UX direction:
 *   - Each list page has an explicit default sort (e.g. Squad → sc_avg desc).
 *   - Last-applied sort persists per page per user in localStorage.
 *   - First click on any sortable column sorts highest first (descending).
 *     See feedback_sort_descending.md.
 *
 * Pair with <SortedByLabel> to surface the active sort to the user.
 *
 * Usage:
 *   const sort = useListSort({
 *     storageKey: 'squad.sort',
 *     defaultColumn: 'sc_avg',
 *     defaultDirection: 'desc',
 *   })
 *
 *   // In a column header onClick:
 *   <th onClick={() => sort.toggle('name')}>Name</th>
 *
 *   // Render the active label somewhere near the list:
 *   <SortedByLabel column={sort.column} direction={sort.direction} columnLabels={...} />
 *
 *   // Apply the sort:
 *   const rows = useMemo(() => [...players].sort(sort.compare(getValueFor)), [players, sort.column, sort.direction])
 */

import { useCallback, useEffect, useState } from 'react'

export type SortDirection = 'asc' | 'desc'

export interface SortState {
  column: string
  direction: SortDirection
}

export interface UseListSortOptions {
  storageKey: string                // localStorage key, e.g. "squad.sort"
  defaultColumn: string
  defaultDirection?: SortDirection  // default: 'desc' (per project rule)
  /** Columns whose default direction on first-click should be ascending (e.g. name, ladder rank). */
  ascByDefaultColumns?: string[]
}

export interface UseListSortReturn extends SortState {
  /** Toggle the sort. If switching to a new column, uses the column's default direction. */
  toggle: (column: string) => void
  /** Explicitly set the sort. */
  set: (column: string, direction: SortDirection) => void
  /** Reset to the configured defaults. */
  reset: () => void
  /**
   * Returns a comparator suitable for Array.prototype.sort.
   * Pass a function that extracts the value for the current sort column from a row.
   */
  compare: <T>(getValue: (row: T, column: string) => number | string | null | undefined) => (a: T, b: T) => number
}

function readStored(key: string): SortState | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<SortState>
    if (typeof parsed?.column === 'string' && (parsed.direction === 'asc' || parsed.direction === 'desc')) {
      return { column: parsed.column, direction: parsed.direction }
    }
  } catch {
    // Corrupt entry — fall through to defaults.
  }
  return null
}

function writeStored(key: string, state: SortState) {
  try {
    localStorage.setItem(key, JSON.stringify(state))
  } catch {
    // Quota / private mode — silently ignore; sort still works in-session.
  }
}

export function useListSort({
  storageKey,
  defaultColumn,
  defaultDirection = 'desc',
  ascByDefaultColumns,
}: UseListSortOptions): UseListSortReturn {
  const [state, setState] = useState<SortState>(() => {
    return readStored(storageKey) ?? { column: defaultColumn, direction: defaultDirection }
  })

  useEffect(() => {
    writeStored(storageKey, state)
  }, [storageKey, state])

  const initialDirFor = useCallback((column: string): SortDirection => {
    return ascByDefaultColumns?.includes(column) ? 'asc' : 'desc'
  }, [ascByDefaultColumns])

  const toggle = useCallback((column: string) => {
    setState(prev => {
      if (prev.column !== column) {
        return { column, direction: initialDirFor(column) }
      }
      return { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
    })
  }, [initialDirFor])

  const set = useCallback((column: string, direction: SortDirection) => {
    setState({ column, direction })
  }, [])

  const reset = useCallback(() => {
    setState({ column: defaultColumn, direction: defaultDirection })
  }, [defaultColumn, defaultDirection])

  const compare = useCallback(<T,>(getValue: (row: T, column: string) => number | string | null | undefined) => {
    const { column, direction } = state
    const sign = direction === 'asc' ? 1 : -1
    return (a: T, b: T) => {
      const av = getValue(a, column)
      const bv = getValue(b, column)
      // Nulls/undefined always sort to the bottom regardless of direction.
      const aNull = av === null || av === undefined
      const bNull = bv === null || bv === undefined
      if (aNull && bNull) return 0
      if (aNull) return 1
      if (bNull) return -1
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * sign
      return String(av).localeCompare(String(bv)) * sign
    }
  }, [state])

  return { ...state, toggle, set, reset, compare }
}
