/**
 * MatchupStrip — inline status pill for this round's matchup.
 *
 * Visually matches the existing .kl-status-pill chips on SquadPage
 * (delist / trade / squad-cap pills) — small icon ring + 2-line text,
 * NOT a full-width banner. Clicks navigate to the matchup detail.
 *
 * Three tones via icon ring:
 *   - default / scheduled  → sapphire
 *   - live                 → rust + .kl-breathe pulse
 *   - completed            → muted glass
 *
 * Hidden when there's no current matchup (pre-season, bye).
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
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function MatchupStrip({ round, matchup, lockoutTime, leagueId }: MatchupStripProps) {
  const { opponent_name, user_is_home, status, user_score, opponent_score, fixture_id } = matchup
  const isLive = status === 'live'
  const isDone = status === 'completed'
  const prefix = user_is_home ? 'vs' : '@'
  const score = (user_score != null || opponent_score != null)
    ? `${user_score ?? 0} – ${opponent_score ?? 0}`
    : null
  const sub = isDone && score
    ? `R${round} · ${score}`
    : isLive && score
    ? `R${round} · LIVE ${score}`
    : `R${round}${lockoutTime ? ` · ${fmtLockout(lockoutTime)}` : ''}`
  const tone = isLive ? 'mstrip-live' : isDone ? 'mstrip-done' : ''
  const icon = isLive ? 'bi-broadcast' : isDone ? 'bi-flag-fill' : 'bi-calendar-event'

  return (
    <Link
      to={`/leagues/${leagueId}/matchup/${fixture_id}`}
      className={`mstrip ${tone}`.trim()}
      aria-label={`Round ${round} matchup ${prefix} ${opponent_name}`}
    >
      <span className="mstrip-icon" aria-hidden>
        <i className={`bi ${icon}`}></i>
      </span>
      <span className="mstrip-text">
        <span className="mstrip-title">{prefix} {opponent_name}</span>
        <span className="mstrip-sub">{sub}</span>
      </span>
    </Link>
  )
}
