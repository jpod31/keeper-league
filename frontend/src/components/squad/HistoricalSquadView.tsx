/**
 * HistoricalSquadView — read-only render of a past round's lineup.
 *
 * Fetches /api/leagues/<id>/team/<id>/lineup/<round> on mount and
 * lays out the players grouped by position with captain / VC /
 * emergency badges. Designed as a tight, simple view distinct from
 * the live FieldView — no actions, no swap mode, no lockout context.
 *
 * Powers #21: historical squad snapshots. Use the round picker on
 * SquadPage to swap in this view for any past round.
 *
 * Styles live as .hsv-* in static/style.css. Consumes --space-N tokens.
 */

import { useEffect, useState } from 'react'

interface HistPlayer {
  id: number
  name: string
  position: string
  afl_team: string
  sc_avg: number
  is_captain: boolean
  is_vc: boolean
  is_emergency: number
  playing: boolean
  bench: boolean
  injury: string | null
}

interface HistData {
  team: { id: number; name: string }
  round: number
  max_round: number
  players: HistPlayer[]
  locked: boolean
}

export interface HistoricalSquadViewProps {
  leagueId: string | number
  teamId: string | number
  round: number
}

const POS_ORDER = ['DEF', 'MID', 'RUC', 'FWD'] as const

function posPrimary(pos: string): string {
  return (pos || 'MID').split('/')[0].toUpperCase()
}

export function HistoricalSquadView({ leagueId, teamId, round }: HistoricalSquadViewProps) {
  const [data, setData] = useState<HistData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    let cancelled = false
    fetch(`/api/leagues/${leagueId}/team/${teamId}/lineup/${round}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (cancelled) return
        if (d.error) setError(d.error)
        else setData(d)
      })
      .catch(() => { if (!cancelled) setError('Failed to load lineup') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [leagueId, teamId, round])

  if (loading) return <div className="hsv-loading">Loading round {round}…</div>
  if (error) return <div className="hsv-error">{error}</div>
  if (!data) return null

  // Group players by position bucket. Bench / emergencies render in a
  // separate row at the bottom.
  const onField: Record<string, HistPlayer[]> = { DEF: [], MID: [], RUC: [], FWD: [] }
  const bench: HistPlayer[] = []
  for (const p of data.players) {
    if (p.bench) {
      bench.push(p)
      continue
    }
    const bucket = posPrimary(p.position)
    if (onField[bucket]) onField[bucket].push(p)
    else onField.MID.push(p)
  }

  return (
    <div className="hsv">
      <div className="hsv-banner">
        <i className="bi bi-clock-history"></i>
        Viewing R{data.round} archive — read-only
      </div>

      {POS_ORDER.map(pos => {
        const players = onField[pos]
        if (players.length === 0) return null
        return (
          <section key={pos} className="hsv-zone">
            <div className={`hsv-zone-head pos-${pos}`}>{pos}</div>
            <ul className="hsv-list">
              {players.map(p => (
                <li key={p.id} className="hsv-row">
                  <span className="hsv-name">{p.name}</span>
                  <span className="hsv-badges">
                    {p.is_captain && <span className="hsv-badge hsv-badge-c" title="Captain">C</span>}
                    {p.is_vc && <span className="hsv-badge hsv-badge-vc" title="Vice-captain">VC</span>}
                    {p.is_emergency > 0 && <span className="hsv-badge hsv-badge-e" title="Emergency">E</span>}
                    {p.injury && <span className="hsv-badge hsv-badge-inj" title={p.injury}><i className="bi bi-bandaid-fill"></i></span>}
                  </span>
                  <span className="hsv-team">{p.afl_team}</span>
                  <span className="hsv-sc">{p.sc_avg ? Math.round(p.sc_avg) : '—'}</span>
                </li>
              ))}
            </ul>
          </section>
        )
      })}

      {bench.length > 0 && (
        <section className="hsv-zone hsv-zone-bench">
          <div className="hsv-zone-head">Bench</div>
          <ul className="hsv-list">
            {bench.map(p => (
              <li key={p.id} className="hsv-row hsv-row-bench">
                <span className={`pos-badge pos-${posPrimary(p.position)}`} style={{ fontSize: '.55rem', padding: '1px 5px' }}>{posPrimary(p.position)}</span>
                <span className="hsv-name">{p.name}</span>
                <span className="hsv-team">{p.afl_team}</span>
                <span className="hsv-sc">{p.sc_avg ? Math.round(p.sc_avg) : '—'}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
