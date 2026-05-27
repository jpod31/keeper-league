/**
 * ByePlanner — collapsible round-by-round bye view above the squad.
 *
 * Lazy-fetches /api/leagues/<id>/team/<id>/byes when first expanded so
 * pages that never open it pay nothing. Each round chip shows how many
 * players are out; click to expand the list (grouped by position).
 *
 * Tone heat by total_out:
 *   0      → soft good
 *   1-2    → neutral
 *   3-4    → ochre warn
 *   5+     → rust alarm
 *
 * Styles live as .byeplan-* in static/style.css. Consumes --space-N tokens.
 */

import { useState } from 'react'

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
}

function toneClass(n: number): string {
  if (n === 0) return 'byeplan-cell-good'
  if (n <= 2) return 'byeplan-cell-neutral'
  if (n <= 4) return 'byeplan-cell-warn'
  return 'byeplan-cell-alarm'
}

export function ByePlanner({ leagueId, teamId }: ByePlannerProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<ByesResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expandedRound, setExpandedRound] = useState<number | null>(null)

  function toggle() {
    const next = !open
    setOpen(next)
    if (next && !data && !loading) {
      // Lazy fetch on first open.
      setLoading(true)
      setError(null)
      fetch(`/api/leagues/${leagueId}/team/${teamId}/byes?lookahead=10`, { credentials: 'include' })
        .then(r => r.json())
        .then((d: ByesResponse) => setData(d))
        .catch(() => setError('Failed to load byes'))
        .finally(() => setLoading(false))
    }
  }

  return (
    <section className={`byeplan${open ? ' open' : ''}`}>
      <button
        type="button"
        className="byeplan-toggle"
        onClick={toggle}
        aria-expanded={open}
      >
        <i className={`bi ${open ? 'bi-chevron-down' : 'bi-chevron-right'}`} aria-hidden></i>
        <span className="byeplan-toggle-label">Bye planner</span>
        <span className="byeplan-toggle-sub">Next 10 rounds</span>
      </button>

      {open && (
        <div className="byeplan-body">
          {loading && <div className="byeplan-loading">Loading byes…</div>}
          {error && <div className="byeplan-error">{error}</div>}
          {data && data.rounds.length === 0 && (
            <div className="byeplan-empty">No upcoming round data yet.</div>
          )}
          {data && data.rounds.length > 0 && (
            <div className="byeplan-grid">
              {data.rounds.map(r => {
                const isExpanded = expandedRound === r.round
                return (
                  <button
                    key={r.round}
                    type="button"
                    className={`byeplan-cell ${toneClass(r.total_out)}${isExpanded ? ' expanded' : ''}`}
                    onClick={() => setExpandedRound(isExpanded ? null : r.round)}
                    aria-expanded={isExpanded}
                    title={`Round ${r.round} — ${r.total_out} player${r.total_out === 1 ? '' : 's'} out`}
                  >
                    <span className="byeplan-cell-round">R{r.round}</span>
                    <span className="byeplan-cell-count">{r.total_out}</span>
                  </button>
                )
              })}
            </div>
          )}
          {data && expandedRound != null && (() => {
            const round = data.rounds.find(r => r.round === expandedRound)
            if (!round) return null
            if (round.players_out.length === 0) {
              return <div className="byeplan-detail">Round {round.round}: nobody on bye. Full squad available.</div>
            }
            return (
              <div className="byeplan-detail">
                <div className="byeplan-detail-head">
                  Round {round.round} — {round.total_out} player{round.total_out === 1 ? '' : 's'} on bye
                </div>
                <ul className="byeplan-detail-list">
                  {round.players_out.map(p => (
                    <li key={p.id}>
                      <span className={`pos-badge pos-${p.position}`} style={{ fontSize: '.6rem', padding: '1px 5px' }}>{p.position}</span>
                      <span className="byeplan-detail-name">{p.name}</span>
                      <span className="byeplan-detail-team">{p.afl_team}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })()}
        </div>
      )}
    </section>
  )
}
