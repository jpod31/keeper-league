/**
 * ByePlanner — pill that opens a round-chip popover. Selecting a round
 * drives a "bye preview" on the field: players on bye that round get a
 * partial grey-out on their cards (handled by FieldView via byeIds).
 *
 * Lazy-fetches /api/leagues/<id>/team/<id>/byes on first open. The
 * round chips are colour-coded by how many of YOUR players are out:
 *   0 → muted · 1-2 → neutral · 3-4 → ochre · 5+ → rust.
 *
 * Selecting the active round again (or "Clear") exits preview mode.
 *
 * Styles live as .byeplan-* in static/style.css. Consumes --space-N tokens.
 */

import { useEffect, useRef, useState } from 'react'

interface PlayerOut {
  id: number
  name: string
  afl_team: string
  position: string
}

interface ByeRound {
  round: number
  players_out: PlayerOut[]
  total_out: number
}

interface ByesResponse {
  current_round: number
  lookahead: number
  rounds: ByeRound[]
}

export interface ByePlannerProps {
  leagueId: string | number
  teamId: string | number
  previewRound: number | null
  onPreviewRound: (round: number | null, playerIds: number[]) => void
}

function toneClass(n: number): string {
  if (n === 0) return 'byechip-good'
  if (n <= 2) return 'byechip-neutral'
  if (n <= 4) return 'byechip-warn'
  return 'byechip-alarm'
}

export function ByePlanner({ leagueId, teamId, previewRound, onPreviewRound }: ByePlannerProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<ByesResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const rootRef = useRef<HTMLSpanElement>(null)

  // Lazy fetch on first open.
  useEffect(() => {
    if (!open || data || loading) return
    setLoading(true)
    setError(null)
    fetch(`/api/leagues/${leagueId}/team/${teamId}/byes?lookahead=14`, { credentials: 'include' })
      .then(r => r.json())
      .then((d: ByesResponse) => setData(d))
      .catch(() => setError('Failed to load byes'))
      .finally(() => setLoading(false))
  }, [open, data, loading, leagueId, teamId])

  // Close popover on outside click / Escape.
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

  // Only rounds where at least one of your players is out are worth showing.
  const byeRounds = (data?.rounds ?? []).filter(r => r.total_out > 0)

  function pick(r: ByeRound) {
    if (previewRound === r.round) {
      onPreviewRound(null, [])  // toggle off
    } else {
      onPreviewRound(r.round, r.players_out.map(p => p.id))
    }
    setOpen(false)
  }

  function clearPreview() {
    onPreviewRound(null, [])
    setOpen(false)
  }

  const active = previewRound != null

  return (
    <span ref={rootRef} className={`byeplan${open ? ' open' : ''}`}>
      <button
        type="button"
        className={`byeplan-toggle${active ? ' previewing' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className="byeplan-toggle-icon" aria-hidden>
          <i className="bi bi-calendar-x"></i>
        </span>
        <span className="byeplan-toggle-text">
          <span className="byeplan-toggle-label">Bye planner</span>
          <span className="byeplan-toggle-sub">{active ? `Previewing R${previewRound}` : 'Preview a bye round'}</span>
        </span>
        <i className="bi bi-chevron-down byeplan-toggle-chev" aria-hidden></i>
      </button>

      {open && (
        <div className="byeplan-pop" role="dialog" aria-label="Bye planner">
          {loading && <div className="byeplan-loading">Loading byes…</div>}
          {error && <div className="byeplan-error">{error}</div>}
          {data && byeRounds.length === 0 && (
            <div className="byeplan-empty">No bye rounds with players out in the next stretch.</div>
          )}
          {byeRounds.length > 0 && (
            <>
              <div className="byeplan-pop-head">Tap a round to preview who's out</div>
              <div className="byeplan-chips">
                {byeRounds.map(r => (
                  <button
                    key={r.round}
                    type="button"
                    className={`byechip ${toneClass(r.total_out)}${previewRound === r.round ? ' active' : ''}`}
                    onClick={() => pick(r)}
                    title={`${r.total_out} player${r.total_out === 1 ? '' : 's'} out in R${r.round}`}
                  >
                    <span className="byechip-round">R{r.round}</span>
                    <span className="byechip-count">{r.total_out} out</span>
                  </button>
                ))}
              </div>
              {active && (
                <button type="button" className="byeplan-clear" onClick={clearPreview}>
                  <i className="bi bi-x-circle"></i> Clear preview
                </button>
              )}
            </>
          )}
        </div>
      )}
    </span>
  )
}
