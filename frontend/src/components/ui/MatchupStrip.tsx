/**
 * MatchupStrip — small horizontal strip showing this round's matchup
 * above the squad. Bridges squad-page context with the matchup the
 * user is preparing for.
 *
 * Renders nothing if there's no current matchup (e.g. pre-season, bye).
 *
 * Click jumps to the gameday view for that fixture.
 *
 * Styles live as .mstrip-* in static/style.css. Consumes --space-N tokens.
 */

import { Link } from 'react-router'

export interface MatchupStripProps {
  round: number
  matchup: {
    fixture_id: number
    opponent_name: string
    user_is_home: boolean
    status: string                  // 'scheduled' | 'live' | 'completed'
    user_score: number | null
    opponent_score: number | null
  }
  lockoutTime: string | null         // ISO datetime
  leagueId: string | number
}

function fmtLockout(iso: string | null): string {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  const diff = t - Date.now()
  if (diff <= 0) return 'Locked'
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  if (d > 0) return `Locks in ${d}d ${h}h`
  if (h > 0) return `Locks in ${h}h ${m}m`
  return `Locks in ${m}m`
}

function fmtScore(a: number | null, b: number | null): string | null {
  if (a == null && b == null) return null
  return `${a ?? 0} – ${b ?? 0}`
}

export function MatchupStrip({ round, matchup, lockoutTime, leagueId }: MatchupStripProps) {
  const { opponent_name, user_is_home, status, user_score, opponent_score, fixture_id } = matchup
  const score = fmtScore(user_score, opponent_score)
  const isLive = status === 'live'
  const isDone = status === 'completed'
  const prefix = user_is_home ? 'vs' : '@'
  const href = `/leagues/${leagueId}/matchup/${fixture_id}`

  return (
    <Link to={href} className={`mstrip${isLive ? ' mstrip-live' : ''}${isDone ? ' mstrip-done' : ''}`}>
      <span className="mstrip-round">R{round}</span>
      <span className="mstrip-sep" aria-hidden>·</span>
      <span className="mstrip-matchup">
        <span className="mstrip-prefix">{prefix}</span>{' '}
        <span className="mstrip-opp">{opponent_name}</span>
      </span>
      <span className="mstrip-tail">
        {isLive && <span className="mstrip-livedot" aria-hidden />}
        {score ? (
          <span className="mstrip-score">{score}</span>
        ) : lockoutTime ? (
          <span className="mstrip-countdown">{fmtLockout(lockoutTime)}</span>
        ) : null}
      </span>
      <i className="bi bi-chevron-right mstrip-chev" aria-hidden></i>
    </Link>
  )
}
