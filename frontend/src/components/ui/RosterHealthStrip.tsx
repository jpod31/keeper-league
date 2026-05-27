/**
 * RosterHealthStrip — at-a-glance positional balance above the squad.
 *
 * Four chips (DEF · MID · RUC · FWD), each showing this team's
 * roster count and SC average vs the league average for that position.
 * Tone shifts: forest if you're above league, neutral if even, ochre
 * if below. Helps the user spot positional weak spots at a glance.
 *
 * Fetches /api/leagues/<id>/team/<id>/pos-avgs on mount. Renders nothing
 * until data lands or if the endpoint fails — degrades gracefully.
 *
 * Styles live as .rhealth-* in static/style.css. Consumes --space-N tokens.
 */

import { useEffect, useState } from 'react'

type PosKey = 'DEF' | 'MID' | 'RUC' | 'FWD'
const POSITIONS: PosKey[] = ['DEF', 'MID', 'RUC', 'FWD']

interface PosAvgsData {
  league_avg: Partial<Record<PosKey, number>>
  mine: Record<PosKey, { count: number; avg: number | null }>
}

export interface RosterHealthStripProps {
  leagueId: string | number
  teamId: string | number
}

function toneFor(diff: number | null): 'good' | 'neutral' | 'bad' {
  if (diff == null) return 'neutral'
  if (diff > 1.5) return 'good'
  if (diff < -1.5) return 'bad'
  return 'neutral'
}

export function RosterHealthStrip({ leagueId, teamId }: RosterHealthStripProps) {
  const [data, setData] = useState<PosAvgsData | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/leagues/${leagueId}/team/${teamId}/pos-avgs`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (!cancelled) setData(d) })
      .catch(() => { /* silent — strip stays hidden */ })
    return () => { cancelled = true }
  }, [leagueId, teamId])

  if (!data) return null

  return (
    <div className="rhealth" role="list" aria-label="Roster positional balance">
      {POSITIONS.map(pos => {
        const mine = data.mine[pos]
        const leagueAvg = data.league_avg[pos] ?? null
        const diff = (mine.avg != null && leagueAvg != null) ? +(mine.avg - leagueAvg).toFixed(1) : null
        const tone = toneFor(diff)
        const arrow = diff == null ? '' : diff > 0 ? '+' : ''
        return (
          <div key={pos} className={`rhealth-chip pos-${pos} rhealth-${tone}`} role="listitem">
            <span className="rhealth-pos">{pos}</span>
            <span className="rhealth-count">{mine.count}</span>
            {diff != null && (
              <span className="rhealth-delta" title={`Your avg ${mine.avg} vs league ${leagueAvg}`}>
                {arrow}{diff}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
