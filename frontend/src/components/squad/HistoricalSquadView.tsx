/**
 * HistoricalSquadView — read-only render of a past round's lineup.
 *
 * Renders the lineup in a field-like 4-zone layout (DEF / MID / RUC /
 * FWD) with player cards arranged horizontally inside each zone, so
 * it visually echoes the live FieldView instead of reading as text
 * lists. Bench players go in their own row underneath.
 *
 * Fetches /api/leagues/<id>/team/<id>/lineup/<round> on mount.
 * No actions, no swap mode, no lockout context — pure archive.
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

  // Group players by position bucket. Bench / emergencies render in
  // a separate row at the bottom.
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

      {/* Field-shaped vertical zones (DEF top, FWD bottom — mirrors
          the live FieldView). Each zone lays its players out as
          horizontal cards. */}
      <div className="hsv-field">
        {POS_ORDER.map(pos => {
          const players = onField[pos]
          if (players.length === 0) return null
          return (
            <section key={pos} className={`hsv-zone pos-${pos}`}>
              <div className="hsv-zone-label">{pos}</div>
              <div className="hsv-cards">
                {players.map(p => (
                  <div key={p.id} className="hsv-card">
                    <div className="hsv-card-head">
                      <span className="hsv-card-name" title={p.name}>{p.name}</span>
                      <span className="hsv-card-badges">
                        {p.is_captain && <span className="hsv-badge hsv-badge-c" title="Captain">C</span>}
                        {p.is_vc && <span className="hsv-badge hsv-badge-vc" title="Vice-captain">VC</span>}
                        {p.is_emergency > 0 && <span className="hsv-badge hsv-badge-e" title="Emergency">E</span>}
                        {p.injury && <span className="hsv-badge hsv-badge-inj" title={p.injury}><i className="bi bi-bandaid-fill"></i></span>}
                      </span>
                    </div>
                    <div className="hsv-card-meta">
                      <span className="hsv-card-team">{p.afl_team}</span>
                      <span className="hsv-card-sc">{p.sc_avg ? Math.round(p.sc_avg) : '—'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )
        })}
      </div>

      {bench.length > 0 && (
        <section className="hsv-bench">
          <div className="hsv-zone-label">Bench</div>
          <div className="hsv-cards">
            {bench.map(p => (
              <div key={p.id} className="hsv-card hsv-card-bench">
                <div className="hsv-card-head">
                  <span className={`pos-badge pos-${posPrimary(p.position)} hsv-card-pos`}>{posPrimary(p.position)}</span>
                  <span className="hsv-card-name" title={p.name}>{p.name}</span>
                </div>
                <div className="hsv-card-meta">
                  <span className="hsv-card-team">{p.afl_team}</span>
                  <span className="hsv-card-sc">{p.sc_avg ? Math.round(p.sc_avg) : '—'}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
