/**
 * HistoricalSquadView — read-only render of a past round's lineup using
 * the SAME structure the live squad uses:
 *   - desktop → <FieldView> (field background + positioned cards)
 *   - mobile  → position-grouped list (mirrors SquadPage's mob-squad-list)
 *
 * The backend lineup endpoint returns a FieldData-shaped snapshot, so
 * both renderers consume the same payload. isOwner=false → no actions.
 */

import { useEffect, useState } from 'react'
import { FieldView, type FieldData } from './FieldView'

interface Player {
  id: number; name: string; position: string; afl_team: string; age: number
  sc_avg: number; games_played: number; career_games: number; rating: number | null
  injury_type: string | null; injury_return: string | null; injury_severity: string | null
}

interface HistData {
  team: { id: number; name: string }
  round: number
  max_round: number
  locked: boolean
  field_data: FieldData | null
  team_logos: Record<string, string>
}

export interface HistoricalSquadViewProps {
  leagueId: string | number
  teamId: string | number
  round: number
}

const POS_COLORS: Record<string, { bg: string; text: string; row: string }> = {
  DEF: { bg: 'rgba(26,63,102,.35)', text: '#79c0ff', row: 'rgba(26,63,102,.08)' },
  MID: { bg: 'rgba(53,29,74,.35)', text: '#d2a8ff', row: 'rgba(53,29,74,.08)' },
  RUC: { bg: 'rgba(29,61,46,.35)', text: '#7ee787', row: 'rgba(29,61,46,.08)' },
  FWD: { bg: 'rgba(70,41,10,.35)', text: '#ffb471', row: 'rgba(70,41,10,.08)' },
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
  if (!data || !data.field_data) return <div className="hsv-error">No saved lineup for round {round}.</div>

  const fd = data.field_data
  const logos = data.team_logos

  function MobRow({ p, badge }: { p: Player; badge?: 'C' | 'VC' | 'E' }) {
    const cap = fd.cap_id === p.id
    const vc = fd.vc_id === p.id
    return (
      <div className="mob-pos-row" style={{ cursor: 'default' }}>
        {p.afl_team && logos[p.afl_team]
          ? <img src={logos[p.afl_team]} alt="" className="mob-pos-logo" />
          : <div className="mob-pos-logo" style={{ width: 26, height: 26 }} />}
        <div className="mob-pos-info">
          <div className="mob-pos-name">
            {p.name}
            {cap && <span className="mob-pos-badge mob-badge-cap">C</span>}
            {vc && <span className="mob-pos-badge mob-badge-vc">VC</span>}
            {badge === 'E' && <span className="mob-pos-badge mob-badge-emg">E</span>}
          </div>
          <div className="mob-pos-meta">
            {(p.position || 'MID').split('/').map(ps => (
              <span key={ps} className={`pos-badge pos-${ps}`} style={{ fontSize: '.62rem', padding: '1px 5px' }}>{ps}</span>
            ))}
            <span>{p.afl_team || ''}</span>
          </div>
        </div>
        <div className="mob-pos-sc">
          {p.sc_avg ? <span style={{ color: '#e6edf3', fontWeight: 700 }}>{p.sc_avg.toFixed(1)}</span> : <span style={{ color: '#484f58' }}>-</span>}
        </div>
      </div>
    )
  }

  return (
    <div className="hsv">
      <div className="hsv-banner">
        <i className="bi bi-clock-history"></i>
        Viewing R{data.round} archive — read-only
      </div>

      {/* Desktop: real field. Hidden on mobile by .fv-outer's d-none. */}
      <FieldView fd={fd} teamLogos={logos} isOwner={false} />

      {/* Mobile: position-grouped list, mirrors the live squad's mob list. */}
      <div className="d-lg-none mob-squad-list">
        {['DEF', 'MID', 'RUC', 'FWD'].map(pos => {
          const zonePlayers = (fd.zones[pos] || []).filter(Boolean) as Player[]
          if (!zonePlayers.length) return null
          const colors = POS_COLORS[pos] || POS_COLORS.MID
          return (
            <div className="mob-pos-group" key={pos}>
              <div className="mob-pos-header" style={{ background: colors.bg, borderLeft: `3px solid ${colors.text}` }}>
                <span className="mob-pos-label" style={{ color: colors.text }}>{pos}</span>
                <span className="mob-pos-count">{zonePlayers.length}/{fd.zones[pos]?.length || 0}</span>
              </div>
              {zonePlayers.map(p => <MobRow key={p.id} p={p} />)}
            </div>
          )
        })}
        {fd.flex_data.some(s => s.player) && (
          <div className="mob-pos-group">
            <div className="mob-pos-header" style={{ background: 'rgba(139,148,158,.15)', borderLeft: '3px solid #8b949e' }}>
              <span className="mob-pos-label" style={{ color: '#8b949e' }}>FLEX</span>
              <span className="mob-pos-count">{fd.flex_data.filter(s => s.player).length}/{fd.flex_count}</span>
            </div>
            {fd.flex_data.filter(s => s.player).map(s => <MobRow key={s.player!.id} p={s.player!} />)}
          </div>
        )}
        {fd.emergency_players.length > 0 && (
          <div className="mob-pos-group">
            <div className="mob-pos-header" style={{ background: 'rgba(56,166,215,.1)', borderLeft: '3px solid #38a6d7' }}>
              <span className="mob-pos-label" style={{ color: '#38a6d7' }}><i className="bi bi-shield-exclamation me-1"></i>EMERGENCIES</span>
              <span className="mob-pos-count">{fd.emergency_players.length}</span>
            </div>
            {fd.emergency_players.map(p => <MobRow key={p.id} p={p} badge="E" />)}
          </div>
        )}
        {fd.reserves.length > 0 && (
          <div className="mob-pos-group mob-reserves-group">
            <div className="mob-pos-header" style={{ background: 'rgba(48,54,61,.4)', borderLeft: '3px solid #484f58' }}>
              <span className="mob-pos-label" style={{ color: '#6e7681' }}>BENCH</span>
              <span className="mob-pos-count">{fd.reserves.length}</span>
            </div>
            {fd.reserves.map(p => <MobRow key={p.id} p={p} />)}
          </div>
        )}
        {(fd.rookies?.length ?? 0) > 0 && (
          <div className="mob-pos-group">
            <div className="mob-pos-header" style={{ background: 'rgba(45,212,191,.12)', borderLeft: '3px solid #2dd4bf' }}>
              <span className="mob-pos-label" style={{ color: '#2dd4bf' }}><i className="bi bi-stars me-1"></i>ROOKIES</span>
              <span className="mob-pos-count">{fd.rookies!.length}</span>
            </div>
            {fd.rookies!.map(p => <MobRow key={p.id} p={p} />)}
          </div>
        )}
      </div>
    </div>
  )
}
