/**
 * RoundPicker — pill button + chip-grid popover for jumping between
 * the live squad view and a historical round snapshot.
 *
 * Replaces the legacy <select> dropdown that read as 2002. Click the
 * pill → grid of round chips appears below; tap a chip to view that
 * round, tap "Live" to return to the current squad.
 *
 * Visually matches the matchup / bye-planner kl-status-pill chips so
 * the squad page's context row reads as one family.
 *
 * Styles live as .rpick-* in static/style.css. Consumes --space-N tokens.
 */

import { useEffect, useRef, useState } from 'react'

export interface RoundPickerProps {
  currentRound: number
  selected: number | null      // null = live, number = historical archive round
  onSelect: (round: number | null) => void
}

export function RoundPicker({ currentRound, selected, onSelect }: RoundPickerProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Build round chip range. Show every past round; cap at 18 chips for
  // sanity (most leagues only browse the last ~10 anyway).
  const maxBack = Math.min(currentRound - 1, 18)
  const pastRounds = Array.from({ length: maxBack }, (_, i) => currentRound - 1 - i)

  const isLive = selected == null
  const label = isLive ? 'Live' : `R${selected}`

  function pick(r: number | null) {
    onSelect(r)
    setOpen(false)
  }

  return (
    <span ref={rootRef} className={`rpick${open ? ' open' : ''}`}>
      <button
        type="button"
        className="rpick-btn"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <span className="rpick-icon" aria-hidden>
          <i className="bi bi-clock-history"></i>
        </span>
        <span className="rpick-text">
          <span className="rpick-title">{label}</span>
          <span className="rpick-sub">{isLive ? 'Current squad' : 'Archive snapshot'}</span>
        </span>
        <i className="bi bi-chevron-down rpick-chev" aria-hidden></i>
      </button>

      {open && (
        <div className="rpick-pop" role="listbox" aria-label="Round selector">
          <button
            type="button"
            className={`rpick-chip rpick-chip-live${isLive ? ' active' : ''}`}
            onClick={() => pick(null)}
            role="option"
            aria-selected={isLive}
          >
            <i className="bi bi-broadcast"></i> Live
          </button>
          <div className="rpick-grid">
            {pastRounds.map(r => (
              <button
                key={r}
                type="button"
                className={`rpick-chip${selected === r ? ' active' : ''}`}
                onClick={() => pick(r)}
                role="option"
                aria-selected={selected === r}
              >
                R{r}
              </button>
            ))}
          </div>
        </div>
      )}
    </span>
  )
}
